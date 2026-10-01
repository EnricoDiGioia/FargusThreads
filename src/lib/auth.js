// Entrar com a conta do FargusGram
//
// 1. O FargusThreads confere o e-mail e a senha no Supabase do FargusGram
//    (ou aproveita o FargusGram já aberto neste navegador).
// 2. Manda o login de lá para a função "fargusgram" do Supabase do
//    FargusThreads, que confere, copia os personagens e devolve uma sessão daqui.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { gram, supabase, GRAM_URL, GRAM_KEY } from './supabase';
import { local } from './storage';
import { errorMessage } from './api';

const SYNC_EVERY = 15 * 60 * 1000;

async function callBridge(acao, token) {
  let result;
  try {
    result = await supabase.functions.invoke('fargusgram', { body: { acao, token } });
  } catch (e) {
    throw new Error(errorMessage(e));
  }
  const { data, error } = result;
  if (!error) return data;

  let msg = null;
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status;
    let body = null;
    try {
      body = await error.context.json();
    } catch {
      /* resposta sem JSON */
    }
    msg = body?.erro || null;
    if (!msg && status === 404) {
      msg = 'A função "fargusgram" ainda não foi criada no Supabase do FargusThreads. Veja o passo 3 do guia docs/DEPLOY.md.';
    } else if (!msg && status === 401) {
      msg = 'Na função "fargusgram" do Supabase, desligue "Verify JWT" e tente de novo. Veja o passo 3 do guia docs/DEPLOY.md.';
    } else if (!msg) {
      msg = body?.message || body?.msg || `A função "fargusgram" respondeu com erro (${status}).`;
    }
  } else if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    msg = 'Não deu para falar com o FargusThreads. Confira a internet e se a função "fargusgram" foi criada (docs/DEPLOY.md, passo 3).';
  }
  throw new Error(msg || errorMessage(error));
}

// Sessão do FargusGram aberta neste mesmo navegador (o app de lá guarda em "fargusgram-auth").
// Só lê: quem renova essa sessão é o próprio FargusGram.
export function readGramAppSession() {
  const raw = local.json('fargusgram-auth');
  const s = raw?.currentSession ?? raw;
  if (!s?.access_token || !s?.user?.id) return null;
  if (!s.expires_at || s.expires_at * 1000 < Date.now() + 60 * 1000) return null;
  return s;
}

// Personagens da conta do FargusGram (para o botão "Continuar como")
export async function gramCharactersOf(s) {
  try {
    const res = await fetch(
      `${GRAM_URL}/rest/v1/characters?select=id,handle,name,avatar_path&owner_id=eq.${encodeURIComponent(s.user.id)}&order=created_at`,
      { headers: { apikey: GRAM_KEY, Authorization: `Bearer ${s.access_token}`, Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const list = await res.json();
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

// Algum login do FargusGram que dê para usar agora (para sincronizar e importar)
let lastToken = null; // o do "Continuar como", enquanto o app estiver aberto
export async function gramToken() {
  try {
    const { data } = await gram.auth.getSession();
    if (data?.session?.access_token) return data.session.access_token;
  } catch {
    /* sem sessão própria */
  }
  const s = readGramAppSession();
  if (s) return s.access_token;
  return lastToken;
}

async function enter(token) {
  const data = await callBridge('entrar', token);
  if (!data?.session?.access_token) throw new Error('A função "fargusgram" não devolveu a sessão.');
  const { error } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (error) throw new Error(errorMessage(error));
  lastToken = token;
  local.set('ft-last-sync', String(Date.now()));
}

export async function loginWithPassword(email, password) {
  const { data, error } = await gram.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (/invalid login|invalid credentials/i.test(error.message)) {
      throw new Error('E-mail ou senha incorretos. Use os mesmos do FargusGram.');
    }
    throw new Error(errorMessage(error));
  }
  try {
    await enter(data.session.access_token);
  } catch (e) {
    await gram.auth.signOut({ scope: 'local' }).catch(() => {});
    throw e;
  }
}

export async function continueWithGram() {
  const s = readGramAppSession();
  if (!s) throw new Error('A sessão do FargusGram expirou. Entre com o e-mail e a senha.');
  await enter(s.access_token);
}

// Copia de novo os personagens do FargusGram (nome, foto, selo, NPCs novos).
// Roda sozinho no máximo a cada 15 minutos.
export async function syncFromGram({ force = false } = {}) {
  const last = Number(local.get('ft-last-sync') || 0);
  if (!force && Date.now() - last < SYNC_EVERY) return false;
  const token = await gramToken();
  if (!token) {
    if (force) throw new Error('Para atualizar, entre de novo com a sua conta do FargusGram (Configurações → Sair).');
    return false;
  }
  await callBridge('sincronizar', token);
  local.set('ft-last-sync', String(Date.now()));
  return true;
}

export async function importGramFollows() {
  const token = await gramToken();
  if (!token) throw new Error('Para importar, entre de novo com a sua conta do FargusGram (Configurações → Sair).');
  const data = await callBridge('importar_seguidos', token);
  return Number(data?.importados) || 0;
}

export async function signOutEverywhere() {
  lastToken = null;
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  // "local": só esta sessão do FargusThreads; o FargusGram continua logado
  await gram.auth.signOut({ scope: 'local' }).catch(() => {});
}
