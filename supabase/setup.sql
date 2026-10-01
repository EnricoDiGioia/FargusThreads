-- =====================================================================
--  FargusThreads — configuração do banco de dados (Supabase próprio)
--
--  Como usar: no painel do Supabase do FargusThreads, abra "SQL Editor" >
--  "New query", cole este arquivo inteiro e clique em "Run".
--  Pode rodar de novo quando quiser: o script não apaga dados.
--
--  Ninguém se cadastra aqui. Quem entra usa a conta do FargusGram: a
--  função "fargusgram" (supabase/functions/fargusgram) confere o login lá,
--  copia os jogadores e personagens para as tabelas players e characters
--  e abre a sessão neste banco com o mesmo ID de jogador.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------

-- Jogadores: cópia dos jogadores do FargusGram (o id é o mesmo do login lá
-- e daqui). Só a função "fargusgram" escreve nesta tabela.
create table if not exists public.players (
  id           uuid primary key,
  display_name text not null default '',
  is_admin     boolean not null default false,
  synced_at    timestamptz not null default now()
);

-- Personagens: cópia dos personagens do FargusGram (mesmo id, @ e foto).
-- A bio e o link do Threads são próprios; sem bio própria, vale a do FargusGram.
create table if not exists public.characters (
  id             uuid primary key,
  owner_id       uuid not null references public.players (id) on delete cascade,
  handle         text not null,
  name           text not null default '',
  gram_bio       text not null default '',
  avatar_path    text,
  is_verified    boolean not null default false,
  follower_bonus int not null default 0,
  like_bonus     int not null default 0,
  bio            text check (bio is null or char_length(bio) <= 150),
  link           text not null default '' check (char_length(link) <= 200),
  created_at     timestamptz not null default now(),
  synced_at      timestamptz not null default now(),
  -- adiada: dois personagens podem trocar de @ na mesma sincronização
  constraint characters_handle_key unique (handle) deferrable initially deferred
);
create index if not exists characters_owner_idx on public.characters (owner_id);

-- Quem segue quem (lista própria do Threads)
create table if not exists public.follows (
  follower_id uuid not null references public.characters (id) on delete cascade,
  followee_id uuid not null references public.characters (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

-- Posts. Resposta = post com parent_id. Sequência = o autor respondendo
-- o próprio post (is_chain). Os contadores são mantidos pelos gatilhos.
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.characters (id) on delete cascade,
  body         text not null default '' check (char_length(body) <= 500),
  parent_id    uuid references public.posts (id) on delete set null,
  root_id      uuid references public.posts (id) on delete set null,
  quote_id     uuid references public.posts (id) on delete set null,
  is_reply     boolean not null default false,
  is_chain     boolean not null default false,
  topic        text check (topic is null or char_length(topic) between 1 and 50),
  reply_policy text not null default 'todos' check (reply_policy in ('todos', 'seguidos', 'mencionados')),
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  like_count   int not null default 0,
  reply_count  int not null default 0,
  repost_count int not null default 0,
  quote_count  int not null default 0
);
create index if not exists posts_feed_idx on public.posts (created_at desc) where not is_reply;
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists posts_parent_idx on public.posts (parent_id, created_at);
create index if not exists posts_root_idx on public.posts (root_id) where root_id is not null;
create index if not exists posts_quote_idx on public.posts (quote_id) where quote_id is not null;
create index if not exists posts_topic_idx on public.posts (lower(topic), created_at desc) where topic is not null;

-- Fotos de cada post (até 10), no bucket "midia"
create table if not exists public.post_media (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.posts (id) on delete cascade,
  position smallint not null default 0,
  path     text not null,
  width    int not null check (width > 0),
  height   int not null check (height > 0),
  unique (post_id, position)
);

create table if not exists public.likes (
  post_id      uuid not null references public.posts (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (post_id, character_id)
);
create index if not exists likes_character_idx on public.likes (character_id);

create table if not exists public.reposts (
  post_id      uuid not null references public.posts (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (post_id, character_id)
);
create index if not exists reposts_character_idx on public.reposts (character_id, created_at desc);
create index if not exists reposts_created_idx on public.reposts (created_at desc);

-- Salvos (só o dono vê)
create table if not exists public.saves (
  post_id      uuid not null references public.posts (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (post_id, character_id)
);
create index if not exists saves_character_idx on public.saves (character_id, created_at desc);

-- Enquetes: de 2 a 4 opções; cada personagem vota uma vez
create table if not exists public.polls (
  post_id uuid primary key references public.posts (id) on delete cascade,
  ends_at timestamptz not null
);
create table if not exists public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.polls (post_id) on delete cascade,
  position smallint not null,
  label    text not null check (char_length(label) between 1 and 25),
  votes    int not null default 0,
  unique (post_id, position)
);
create table if not exists public.poll_votes (
  post_id      uuid not null references public.polls (post_id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  option_id    uuid not null references public.poll_options (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (post_id, character_id)
);

-- Atividade (o coração da barra de baixo)
create table if not exists public.notifications (
  id           bigint generated always as identity primary key,
  recipient_id uuid not null references public.characters (id) on delete cascade,
  actor_id     uuid not null references public.characters (id) on delete cascade,
  kind         text not null check (kind in ('curtida', 'resposta', 'mencao', 'citacao', 'repost', 'seguiu')),
  post_id      uuid references public.posts (id) on delete cascade,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_post_idx on public.notifications (post_id) where post_id is not null;


-- ---------------------------------------------------------------------
-- 2. Funções auxiliares
-- ---------------------------------------------------------------------

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.players p where p.id = (select auth.uid()));
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.players p where p.id = (select auth.uid())), false);
$$;

create or replace function public.owns_character(p_character uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.characters c
    where c.id = p_character and c.owner_id = (select auth.uid())
  );
$$;

-- Personagens citados com @ num texto
create or replace function public.mentioned_characters(p_text text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.id
  from public.characters c
  where c.handle in (
    select distinct rtrim(lower(m[1]), '.')
    from regexp_matches(coalesce(p_text, ''), '@([A-Za-z0-9._]{2,30})', 'g') as m
  );
$$;

-- Curtidas extras de perfil famoso (Painel do admin do FargusGram): soma perto
-- da média em cada post, variando um pouco de um para outro, como lá
create or replace function public.like_bonus(p_post uuid, p_bonus int)
returns int language sql immutable set search_path = '' as $$
  select case when coalesce(p_bonus, 0) <= 0 then 0
    else round(p_bonus * (0.7 + 0.6 * ((hashtext(p_post::text) & 1023) / 1023.0)))::int end;
$$;

-- O personagem p_viewer pode responder (e citar) este post?
create or replace function public.can_reply(p_post uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.author_id = p_viewer
        or p.reply_policy = 'todos'
        or (p.reply_policy = 'seguidos' and exists (
              select 1 from public.follows f where f.follower_id = p.author_id and f.followee_id = p_viewer))
        or (p.reply_policy = 'mencionados' and p_viewer in (select public.mentioned_characters(p.body)))
    from public.posts p
    where p.id = p_post
  ), false);
$$;

create or replace function public.char_json(c public.characters)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'handle', c.handle, 'name', c.name,
    'avatar_path', c.avatar_path, 'is_verified', c.is_verified
  );
$$;

-- Um post pronto para a tela (sem o post citado)
create or replace function public.post_core_json(p_id uuid, p_viewer uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'body', p.body,
    'created_at', p.created_at,
    'edited_at', p.edited_at,
    'topic', p.topic,
    'reply_policy', p.reply_policy,
    'is_reply', p.is_reply,
    'is_chain', p.is_chain,
    'parent_id', p.parent_id,
    'root_id', p.root_id,
    'author', public.char_json(a),
    'reply_to', case when p.is_reply and not p.is_chain then (
        select jsonb_build_object('id', pp.id, 'handle', pa.handle)
        from public.posts pp join public.characters pa on pa.id = pp.author_id
        where pp.id = p.parent_id) end,
    'media', coalesce((
        select jsonb_agg(jsonb_build_object('path', m.path, 'width', m.width, 'height', m.height) order by m.position)
        from public.post_media m where m.post_id = p.id), '[]'::jsonb),
    'likes', p.like_count + case when p.is_reply then 0 else public.like_bonus(p.id, a.like_bonus) end,
    'replies', p.reply_count,
    'reposts', p.repost_count,
    'quotes', p.quote_count,
    'chain', case when p.is_reply then 0 else (
        select count(*) from public.posts c where c.root_id = p.id and c.is_chain and c.author_id = p.author_id) end,
    'liked', exists (select 1 from public.likes l where l.post_id = p.id and l.character_id = p_viewer),
    'reposted', exists (select 1 from public.reposts r where r.post_id = p.id and r.character_id = p_viewer),
    'saved', exists (select 1 from public.saves s where s.post_id = p.id and s.character_id = p_viewer),
    'can_reply', public.can_reply(p.id, p_viewer),
    'poll', (
      select jsonb_build_object(
        'ends_at', pl.ends_at,
        'closed', pl.ends_at <= now(),
        'total', (select coalesce(sum(o.votes), 0) from public.poll_options o where o.post_id = pl.post_id),
        'my_vote', (select v.option_id from public.poll_votes v where v.post_id = pl.post_id and v.character_id = p_viewer),
        'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'votes', o.votes) order by o.position)
                    from public.poll_options o where o.post_id = pl.post_id)
      )
      from public.polls pl where pl.post_id = p.id
    )
  )
  from public.posts p
  join public.characters a on a.id = p.author_id
  where p.id = p_id;
$$;

-- Post completo (com o post citado dentro)
create or replace function public.post_json(p_id uuid, p_viewer uuid)
returns jsonb language sql stable set search_path = '' as $$
  select public.post_core_json(p.id, p_viewer)
      || jsonb_build_object('quote', case when p.quote_id is null then null else public.post_core_json(p.quote_id, p_viewer) end)
  from public.posts p
  where p.id = p_id;
$$;


-- ---------------------------------------------------------------------
-- 3. Gatilhos: contadores, sequências e atividade
-- ---------------------------------------------------------------------

-- Antes de gravar um post: descobre se é resposta ou parte de sequência
-- e confere quem pode responder
create or replace function public.tg_posts_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  par public.posts;
begin
  new.is_reply := new.parent_id is not null;
  new.is_chain := false;
  new.root_id := null;
  if new.parent_id is not null then
    select * into par from public.posts where id = new.parent_id;
    if not found then
      raise exception 'Esse post foi apagado.';
    end if;
    new.root_id := coalesce(par.root_id, par.id);
    if par.author_id = new.author_id and (not par.is_reply or par.is_chain) then
      -- o autor continuando a própria sequência
      new.is_chain := true;
      new.reply_policy := par.reply_policy;
    elsif not public.can_reply(par.id, new.author_id) then
      raise exception 'Você não pode responder a este post.' using errcode = '42501';
    end if;
  end if;
  if new.quote_id is not null and not public.can_reply(new.quote_id, new.author_id) then
    raise exception 'Você não pode citar este post.' using errcode = '42501';
  end if;
  -- relógio de verdade: as partes de uma sequência ficam em ordem
  new.created_at := clock_timestamp();
  new.edited_at := null;
  new.like_count := 0;
  new.reply_count := 0;
  new.repost_count := 0;
  new.quote_count := 0;
  return new;
end $$;
drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.tg_posts_before_insert();

create or replace function public.tg_posts_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_parent_author uuid;
  v_quote_author uuid;
begin
  if new.parent_id is not null and not new.is_chain then
    update public.posts set reply_count = reply_count + 1
    where id = new.parent_id
    returning author_id into v_parent_author;
    if v_parent_author is not null and v_parent_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, kind, post_id)
      values (v_parent_author, new.author_id, 'resposta', new.id);
    end if;
  end if;

  if new.quote_id is not null then
    update public.posts set quote_count = quote_count + 1
    where id = new.quote_id
    returning author_id into v_quote_author;
    if v_quote_author is not null and v_quote_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, kind, post_id)
      values (v_quote_author, new.author_id, 'citacao', new.id);
    end if;
  end if;

  insert into public.notifications (recipient_id, actor_id, kind, post_id)
  select m, new.author_id, 'mencao', new.id
  from public.mentioned_characters(new.body) as m
  where m <> new.author_id
    and m is distinct from v_parent_author
    and m is distinct from v_quote_author;
  return new;
end $$;
drop trigger if exists posts_after_insert on public.posts;
create trigger posts_after_insert after insert on public.posts
  for each row execute function public.tg_posts_after_insert();

-- Apagar um post apaga também as partes seguintes da sequência
-- (uma de cada vez: cada parte apaga a seguinte)
create or replace function public.tg_posts_before_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not old.is_reply or old.is_chain then
    delete from public.posts
    where parent_id = old.id and is_chain and author_id = old.author_id;
  end if;
  return old;
end $$;
drop trigger if exists posts_before_delete on public.posts;
create trigger posts_before_delete before delete on public.posts
  for each row execute function public.tg_posts_before_delete();

create or replace function public.tg_posts_after_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.parent_id is not null and not old.is_chain then
    update public.posts set reply_count = greatest(reply_count - 1, 0) where id = old.parent_id;
  end if;
  if old.quote_id is not null then
    update public.posts set quote_count = greatest(quote_count - 1, 0) where id = old.quote_id;
  end if;
  return old;
end $$;
drop trigger if exists posts_after_delete on public.posts;
create trigger posts_after_delete after delete on public.posts
  for each row execute function public.tg_posts_after_delete();

create or replace function public.tg_likes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1
    where id = new.post_id
    returning author_id into v_author;
    if v_author is not null and v_author <> new.character_id then
      insert into public.notifications (recipient_id, actor_id, kind, post_id)
      values (v_author, new.character_id, 'curtida', new.post_id);
    end if;
    return new;
  end if;
  update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  delete from public.notifications
  where kind = 'curtida' and actor_id = old.character_id and post_id = old.post_id;
  return old;
end $$;
drop trigger if exists likes_change on public.likes;
create trigger likes_change after insert or delete on public.likes
  for each row execute function public.tg_likes();

create or replace function public.tg_reposts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set repost_count = repost_count + 1
    where id = new.post_id
    returning author_id into v_author;
    if v_author is not null and v_author <> new.character_id then
      insert into public.notifications (recipient_id, actor_id, kind, post_id)
      values (v_author, new.character_id, 'repost', new.post_id);
    end if;
    return new;
  end if;
  update public.posts set repost_count = greatest(repost_count - 1, 0) where id = old.post_id;
  delete from public.notifications
  where kind = 'repost' and actor_id = old.character_id and post_id = old.post_id;
  return old;
end $$;
drop trigger if exists reposts_change on public.reposts;
create trigger reposts_change after insert or delete on public.reposts
  for each row execute function public.tg_reposts();

-- Seguir avisa (menos quando é a importação de quem segue no FargusGram)
create or replace function public.tg_follows()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('fargus.silencioso', true), '') <> 'on' then
      insert into public.notifications (recipient_id, actor_id, kind)
      values (new.followee_id, new.follower_id, 'seguiu');
    end if;
    return new;
  end if;
  delete from public.notifications
  where kind = 'seguiu' and actor_id = old.follower_id and recipient_id = old.followee_id;
  return old;
end $$;
drop trigger if exists follows_change on public.follows;
create trigger follows_change after insert or delete on public.follows
  for each row execute function public.tg_follows();

-- Voto: a opção tem que ser da enquete e a enquete não pode ter terminado
create or replace function public.tg_poll_votes_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.poll_options o
    join public.polls pl on pl.post_id = o.post_id
    where o.id = new.option_id and o.post_id = new.post_id
  ) then
    raise exception 'Opção inválida.';
  end if;
  if exists (select 1 from public.polls pl where pl.post_id = new.post_id and pl.ends_at <= now()) then
    raise exception 'Essa enquete já terminou.';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists poll_votes_before on public.poll_votes;
create trigger poll_votes_before before insert on public.poll_votes
  for each row execute function public.tg_poll_votes_before();

create or replace function public.tg_poll_votes_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.poll_options set votes = votes + 1 where id = new.option_id;
  return new;
end $$;
drop trigger if exists poll_votes_after on public.poll_votes;
create trigger poll_votes_after after insert on public.poll_votes
  for each row execute function public.tg_poll_votes_after();


-- ---------------------------------------------------------------------
-- 4. Regras de segurança (Row Level Security)
--    Só quem é jogador do FargusGram enxerga alguma coisa.
-- ---------------------------------------------------------------------

alter table public.players       enable row level security;
alter table public.characters    enable row level security;
alter table public.follows       enable row level security;
alter table public.posts         enable row level security;
alter table public.post_media    enable row level security;
alter table public.likes         enable row level security;
alter table public.reposts       enable row level security;
alter table public.saves         enable row level security;
alter table public.polls         enable row level security;
alter table public.poll_options  enable row level security;
alter table public.poll_votes    enable row level security;
alter table public.notifications enable row level security;

drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated
  using ((select public.is_member()));

drop policy if exists characters_select on public.characters;
create policy characters_select on public.characters for select to authenticated
  using ((select public.is_member()));
-- (só bio e link: o resto vem do FargusGram)
drop policy if exists characters_update on public.characters;
create policy characters_update on public.characters for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select to authenticated
  using ((select public.is_member()));
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated
  with check (public.owns_character(follower_id));
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated
  using (public.owns_character(follower_id));

-- posts novos e edições só pelas funções create_thread e edit_post
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using ((select public.is_member()));

drop policy if exists post_media_select on public.post_media;
create policy post_media_select on public.post_media for select to authenticated
  using ((select public.is_member()));

drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes for select to authenticated
  using ((select public.is_member()));
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert to authenticated
  with check (public.owns_character(character_id));
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete to authenticated
  using (public.owns_character(character_id));

drop policy if exists reposts_select on public.reposts;
create policy reposts_select on public.reposts for select to authenticated
  using ((select public.is_member()));
drop policy if exists reposts_insert on public.reposts;
create policy reposts_insert on public.reposts for insert to authenticated
  with check (public.owns_character(character_id));
drop policy if exists reposts_delete on public.reposts;
create policy reposts_delete on public.reposts for delete to authenticated
  using (public.owns_character(character_id));

drop policy if exists saves_select on public.saves;
create policy saves_select on public.saves for select to authenticated
  using (public.owns_character(character_id));
drop policy if exists saves_insert on public.saves;
create policy saves_insert on public.saves for insert to authenticated
  with check (public.owns_character(character_id));
drop policy if exists saves_delete on public.saves;
create policy saves_delete on public.saves for delete to authenticated
  using (public.owns_character(character_id));

drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls for select to authenticated
  using ((select public.is_member()));
drop policy if exists poll_options_select on public.poll_options;
create policy poll_options_select on public.poll_options for select to authenticated
  using ((select public.is_member()));
-- cada um vê só o próprio voto; os outros veem só as contagens
drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes for select to authenticated
  using (public.owns_character(character_id));
drop policy if exists poll_votes_insert on public.poll_votes;
create policy poll_votes_insert on public.poll_votes for insert to authenticated
  with check (public.owns_character(character_id));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (public.owns_character(recipient_id));
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (public.owns_character(recipient_id));

-- Permissões (desde 2026 o Supabase não libera tabelas novas automaticamente)
grant usage on schema public to anon, authenticated, service_role;

revoke all on
  public.players, public.characters, public.follows, public.posts, public.post_media,
  public.likes, public.reposts, public.saves, public.polls, public.poll_options,
  public.poll_votes, public.notifications
from anon, authenticated;

grant all on
  public.players, public.characters, public.follows, public.posts, public.post_media,
  public.likes, public.reposts, public.saves, public.polls, public.poll_options,
  public.poll_votes, public.notifications
to service_role;
grant usage, select on all sequences in schema public to service_role;

grant select                 on public.players       to authenticated;
grant select                 on public.characters    to authenticated;
grant update (bio, link)     on public.characters    to authenticated;
grant select, insert, delete on public.follows       to authenticated;
grant select                 on public.posts         to authenticated;
grant select                 on public.post_media    to authenticated;
grant select, insert, delete on public.likes         to authenticated;
grant select, insert, delete on public.reposts       to authenticated;
grant select, insert, delete on public.saves         to authenticated;
grant select                 on public.polls         to authenticated;
grant select                 on public.poll_options  to authenticated;
grant select, insert         on public.poll_votes    to authenticated;
grant select, delete         on public.notifications to authenticated;


-- ---------------------------------------------------------------------
-- 5. Funções que o app chama
-- ---------------------------------------------------------------------

-- Quem está logado: jogador e os personagens dele (null = sem acesso)
create or replace function public.me()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'is_admin', p.is_admin,
    'synced_at', p.synced_at,
    'characters', coalesce((
      select jsonb_agg(public.char_json(c) || jsonb_build_object('bio', coalesce(c.bio, c.gram_bio), 'link', c.link)
                       order by c.created_at, c.handle)
      from public.characters c where c.owner_id = p.id), '[]'::jsonb)
  )
  from public.players p
  where p.id = (select auth.uid());
$$;

-- Todos os personagens (para as sugestões do @ ao escrever)
create or replace function public.all_characters()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.char_json(c) order by c.handle), '[]'::jsonb)
  from public.characters c;
$$;

-- Feed: "para_voce" (todo mundo) ou "seguindo"; posts e reposts, do mais novo
create or replace function public.feed(p_viewer uuid, p_tab text default 'para_voce', p_before timestamptz default null, p_limit int default 15)
returns jsonb language sql stable set search_path = '' as $$
  with items as (
    select p.created_at as at, p.id as post_id, null::uuid as repost_by
    from public.posts p
    where not p.is_reply
      and (p_before is null or p.created_at < p_before)
      and (p_tab <> 'seguindo' or p.author_id = p_viewer or exists (
            select 1 from public.follows f where f.follower_id = p_viewer and f.followee_id = p.author_id))
    union all
    select r.created_at, r.post_id, r.character_id
    from public.reposts r
    where (p_before is null or r.created_at < p_before)
      and (p_tab <> 'seguindo' or r.character_id = p_viewer or exists (
            select 1 from public.follows f where f.follower_id = p_viewer and f.followee_id = r.character_id))
    order by 1 desc
    limit least(greatest(coalesce(p_limit, 15), 1), 50)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'at', i.at,
      'post', public.post_json(i.post_id, p_viewer),
      'repost_by', case when i.repost_by is null then null
                   else (select public.char_json(c) from public.characters c where c.id = i.repost_by) end
    ) order by i.at desc), '[]'::jsonb)
  from items i;
$$;

-- Um post com a conversa: o que veio antes, a sequência do autor e as respostas
create or replace function public.thread_view(p_post uuid, p_viewer uuid)
returns jsonb language sql stable set search_path = '' as $$
  with recursive up as (
    select p.parent_id as id, 1 as depth from public.posts p where p.id = p_post
    union all
    select p.parent_id, up.depth + 1
    from up join public.posts p on p.id = up.id
    where up.depth < 30
  ),
  target as (select * from public.posts where id = p_post),
  chain as (
    select c.id, c.created_at
    from public.posts c, target t
    where c.is_chain
      and c.author_id = t.author_id
      and c.root_id = coalesce(t.root_id, t.id)
      and c.created_at > t.created_at
      and (not t.is_reply or t.is_chain)
  )
  select case when not exists (select 1 from target) then null else jsonb_build_object(
    'ancestors', coalesce((
      select jsonb_agg(public.post_json(up.id, p_viewer) order by up.depth desc)
      from up where up.id is not null), '[]'::jsonb),
    'post', public.post_json(p_post, p_viewer),
    'chain', coalesce((
      select jsonb_agg(public.post_json(chain.id, p_viewer) order by chain.created_at)
      from chain), '[]'::jsonb),
    'replies', coalesce((
      select jsonb_agg(public.post_json(r.id, p_viewer) order by r.created_at)
      from (
        select r.id, r.created_at
        from public.posts r
        where not r.is_chain
          and (r.parent_id = p_post or r.parent_id in (select id from chain))
        order by r.created_at
        limit 300
      ) r), '[]'::jsonb)
  ) end;
$$;

-- Perfil de um personagem pelo @
create or replace function public.profile(p_handle text, p_viewer uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'handle', c.handle,
    'name', c.name,
    'avatar_path', c.avatar_path,
    'is_verified', c.is_verified,
    'bio', coalesce(c.bio, c.gram_bio),
    'own_bio', c.bio,
    'gram_bio', c.gram_bio,
    'link', c.link,
    'followers', (select count(*) from public.follows f where f.followee_id = c.id) + c.follower_bonus,
    'following', (select count(*) from public.follows f where f.follower_id = c.id),
    'is_following', exists (select 1 from public.follows f where f.follower_id = p_viewer and f.followee_id = c.id),
    'follows_you', exists (select 1 from public.follows f where f.follower_id = c.id and f.followee_id = p_viewer),
    'is_mine', c.owner_id = (select auth.uid()),
    'followers_preview', coalesce((
      select jsonb_agg(x.avatar_path)
      from (
        select a.avatar_path
        from public.follows f join public.characters a on a.id = f.follower_id
        where f.followee_id = c.id
        order by f.created_at desc
        limit 3
      ) x), '[]'::jsonb)
  )
  from public.characters c
  where c.handle = lower(ltrim(btrim(p_handle), '@'));
$$;

-- Abas do perfil: threads, respostas, midia, reposts
create or replace function public.profile_posts(p_character uuid, p_viewer uuid, p_tab text default 'threads', p_before timestamptz default null, p_limit int default 15)
returns jsonb language sql stable set search_path = '' as $$
  with items as (
    select p.created_at as at, p.id as post_id, null::uuid as repost_by, null::uuid as context_id
    from public.posts p
    where p_tab = 'threads' and p.author_id = p_character and not p.is_reply
      and (p_before is null or p.created_at < p_before)
    union all
    select p.created_at, p.id, null, p.parent_id
    from public.posts p
    where p_tab = 'respostas' and p.author_id = p_character and p.is_reply and not p.is_chain
      and (p_before is null or p.created_at < p_before)
    union all
    select p.created_at, p.id, null, null
    from public.posts p
    where p_tab = 'midia' and p.author_id = p_character
      and exists (select 1 from public.post_media m where m.post_id = p.id)
      and (p_before is null or p.created_at < p_before)
    union all
    select r.created_at, r.post_id, r.character_id, null
    from public.reposts r
    where p_tab = 'reposts' and r.character_id = p_character
      and (p_before is null or r.created_at < p_before)
    order by 1 desc
    limit least(greatest(coalesce(p_limit, 15), 1), 50)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'at', i.at,
      'post', public.post_json(i.post_id, p_viewer),
      'context', case when i.context_id is null then null else public.post_json(i.context_id, p_viewer) end,
      'repost_by', case when i.repost_by is null then null
                   else (select public.char_json(c) from public.characters c where c.id = i.repost_by) end
    ) order by i.at desc), '[]'::jsonb)
  from items i;
$$;

-- Posts de um tópico
create or replace function public.topic_posts(p_topic text, p_viewer uuid, p_before timestamptz default null, p_limit int default 15)
returns jsonb language sql stable set search_path = '' as $$
  with items as (
    select p.created_at as at, p.id as post_id
    from public.posts p
    where (
        -- o tópico do post ("Torre de Fargus") ou um #TorreDeFargus no texto
        (p.topic is not null and replace(lower(p.topic), ' ', '') = replace(lower(btrim(ltrim(p_topic, '#'))), ' ', ''))
        or position(('#' || replace(lower(btrim(ltrim(p_topic, '#'))), ' ', '')) in lower(p.body)) > 0
      )
      and (p_before is null or p.created_at < p_before)
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 15), 1), 50)
  )
  select coalesce(jsonb_agg(jsonb_build_object('at', i.at, 'post', public.post_json(i.post_id, p_viewer)) order by i.at desc), '[]'::jsonb)
  from items i;
$$;

-- Busca: pessoas, tópicos e posts
create or replace function public.search(p_query text, p_viewer uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  q text := lower(btrim(coalesce(p_query, '')));
  pat text;
begin
  q := ltrim(q, '@#');
  if q = '' then
    return jsonb_build_object('people', '[]'::jsonb, 'topics', '[]'::jsonb, 'posts', '[]'::jsonb);
  end if;
  pat := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(x.j order by x.exact desc, x.followers desc, x.handle)
      from (
        select public.char_json(c) || jsonb_build_object(
                 'followers', (select count(*) from public.follows f where f.followee_id = c.id) + c.follower_bonus,
                 'is_following', exists (select 1 from public.follows f where f.follower_id = p_viewer and f.followee_id = c.id)
               ) as j,
               c.handle = q as exact,
               (select count(*) from public.follows f where f.followee_id = c.id) + c.follower_bonus as followers,
               c.handle
        from public.characters c
        where c.handle like pat || '%' escape '\' or lower(c.name) like '%' || pat || '%' escape '\'
        limit 20
      ) x), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('topic', t.topic, 'posts', t.n) order by t.n desc)
      from (
        select min(p.topic) as topic, count(*) as n
        from public.posts p
        where p.topic is not null and lower(p.topic) like '%' || pat || '%' escape '\'
        group by lower(p.topic)
        order by count(*) desc
        limit 8
      ) t), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(public.post_json(x.id, p_viewer) order by x.created_at desc)
      from (
        select p.id, p.created_at
        from public.posts p
        where lower(p.body) like '%' || pat || '%' escape '\'
           or lower(coalesce(p.topic, '')) = q
        order by p.created_at desc
        limit 25
      ) x), '[]'::jsonb)
  );
end $$;

-- Sugestões de quem seguir (tela de busca vazia)
create or replace function public.suggestions(p_viewer uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.score desc, x.handle), '[]'::jsonb)
  from (
    select public.char_json(c) || jsonb_build_object(
             'bio', coalesce(c.bio, c.gram_bio),
             'followers', (select count(*) from public.follows f where f.followee_id = c.id) + c.follower_bonus,
             'is_following', false
           ) as j,
           (select count(*) from public.follows f where f.followee_id = c.id) + c.follower_bonus
             + 5 * (select count(*) from public.posts p where p.author_id = c.id) as score,
           c.handle
    from public.characters c
    where c.id <> p_viewer
      and not exists (select 1 from public.follows f where f.follower_id = p_viewer and f.followee_id = c.id)
    limit 30
  ) x;
$$;

-- Salvos de um personagem do jogador logado
create or replace function public.saved_posts(p_character uuid, p_before timestamptz default null, p_limit int default 15)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('at', s.created_at, 'post', public.post_json(s.post_id, p_character))
                            order by s.created_at desc), '[]'::jsonb)
  from (
    select sv.post_id, sv.created_at
    from public.saves sv
    where sv.character_id = p_character
      and (p_before is null or sv.created_at < p_before)
    order by sv.created_at desc
    limit least(greatest(coalesce(p_limit, 15), 1), 50)
  ) s;
$$;

-- Seguidores / seguindo
create or replace function public.follow_list(p_character uuid, p_kind text, p_viewer uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.at desc), '[]'::jsonb)
  from (
    select public.char_json(c) || jsonb_build_object(
             'is_following', exists (select 1 from public.follows v where v.follower_id = p_viewer and v.followee_id = c.id)
           ) as j,
           f.created_at as at
    from public.follows f
    join public.characters c on c.id = case when p_kind = 'seguindo' then f.followee_id else f.follower_id end
    where (p_kind = 'seguindo' and f.follower_id = p_character)
       or (p_kind <> 'seguindo' and f.followee_id = p_character)
    order by f.created_at desc
    limit 1000
  ) x;
$$;

-- Atividade de um post: quem curtiu, quem repostou, quem citou
create or replace function public.post_activity(p_post uuid, p_kind text, p_viewer uuid)
returns jsonb language sql stable set search_path = '' as $$
  select case
    when p_kind = 'citacoes' then coalesce((
      select jsonb_agg(public.post_json(x.id, p_viewer) order by x.created_at desc)
      from (select q.id, q.created_at from public.posts q where q.quote_id = p_post order by q.created_at desc limit 200) x
    ), '[]'::jsonb)
    else coalesce((
      select jsonb_agg(x.j order by x.at desc)
      from (
        select public.char_json(c) || jsonb_build_object(
                 'is_following', exists (select 1 from public.follows v where v.follower_id = p_viewer and v.followee_id = c.id)
               ) as j,
               t.created_at as at
        from (
          select l.character_id, l.created_at from public.likes l where p_kind = 'curtidas' and l.post_id = p_post
          union all
          select r.character_id, r.created_at from public.reposts r where p_kind = 'reposts' and r.post_id = p_post
        ) t
        join public.characters c on c.id = t.character_id
        order by t.created_at desc
        limit 1000
      ) x), '[]'::jsonb)
  end;
$$;

-- Atividade (notificações) de um personagem do jogador logado
create or replace function public.activity(p_character uuid, p_filter text default 'tudo', p_before timestamptz default null, p_limit int default 30)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id,
      'kind', n.kind,
      'at', n.created_at,
      'read', n.read_at is not null,
      'actor', public.char_json(a) || jsonb_build_object(
        'is_following', exists (select 1 from public.follows v where v.follower_id = p_character and v.followee_id = a.id)),
      'post', case when n.post_id is null then null else public.post_json(n.post_id, p_character) end
    ) order by n.created_at desc), '[]'::jsonb)
  from (
    select *
    from public.notifications n
    where n.recipient_id = p_character
      and (p_before is null or n.created_at < p_before)
      and (coalesce(p_filter, 'tudo') = 'tudo'
        or (p_filter = 'seguidores' and n.kind = 'seguiu')
        or (p_filter = 'respostas'  and n.kind = 'resposta')
        or (p_filter = 'mencoes'    and n.kind = 'mencao')
        or (p_filter = 'citacoes'   and n.kind = 'citacao')
        or (p_filter = 'reposts'    and n.kind = 'repost')
        or (p_filter = 'curtidas'   and n.kind = 'curtida'))
    order by n.created_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 60)
  ) n
  join public.characters a on a.id = n.actor_id;
$$;

-- Avisos não lidos de cada personagem do jogador: {"<id>": 3, ...}
create or replace function public.unread_counts()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(c.id, (
      select count(*) from public.notifications n where n.recipient_id = c.id and n.read_at is null)), '{}'::jsonb)
  from public.characters c
  where c.owner_id = (select auth.uid());
$$;

create or replace function public.mark_activity_read(p_character uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_character(p_character) then
    return;
  end if;
  update public.notifications set read_at = now()
  where recipient_id = p_character and read_at is null;
end $$;

-- Publicar: um post ou uma sequência (até 10 partes), resposta ou citação.
-- p_parts: [{ "body": "...", "media": [{ "path", "width", "height" }], "poll": { "options": [...], "hours": 24 } }]
-- As fotos são enviadas antes para o bucket "midia", na pasta do jogador.
create or replace function public.create_thread(
  p_author uuid,
  p_parts jsonb,
  p_parent uuid default null,
  p_quote uuid default null,
  p_topic text default null,
  p_reply_policy text default 'todos'
)
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[] := '{}';
  v_prev uuid := p_parent;
  v_part jsonb;
  v_i int := 0;
  v_id uuid;
  v_body text;
  v_media jsonb;
  v_poll jsonb;
  v_opts jsonb;
  v_topic text := nullif(btrim(regexp_replace(coalesce(p_topic, ''), '^#+', '')), '');
  v_policy text := coalesce(p_reply_policy, 'todos');
  v_folder text := (select auth.uid())::text || '/';
  v_pos int;
  m jsonb;
  o jsonb;
begin
  if not public.owns_character(p_author) then
    raise exception 'Escolha um dos seus personagens.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_parts) is distinct from 'array' or jsonb_array_length(p_parts) = 0 then
    raise exception 'Nada para publicar.';
  end if;
  if jsonb_array_length(p_parts) > 10 then
    raise exception 'Uma sequência pode ter até 10 partes.';
  end if;
  if v_policy not in ('todos', 'seguidos', 'mencionados') then
    v_policy := 'todos';
  end if;
  if char_length(v_topic) > 50 then
    raise exception 'O tópico pode ter até 50 caracteres.';
  end if;
  if p_quote is not null and not exists (select 1 from public.posts where id = p_quote) then
    raise exception 'O post citado foi apagado.';
  end if;

  for v_part in select value from jsonb_array_elements(p_parts) loop
    v_i := v_i + 1;
    v_body := btrim(coalesce(v_part ->> 'body', ''));
    v_media := coalesce(v_part -> 'media', '[]'::jsonb);
    v_poll := v_part -> 'poll';
    if jsonb_typeof(v_media) is distinct from 'array' then
      v_media := '[]'::jsonb;
    end if;
    if jsonb_typeof(v_poll) is distinct from 'object' then
      v_poll := null;
    end if;
    if char_length(v_body) > 500 then
      raise exception 'Cada parte pode ter até 500 caracteres.';
    end if;
    if jsonb_array_length(v_media) > 10 then
      raise exception 'Cada parte pode ter até 10 fotos.';
    end if;
    if v_poll is not null and jsonb_array_length(v_media) > 0 then
      raise exception 'Uma parte não pode ter foto e enquete juntas.';
    end if;
    if v_body = '' and jsonb_array_length(v_media) = 0 and v_poll is null and not (v_i = 1 and p_quote is not null) then
      raise exception 'A parte % está vazia.', v_i;
    end if;

    insert into public.posts (author_id, body, parent_id, quote_id, topic, reply_policy)
    values (
      p_author, v_body, v_prev,
      case when v_i = 1 then p_quote end,
      case when v_i = 1 then v_topic end,
      v_policy
    )
    returning id into v_id;

    v_pos := 0;
    for m in select value from jsonb_array_elements(v_media) loop
      if coalesce(m ->> 'path', '') not like v_folder || '%' or (m ->> 'path') like '%..%' then
        raise exception 'Foto inválida.';
      end if;
      insert into public.post_media (post_id, position, path, width, height)
      values (v_id, v_pos, m ->> 'path', greatest(1, coalesce((m ->> 'width')::int, 1)), greatest(1, coalesce((m ->> 'height')::int, 1)));
      v_pos := v_pos + 1;
    end loop;

    if v_poll is not null then
      v_opts := v_poll -> 'options';
      if jsonb_typeof(v_opts) is distinct from 'array' or jsonb_array_length(v_opts) not between 2 and 4 then
        raise exception 'A enquete precisa de 2 a 4 opções.';
      end if;
      insert into public.polls (post_id, ends_at)
      values (v_id, now() + make_interval(hours => least(greatest(coalesce((v_poll ->> 'hours')::int, 24), 1), 168)));
      v_pos := 0;
      for o in select value from jsonb_array_elements(v_opts) loop
        if char_length(btrim(o #>> '{}')) not between 1 and 25 then
          raise exception 'Cada opção da enquete precisa ter de 1 a 25 caracteres.';
        end if;
        insert into public.poll_options (post_id, position, label) values (v_id, v_pos, btrim(o #>> '{}'));
        v_pos := v_pos + 1;
      end loop;
    end if;

    v_ids := v_ids || v_id;
    v_prev := v_id;
  end loop;

  return v_ids;
end $$;

-- Editar o texto nos primeiros 15 minutos (como no Threads)
create or replace function public.edit_post(p_post uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into p from public.posts where id = p_post;
  if not found or not public.owns_character(p.author_id) then
    raise exception 'Post não encontrado.';
  end if;
  if p.created_at < now() - interval '15 minutes' then
    raise exception 'Só dá para editar nos primeiros 15 minutos.';
  end if;
  if char_length(v_body) > 500 then
    raise exception 'O post pode ter até 500 caracteres.';
  end if;
  if v_body = '' and p.quote_id is null
     and not exists (select 1 from public.post_media m where m.post_id = p.id)
     and not exists (select 1 from public.polls pl where pl.post_id = p.id) then
    raise exception 'O post não pode ficar vazio.';
  end if;
  update public.posts set body = v_body, edited_at = now() where id = p.id;
  -- quem foi mencionado só agora recebe o aviso
  insert into public.notifications (recipient_id, actor_id, kind, post_id)
  select m, p.author_id, 'mencao', p.id
  from public.mentioned_characters(v_body) as m
  where m <> p.author_id
    and m not in (select public.mentioned_characters(p.body));
end $$;

-- Apagar um post (e as partes seguintes da sequência). Devolve as fotos
-- que precisam sair do Storage; o app apaga os arquivos em seguida.
create or replace function public.delete_post(p_post uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
  v_paths text[];
begin
  select * into p from public.posts where id = p_post;
  if not found then
    return '{}';
  end if;
  if not (public.owns_character(p.author_id) or public.is_admin()) then
    raise exception 'Você não pode apagar este post.' using errcode = '42501';
  end if;
  with recursive parts as (
    select p.id
    union all
    select c.id from public.posts c join parts on c.parent_id = parts.id
    where c.is_chain and c.author_id = p.author_id and (not p.is_reply or p.is_chain)
  )
  select coalesce(array_agg(m.path), '{}') into v_paths
  from public.post_media m where m.post_id in (select id from parts);
  delete from public.posts where id = p.id;
  return v_paths;
end $$;

-- Votar numa enquete; devolve a enquete atualizada
create or replace function public.vote(p_post uuid, p_option uuid, p_character uuid)
returns jsonb language plpgsql set search_path = '' as $$
begin
  insert into public.poll_votes (post_id, character_id, option_id)
  values (p_post, p_character, p_option)
  on conflict (post_id, character_id) do nothing;
  return public.post_json(p_post, p_character) -> 'poll';
end $$;

-- Usado pelo robô que mantém o Supabase acordado
create or replace function public.ping()
returns text language sql stable set search_path = '' as $$
  select 'ok'::text;
$$;


-- ---------------------------------------------------------------------
-- 6. Sincronização com o FargusGram (só a função "fargusgram" chama)
-- ---------------------------------------------------------------------

-- Recebe a lista completa de jogadores e personagens do FargusGram.
-- Quem saiu de lá sai daqui também (com tudo o que publicou, como no FargusGram).
create or replace function public.sync_from_gram(p_players jsonb, p_characters jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_removed uuid[];
begin
  if jsonb_typeof(p_players) is distinct from 'array' or jsonb_array_length(p_players) = 0 then
    raise exception 'Lista de jogadores vazia.';
  end if;
  if jsonb_typeof(p_characters) is distinct from 'array' then
    raise exception 'Lista de personagens inválida.';
  end if;

  insert into public.players (id, display_name, is_admin, synced_at)
  select x.id, coalesce(x.display_name, ''), coalesce(x.is_admin, false), now()
  from jsonb_to_recordset(p_players) as x(id uuid, display_name text, is_admin boolean)
  where x.id is not null
  on conflict (id) do update
    set display_name = excluded.display_name,
        is_admin = excluded.is_admin,
        synced_at = now();

  with gone as (
    delete from public.players p
    where not exists (select 1 from jsonb_to_recordset(p_players) as x(id uuid) where x.id = p.id)
    returning p.id
  )
  select coalesce(array_agg(id), '{}') into v_removed from gone;

  insert into public.characters (id, owner_id, handle, name, gram_bio, avatar_path, is_verified,
                                 follower_bonus, like_bonus, created_at, synced_at)
  select x.id, x.owner_id, lower(x.handle), coalesce(x.name, ''), coalesce(x.bio, ''), x.avatar_path,
         coalesce(x.is_verified, false), greatest(coalesce(x.follower_bonus, 0), 0), greatest(coalesce(x.like_bonus, 0), 0),
         coalesce(x.created_at, now()), now()
  from jsonb_to_recordset(p_characters) as x(
    id uuid, owner_id uuid, handle text, name text, bio text, avatar_path text,
    is_verified boolean, follower_bonus int, like_bonus int, created_at timestamptz)
  where x.id is not null and x.handle is not null
    and exists (select 1 from public.players p where p.id = x.owner_id)
  on conflict (id) do update
    set owner_id = excluded.owner_id,
        handle = excluded.handle,
        name = excluded.name,
        gram_bio = excluded.gram_bio,
        avatar_path = excluded.avatar_path,
        is_verified = excluded.is_verified,
        follower_bonus = excluded.follower_bonus,
        like_bonus = excluded.like_bonus,
        synced_at = now();

  delete from public.characters c
  where not exists (select 1 from jsonb_to_recordset(p_characters) as x(id uuid) where x.id = c.id);

  return jsonb_build_object(
    'removed_players', to_jsonb(v_removed),
    'players', (select count(*) from public.players),
    'characters', (select count(*) from public.characters)
  );
end $$;

-- "Seguir as mesmas contas do FargusGram": só para os personagens de p_owner,
-- sem avisar ninguém (como no Threads de verdade)
create or replace function public.import_follows(p_owner uuid, p_pairs jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  perform set_config('fargus.silencioso', 'on', true);
  insert into public.follows (follower_id, followee_id)
  select x.follower_id, x.followee_id
  from jsonb_to_recordset(coalesce(p_pairs, '[]'::jsonb)) as x(follower_id uuid, followee_id uuid)
  where x.follower_id <> x.followee_id
    and exists (select 1 from public.characters c where c.id = x.follower_id and c.owner_id = p_owner)
    and exists (select 1 from public.characters c where c.id = x.followee_id)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  perform set_config('fargus.silencioso', 'off', true);
  return v_n;
end $$;

-- Quem pode chamar o quê
revoke execute on function
  public.sync_from_gram(jsonb, jsonb), public.import_follows(uuid, jsonb),
  public.tg_posts_before_insert(), public.tg_posts_after_insert(), public.tg_posts_before_delete(),
  public.tg_posts_after_delete(), public.tg_likes(), public.tg_reposts(), public.tg_follows(),
  public.tg_poll_votes_before(), public.tg_poll_votes_after()
from public, anon, authenticated;
grant execute on function public.sync_from_gram(jsonb, jsonb), public.import_follows(uuid, jsonb) to service_role;

revoke execute on function
  public.me(), public.all_characters(), public.feed(uuid, text, timestamptz, int),
  public.thread_view(uuid, uuid), public.profile(text, uuid),
  public.profile_posts(uuid, uuid, text, timestamptz, int), public.topic_posts(text, uuid, timestamptz, int),
  public.saved_posts(uuid, timestamptz, int),
  public.search(text, uuid), public.suggestions(uuid), public.follow_list(uuid, text, uuid),
  public.post_activity(uuid, text, uuid), public.activity(uuid, text, timestamptz, int),
  public.unread_counts(), public.mark_activity_read(uuid),
  public.create_thread(uuid, jsonb, uuid, uuid, text, text), public.edit_post(uuid, text),
  public.delete_post(uuid), public.vote(uuid, uuid, uuid),
  public.post_json(uuid, uuid), public.post_core_json(uuid, uuid), public.char_json(public.characters),
  public.is_member(), public.is_admin(), public.owns_character(uuid), public.mentioned_characters(text),
  public.can_reply(uuid, uuid), public.like_bonus(uuid, int)
from public, anon;
grant execute on function
  public.me(), public.all_characters(), public.feed(uuid, text, timestamptz, int),
  public.thread_view(uuid, uuid), public.profile(text, uuid),
  public.profile_posts(uuid, uuid, text, timestamptz, int), public.topic_posts(text, uuid, timestamptz, int),
  public.saved_posts(uuid, timestamptz, int),
  public.search(text, uuid), public.suggestions(uuid), public.follow_list(uuid, text, uuid),
  public.post_activity(uuid, text, uuid), public.activity(uuid, text, timestamptz, int),
  public.unread_counts(), public.mark_activity_read(uuid),
  public.create_thread(uuid, jsonb, uuid, uuid, text, text), public.edit_post(uuid, text),
  public.delete_post(uuid), public.vote(uuid, uuid, uuid),
  public.post_json(uuid, uuid), public.post_core_json(uuid, uuid), public.char_json(public.characters),
  public.is_member(), public.is_admin(), public.owns_character(uuid), public.mentioned_characters(text),
  public.can_reply(uuid, uuid), public.like_bonus(uuid, int)
to authenticated, service_role;
grant execute on function public.ping() to anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- 7. Fotos (Storage): bucket público "midia"
--    Cada jogador só envia arquivos para a própria pasta.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midia', 'midia', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists threads_midia_select on storage.objects;
create policy threads_midia_select on storage.objects for select to authenticated
  using (bucket_id = 'midia' and (select public.is_member()));

drop policy if exists threads_midia_insert on storage.objects;
create policy threads_midia_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'midia'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.is_member())
  );

drop policy if exists threads_midia_delete on storage.objects;
create policy threads_midia_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'midia'
    and ((storage.foldername(name))[1] = (select auth.uid()::text) or (select public.is_admin()))
  );


-- Recarrega a API para enxergar as funções novas
notify pgrst, 'reload schema';

select 'FargusThreads: banco configurado com sucesso ✔' as resultado;
