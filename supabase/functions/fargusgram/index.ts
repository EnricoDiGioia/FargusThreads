// =====================================================================
//  FargusThreads — função "fargusgram": entrar com a conta do FargusGram
//
//  Como criar no Supabase do FargusThreads (uma vez só): Edge Functions →
//  Deploy a new function → Via Editor, nome "fargusgram", cole este arquivo
//  inteiro e clique em Deploy. Depois, em Details, desligue "Verify JWT"
//  (quem chama ainda não tem login aqui; a função confere o do FargusGram).
//  O passo a passo completo está no README.
//
//  O que ela faz, a cada chamada:
//  1. confere no Supabase do FargusGram se o login (token) é de verdade;
//  2. copia os jogadores e personagens de lá para cá (tabelas players e
//     characters), com os mesmos IDs;
//  3. conforme a ação:
//     - "entrar": garante o login daqui com o mesmo ID e devolve uma sessão;
//     - "sincronizar": só a cópia do passo 2;
//     - "importar_seguidos": segue aqui quem os seus personagens seguem lá.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

// Supabase do FargusGram (os mesmos valores do src/config.js de lá; são
// públicos). Ficam fixos aqui, e não vêm do app, para ninguém conseguir
// apontar a função para outro Supabase e se passar por um jogador.
const GRAM_URL = 'https://vhiagccrtqxizserfdzm.supabase.co';
const GRAM_KEY = 'sb_publishable_YvM0xKvUvhg3zlMzLyNpZw_i8jiyizN';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');

// O Supabase entrega as chaves num "dicionário" JSON (chaves novas) ou na
// variável antiga. Usa a que existir.
function pickKey(dictName: string, legacyName: string): string {
  try {
    const dict = JSON.parse(Deno.env.get(dictName) ?? '{}');
    const value = dict?.default ?? Object.values(dict ?? {})[0];
    const key = typeof value === 'string' ? value : value?.api_key ?? value?.key;
    if (typeof key === 'string' && key) return key;
  } catch {
    /* sem o dicionário: tenta a variável antiga */
  }
  return Deno.env.get(legacyName) ?? '';
}
const SECRET_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const PUBLIC_KEY = pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: NO_SESSION });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

class Falha extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Lê do FargusGram com o login da própria pessoa (as regras de lá valem)
async function gramGet(path: string, token: string) {
  let res: Response;
  try {
    res = await fetch(`${GRAM_URL}${path}`, {
      headers: { apikey: GRAM_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new Falha('O FargusGram não respondeu. Tente de novo em instantes.', 502);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Falha('Sua sessão do FargusGram expirou. Entre de novo.', 401);
  }
  if (!res.ok) {
    console.error('[fargusgram] erro lendo', path, res.status, await res.text().catch(() => ''));
    throw new Falha('O FargusGram não respondeu. Tente de novo em instantes.', 502);
  }
  return res.json();
}

type GramUser = { id: string; email?: string | null };

async function gramUser(token: string): Promise<GramUser> {
  const user = await gramGet('/auth/v1/user', token);
  if (!user?.id) throw new Falha('Sua sessão do FargusGram expirou. Entre de novo.', 401);
  return user;
}

const pickPlayer = (p: Record<string, unknown>) => ({
  id: p.id,
  display_name: p.display_name ?? '',
  is_admin: !!p.is_admin,
});

const pickCharacter = (c: Record<string, unknown>) => ({
  id: c.id,
  owner_id: c.owner_id,
  handle: c.handle,
  name: c.name ?? '',
  bio: c.bio ?? '',
  avatar_path: c.avatar_path ?? null,
  is_verified: !!c.is_verified,
  follower_bonus: Number(c.follower_bonus) || 0,
  like_bonus: Number(c.like_bonus) || 0,
  created_at: c.created_at ?? null,
});

// Copia jogadores e personagens do FargusGram para cá
async function sync(user: GramUser, token: string) {
  const [players, characters] = await Promise.all([
    gramGet('/rest/v1/players?select=id,display_name,is_admin', token),
    gramGet('/rest/v1/characters?select=*', token),
  ]);
  if (!Array.isArray(players) || !players.some((p) => p?.id === user.id)) {
    throw new Falha('Esta conta do FargusGram ainda não entrou no grupo. Termine o cadastro lá, com o código de convite.', 403);
  }
  if (!Array.isArray(characters)) throw new Falha('O FargusGram não respondeu. Tente de novo em instantes.', 502);

  const { data, error } = await admin.rpc('sync_from_gram', {
    p_players: players.map(pickPlayer),
    p_characters: characters.map(pickCharacter),
  });
  if (error) {
    console.error('[fargusgram] sync_from_gram', error);
    if (/sync_from_gram|schema cache|does not exist/i.test(error.message ?? '')) {
      throw new Falha('O banco do FargusThreads ainda não foi configurado: rode o supabase/setup.sql no SQL Editor.', 500);
    }
    throw new Falha('Não deu para copiar os personagens do FargusGram.', 500);
  }

  // quem saiu do grupo no FargusGram perde o login daqui também
  for (const id of data?.removed_players ?? []) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  return { players, characters, counts: data };
}

// Garante o login daqui com o mesmo ID do FargusGram e abre uma sessão
async function openSession(user: GramUser) {
  const email = String(user.email ?? '').trim().toLowerCase();
  if (!email) throw new Falha('A conta do FargusGram não tem e-mail.', 400);

  const { data: found } = await admin.auth.admin.getUserById(user.id);
  if (!found?.user) {
    const { error } = await admin.auth.admin.createUser({ id: user.id, email, email_confirm: true });
    if (error) {
      console.error('[fargusgram] createUser', error);
      if (/already|registered|exists/i.test(error.message ?? '')) {
        throw new Falha(
          'Já existe outro login com esse e-mail no Supabase do FargusThreads. Apague em Authentication → Users e tente de novo.',
          409
        );
      }
      throw new Falha('Não deu para criar o seu login no FargusThreads.', 500);
    }
  } else if ((found.user.email ?? '').toLowerCase() !== email) {
    // trocou de e-mail no FargusGram
    await admin.auth.admin.updateUserById(user.id, { email, email_confirm: true }).catch(() => {});
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const hashed = link?.properties?.hashed_token;
  if (linkError || !hashed) {
    console.error('[fargusgram] generateLink', linkError);
    throw new Falha('Não deu para abrir a sua sessão no FargusThreads.', 500);
  }

  // cliente novo a cada pedido: a sessão aberta aqui não pode ficar no "admin"
  const auth = createClient(SUPABASE_URL, PUBLIC_KEY || SECRET_KEY, { auth: NO_SESSION });
  const { data: verified, error: verifyError } = await auth.auth.verifyOtp({ token_hash: hashed, type: 'email' });
  const session = verified?.session;
  if (verifyError || !session) {
    console.error('[fargusgram] verifyOtp', verifyError);
    throw new Falha('Não deu para abrir a sua sessão no FargusThreads.', 500);
  }
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  if (!SUPABASE_URL || !SECRET_KEY) {
    return json({ erro: 'A função está sem as chaves do Supabase. Crie de novo pelo painel (Edge Functions).' }, 500);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ erro: 'Pedido inválido.' }, 400);
  }
  const acao = String(body.acao ?? 'entrar');
  const token = String(body.token ?? '');
  if (!token) return json({ erro: 'Entre com a sua conta do FargusGram.' }, 401);

  try {
    const user = await gramUser(token);
    const { characters, counts } = await sync(user, token);

    if (acao === 'sincronizar') {
      return json({ ok: true, jogadores: counts?.players ?? null, personagens: counts?.characters ?? null });
    }

    if (acao === 'importar_seguidos') {
      const mine = characters.filter((c: Record<string, unknown>) => c?.owner_id === user.id).map((c: Record<string, unknown>) => c.id);
      if (!mine.length) return json({ importados: 0 });
      const follows = await gramGet(
        `/rest/v1/follows?select=follower_id,followee_id&follower_id=in.(${mine.join(',')})`,
        token
      );
      const { data, error } = await admin.rpc('import_follows', { p_owner: user.id, p_pairs: follows ?? [] });
      if (error) {
        console.error('[fargusgram] import_follows', error);
        throw new Falha('Não deu para importar quem você segue.', 500);
      }
      return json({ importados: data ?? 0 });
    }

    if (acao === 'entrar') {
      return json({ session: await openSession(user) });
    }

    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    if (e instanceof Falha) return json({ erro: e.message }, e.status);
    console.error('[fargusgram] erro inesperado', e);
    return json({ erro: 'Algo deu errado. Tente de novo em instantes.' }, 500);
  }
});
