-- Testes do banco (rodar num Postgres local, depois do supabase-shim.sql e do setup.sql)
\set ON_ERROR_STOP 1
\set QUIET 1
\pset pager off

create or replace function public.t_check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant execute on function public.t_check(boolean, text) to authenticated, anon;

create or replace function public.t_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;
grant execute on function public.t_as(uuid) to authenticated, anon, service_role;

-- usuários de login (a função cria no Supabase de verdade)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'enrico@x.com'),
  ('22222222-2222-2222-2222-222222222222', 'amigo@x.com'),
  ('33333333-3333-3333-3333-333333333333', 'intruso@x.com')
on conflict do nothing;

-- ===== sincronização (como a função faz, com o papel service_role) =====
set role service_role;
select public.t_check(
  (public.sync_from_gram(
    '[{"id":"11111111-1111-1111-1111-111111111111","display_name":"Enrico","is_admin":true},
      {"id":"22222222-2222-2222-2222-222222222222","display_name":"Amigo","is_admin":false},
      {"id":"44444444-4444-4444-4444-444444444444","display_name":"Sumido","is_admin":false}]',
    '[{"id":"aaaaaaaa-0000-0000-0000-000000000001","owner_id":"11111111-1111-1111-1111-111111111111","handle":"kael","name":"Kael","bio":"Bio do Gram","avatar_path":"1111/av.jpg","is_verified":true,"follower_bonus":1000,"like_bonus":50},
      {"id":"aaaaaaaa-0000-0000-0000-000000000002","owner_id":"11111111-1111-1111-1111-111111111111","handle":"npc_mestre","name":"Mestre","bio":"","avatar_path":null,"is_verified":false},
      {"id":"aaaaaaaa-0000-0000-0000-000000000003","owner_id":"22222222-2222-2222-2222-222222222222","handle":"lyra","name":"Lyra","bio":"Arqueira","avatar_path":null,"is_verified":false},
      {"id":"aaaaaaaa-0000-0000-0000-000000000004","owner_id":"44444444-4444-4444-4444-444444444444","handle":"sumido","name":"Sumido","bio":"","avatar_path":null,"is_verified":false}]'
  ) ->> 'characters')::int = 4, 'sincronizou 4 personagens');

-- troca de @ entre dois personagens na mesma sincronização (restrição adiada)
select public.sync_from_gram(
  '[{"id":"11111111-1111-1111-1111-111111111111","display_name":"Enrico","is_admin":true},
    {"id":"22222222-2222-2222-2222-222222222222","display_name":"Amigo","is_admin":false},
    {"id":"44444444-4444-4444-4444-444444444444","display_name":"Sumido","is_admin":false}]',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000001","owner_id":"11111111-1111-1111-1111-111111111111","handle":"npc_mestre","name":"Kael","bio":"Bio do Gram","avatar_path":"1111/av.jpg","is_verified":true,"follower_bonus":1000,"like_bonus":50},
    {"id":"aaaaaaaa-0000-0000-0000-000000000002","owner_id":"11111111-1111-1111-1111-111111111111","handle":"kael","name":"Mestre","bio":"","avatar_path":null,"is_verified":false},
    {"id":"aaaaaaaa-0000-0000-0000-000000000003","owner_id":"22222222-2222-2222-2222-222222222222","handle":"lyra","name":"Lyra","bio":"Arqueira","avatar_path":null,"is_verified":false},
    {"id":"aaaaaaaa-0000-0000-0000-000000000004","owner_id":"44444444-4444-4444-4444-444444444444","handle":"sumido","name":"Sumido","bio":"","avatar_path":null,"is_verified":false}]'
);
-- e destroca
select public.sync_from_gram(
  '[{"id":"11111111-1111-1111-1111-111111111111","display_name":"Enrico","is_admin":true},
    {"id":"22222222-2222-2222-2222-222222222222","display_name":"Amigo","is_admin":false},
    {"id":"44444444-4444-4444-4444-444444444444","display_name":"Sumido","is_admin":false}]',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000001","owner_id":"11111111-1111-1111-1111-111111111111","handle":"kael","name":"Kael","bio":"Bio do Gram","avatar_path":"1111/av.jpg","is_verified":true,"follower_bonus":1000,"like_bonus":50},
    {"id":"aaaaaaaa-0000-0000-0000-000000000002","owner_id":"11111111-1111-1111-1111-111111111111","handle":"npc_mestre","name":"Mestre","bio":"","avatar_path":null,"is_verified":false},
    {"id":"aaaaaaaa-0000-0000-0000-000000000003","owner_id":"22222222-2222-2222-2222-222222222222","handle":"lyra","name":"Lyra","bio":"Arqueira","avatar_path":null,"is_verified":false},
    {"id":"aaaaaaaa-0000-0000-0000-000000000004","owner_id":"44444444-4444-4444-4444-444444444444","handle":"sumido","name":"Sumido","bio":"","avatar_path":null,"is_verified":false}]'
);
reset role;
select public.t_check((select handle from public.characters where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'kael', 'troca de @ funcionou');

-- quem não é service_role não sincroniza
select public.t_as('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$ begin
  perform public.sync_from_gram('[]', '[]');
  raise exception 'FALHOU: authenticated conseguiu sincronizar';
exception when insufficient_privilege then raise notice 'ok - authenticated não sincroniza';
end $$;

-- ===== me() e acesso =====
select public.t_check(jsonb_array_length(public.me() -> 'characters') = 2, 'me() traz os 2 personagens do Enrico');
select public.t_check((public.me() ->> 'is_admin')::boolean, 'Enrico é admin');
select public.t_check((select x ->> 'bio' from jsonb_array_elements(public.me() -> 'characters') x where x ->> 'handle' = 'kael') = 'Bio do Gram', 'bio vem do FargusGram');

-- personagem: só bio e link mudam
update public.characters set bio = 'Bio só do Threads', link = 'fargus.wiki' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.t_check((select bio from public.characters where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Bio só do Threads', 'dono muda a bio');
do $$ begin
  update public.characters set is_verified = true where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  raise exception 'FALHOU: mudou is_verified';
exception when insufficient_privilege then raise notice 'ok - não muda selo';
end $$;
update public.characters set bio = 'hack' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select public.t_check((select bio from public.characters where id = 'aaaaaaaa-0000-0000-0000-000000000003') is null, 'não muda bio dos outros');

-- intruso (login sem jogador) não vê nada
reset role;
select public.t_as('33333333-3333-3333-3333-333333333333');
set role authenticated;
select public.t_check(public.me() is null, 'intruso: me() vazio');
select public.t_check((select count(*) from public.characters) = 0, 'intruso não vê personagens');
do $$ begin
  perform public.create_thread('aaaaaaaa-0000-0000-0000-000000000001', '[{"body":"oi"}]');
  raise exception 'FALHOU: intruso publicou';
exception when insufficient_privilege then raise notice 'ok - intruso não publica';
end $$;

-- ===== publicar =====
reset role;
select public.t_as('11111111-1111-1111-1111-111111111111');
set role authenticated;

-- não publica com personagem dos outros
do $$ begin
  perform public.create_thread('aaaaaaaa-0000-0000-0000-000000000003', '[{"body":"oi"}]');
  raise exception 'FALHOU: publicou como outro';
exception when insufficient_privilege then raise notice 'ok - não publica como o personagem dos outros';
end $$;

-- sequência de 3 partes com foto, enquete e tópico
select (public.create_thread(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '[{"body":"Primeira parte, @lyra veja","media":[{"path":"11111111-1111-1111-1111-111111111111/a.jpg","width":1080,"height":1350}]},
    {"body":"Segunda parte"},
    {"body":"Qual caminho?","poll":{"options":["Norte","Sul","Leste"],"hours":24}}]',
  null, null, '#Torre de Fargus', 'todos'))[1] as root \gset
select public.t_check((select count(*) from public.posts where root_id = :'root' and is_chain) = 2, 'sequência: 2 partes encadeadas');
select public.t_check((select topic from public.posts where id = :'root') = 'Torre de Fargus', 'tópico sem #');
select public.t_check((public.post_json(:'root', 'aaaaaaaa-0000-0000-0000-000000000001') ->> 'chain')::int = 2, 'post_json conta a sequência');
select public.t_check((select reply_count from public.posts where id = :'root') = 0, 'sequência não conta como resposta');

-- foto fora da pasta do jogador é recusada
do $$ begin
  perform public.create_thread('aaaaaaaa-0000-0000-0000-000000000001', '[{"body":"x","media":[{"path":"22222222-2222-2222-2222-222222222222/a.jpg","width":1,"height":1}]}]');
  raise exception 'FALHOU: aceitou foto de outra pasta';
exception when raise_exception then raise notice 'ok - foto de outra pasta recusada';
end $$;
do $$ begin
  perform public.create_thread('aaaaaaaa-0000-0000-0000-000000000001', '[{"body":"   "}]');
  raise exception 'FALHOU: aceitou post vazio';
exception when raise_exception then raise notice 'ok - post vazio recusado';
end $$;

-- post só para quem eu sigo responder
select (public.create_thread('aaaaaaaa-0000-0000-0000-000000000002', '[{"body":"Só seguidos respondem"}]', null, null, null, 'seguidos'))[1] as fechado \gset

-- ===== amigo interage =====
reset role;
select public.t_as('22222222-2222-2222-2222-222222222222');
set role authenticated;
select public.t_check(jsonb_array_length(public.feed('aaaaaaaa-0000-0000-0000-000000000003', 'para_voce')) = 2, 'feed para você: 2 posts (as partes não aparecem)');
select public.t_check(jsonb_array_length(public.feed('aaaaaaaa-0000-0000-0000-000000000003', 'seguindo')) = 0, 'feed seguindo vazio');

insert into public.follows (follower_id, followee_id) values ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001');
select public.t_check(jsonb_array_length(public.feed('aaaaaaaa-0000-0000-0000-000000000003', 'seguindo')) = 1, 'feed seguindo mostra quem sigo');

insert into public.likes (post_id, character_id) values (:'root', 'aaaaaaaa-0000-0000-0000-000000000003');
insert into public.reposts (post_id, character_id) values (:'root', 'aaaaaaaa-0000-0000-0000-000000000003');
select (public.create_thread('aaaaaaaa-0000-0000-0000-000000000003', '[{"body":"Boa, @kael!"}]', :'root'))[1] as resp \gset
select (public.create_thread('aaaaaaaa-0000-0000-0000-000000000003', '[{"body":"Olhem isso"}]', null, :'root'))[1] as cit \gset

-- não pode responder o post só para seguidos (o npc_mestre não segue a lyra)
do $$ begin
  perform public.create_thread('aaaaaaaa-0000-0000-0000-000000000003', '[{"body":"posso?"}]', (select id from public.posts where body = 'Só seguidos respondem'));
  raise exception 'FALHOU: respondeu post fechado';
exception when insufficient_privilege then raise notice 'ok - não responde post só para seguidos';
end $$;
select public.t_check(not (public.post_json((select id from public.posts where body = 'Só seguidos respondem'), 'aaaaaaaa-0000-0000-0000-000000000003') ->> 'can_reply')::boolean, 'can_reply falso para quem não é seguido');

-- votar
select o.id as opt from public.poll_options o join public.posts p on p.id = o.post_id where p.body = 'Qual caminho?' and o.label = 'Sul' \gset
select (select id from public.posts where body = 'Qual caminho?') as pollpost \gset
select public.t_check((public.vote(:'pollpost', :'opt', 'aaaaaaaa-0000-0000-0000-000000000003') ->> 'total')::int = 1, 'voto contado');
select public.t_check((public.vote(:'pollpost', :'opt', 'aaaaaaaa-0000-0000-0000-000000000003') ->> 'total')::int = 1, 'segundo voto ignorado');
do $$ begin
  perform public.vote((select id from public.posts where body = 'Qual caminho?'), (select id from public.poll_options where label = 'Norte'), 'aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'FALHOU: votou como outro';
exception when insufficient_privilege then raise notice 'ok - não vota como outro';
end $$;

-- salvar é secreto
insert into public.saves (post_id, character_id) values (:'root', 'aaaaaaaa-0000-0000-0000-000000000003');
select public.t_check(jsonb_array_length(public.saved_posts('aaaaaaaa-0000-0000-0000-000000000003')) = 1, 'meus salvos');

-- não curte como outro
do $$ begin
  insert into public.likes (post_id, character_id) values ((select id from public.posts where body = 'Segunda parte'), 'aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'FALHOU: curtiu como outro';
exception when insufficient_privilege then raise notice 'ok - não curte como outro';
end $$;

-- ===== de volta ao Enrico: contadores, atividade, conversa =====
reset role;
select public.t_as('11111111-1111-1111-1111-111111111111');
set role authenticated;
select public.post_json(:'root', 'aaaaaaaa-0000-0000-0000-000000000001') as pj \gset
select public.t_check((:'pj'::jsonb ->> 'replies')::int = 1, 'contador de respostas');
select public.t_check((:'pj'::jsonb ->> 'reposts')::int = 1, 'contador de reposts');
select public.t_check((:'pj'::jsonb ->> 'quotes')::int = 1, 'contador de citações');
select public.t_check((:'pj'::jsonb ->> 'likes')::int between 36 and 86, 'curtidas com o extra de famoso (1 + 35..65)');
select public.t_check(not (:'pj'::jsonb ->> 'saved')::boolean, 'salvo do amigo não aparece para mim');
select public.t_check((select count(*) from public.saves) = 0, 'não vejo os salvos dos outros');
select public.t_check(jsonb_array_length(public.saved_posts('aaaaaaaa-0000-0000-0000-000000000003')) = 0, 'não vejo a lista de salvos dos outros');
select public.t_check((select count(*) from public.poll_votes) = 0, 'não vejo os votos dos outros');

select public.t_check((public.unread_counts() ->> 'aaaaaaaa-0000-0000-0000-000000000001')::int = 5,
  'kael: curtida, repost, resposta, citação, seguiu (a menção vai junto da resposta)');
select public.t_check(jsonb_array_length(public.activity('aaaaaaaa-0000-0000-0000-000000000001', 'respostas')) = 1, 'filtro de respostas');
select public.t_check(public.activity('aaaaaaaa-0000-0000-0000-000000000001') -> 0 -> 'actor' ->> 'handle' = 'lyra', 'atividade traz quem fez');
select public.t_check(jsonb_array_length(public.activity('aaaaaaaa-0000-0000-0000-000000000003')) = 0, 'não vejo a atividade dos outros');
select public.mark_activity_read('aaaaaaaa-0000-0000-0000-000000000001');
select public.t_check((public.unread_counts() ->> 'aaaaaaaa-0000-0000-0000-000000000001')::int = 0, 'marcou como lido');

select public.thread_view(:'root', 'aaaaaaaa-0000-0000-0000-000000000001') as tv \gset
select public.t_check(jsonb_array_length(:'tv'::jsonb -> 'chain') = 2, 'conversa: sequência');
select public.t_check(jsonb_array_length(:'tv'::jsonb -> 'replies') = 1, 'conversa: respostas');
select public.t_check(jsonb_array_length(:'tv'::jsonb -> 'ancestors') = 0, 'conversa: sem antecessores');
select public.thread_view(:'resp', 'aaaaaaaa-0000-0000-0000-000000000001') as tv2 \gset
select public.t_check(jsonb_array_length(:'tv2'::jsonb -> 'ancestors') = 1, 'resposta mostra o post de cima');
select public.t_check((:'tv2'::jsonb -> 'post' -> 'reply_to' ->> 'handle') = 'kael', 'respondendo a @kael');
select public.thread_view((select id from public.posts where body = 'Segunda parte'), 'aaaaaaaa-0000-0000-0000-000000000001') as tv3 \gset
select public.t_check(jsonb_array_length(:'tv3'::jsonb -> 'ancestors') = 1 and jsonb_array_length(:'tv3'::jsonb -> 'chain') = 1, 'parte do meio: 1 antes e 1 depois');

select public.profile('@KAEL', 'aaaaaaaa-0000-0000-0000-000000000001') as pr \gset
select public.t_check((:'pr'::jsonb ->> 'followers')::int = 1001, 'seguidores com o extra');
select public.t_check((:'pr'::jsonb ->> 'is_mine')::boolean, 'perfil é meu');
select public.t_check((:'pr'::jsonb ->> 'bio') = 'Bio só do Threads', 'bio própria tem prioridade');
select public.t_check(jsonb_array_length(public.profile_posts('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'respostas')) = 1, 'aba respostas');
select public.t_check(public.profile_posts('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'respostas') -> 0 -> 'context' ->> 'id' = :'root', 'resposta vem com o post de cima');
select public.t_check(jsonb_array_length(public.profile_posts('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'reposts')) = 1, 'aba reposts');
select public.t_check(jsonb_array_length(public.profile_posts('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'midia')) = 1, 'aba mídia');
select public.t_check(jsonb_array_length(public.topic_posts('torre de fargus', 'aaaaaaaa-0000-0000-0000-000000000001')) = 1, 'tópico');
select (public.create_thread('aaaaaaaa-0000-0000-0000-000000000002', '[{"body":"Notícia sobre a #TorreDeFargus hoje"}]'))[1] as hashpost \gset
select public.t_check(jsonb_array_length(public.topic_posts('TorreDeFargus', 'aaaaaaaa-0000-0000-0000-000000000001')) = 2, 'tópico junta o tópico e o #hashtag do texto');
select public.delete_post(:'hashpost');

select public.search('lyr', 'aaaaaaaa-0000-0000-0000-000000000001') as sr \gset
select public.t_check(jsonb_array_length(:'sr'::jsonb -> 'people') = 1, 'busca de pessoas');
select public.t_check(jsonb_array_length(public.search('npc_', 'aaaaaaaa-0000-0000-0000-000000000001') -> 'people') = 1, 'busca com _ não vira curinga');
select public.t_check(jsonb_array_length(public.search('torre', 'aaaaaaaa-0000-0000-0000-000000000001') -> 'topics') = 1, 'busca de tópicos');
select public.t_check(jsonb_array_length(public.search('olhem', 'aaaaaaaa-0000-0000-0000-000000000001') -> 'posts') = 1, 'busca de posts');
select public.t_check(jsonb_array_length(public.suggestions('aaaaaaaa-0000-0000-0000-000000000001')) = 3, 'sugestões');
select public.t_check(jsonb_array_length(public.post_activity(:'root', 'curtidas', 'aaaaaaaa-0000-0000-0000-000000000001')) = 1, 'quem curtiu');
select public.t_check(jsonb_array_length(public.post_activity(:'root', 'citacoes', 'aaaaaaaa-0000-0000-0000-000000000001')) = 1, 'quem citou');
select public.t_check(jsonb_array_length(public.follow_list('aaaaaaaa-0000-0000-0000-000000000001', 'seguidores', 'aaaaaaaa-0000-0000-0000-000000000001')) = 1, 'lista de seguidores');
select public.t_check(public.post_json(:'cit', 'aaaaaaaa-0000-0000-0000-000000000001') -> 'quote' ->> 'id' = :'root', 'citação traz o post citado');

-- editar
select public.edit_post(:'root', 'Primeira parte editada, @lyra e @npc_mestre');
select public.t_check((select edited_at is not null from public.posts where id = :'root'), 'editado');
reset role;
update public.posts set created_at = now() - interval '20 minutes' where id = :'root';
set role authenticated;
do $$ begin
  perform public.edit_post((select id from public.posts where body like 'Primeira parte editada%'), 'tarde demais');
  raise exception 'FALHOU: editou depois de 15 min';
exception when raise_exception then raise notice 'ok - não edita depois de 15 minutos';
end $$;

-- apagar a primeira parte apaga a sequência e devolve as fotos
reset role;
select public.t_as('22222222-2222-2222-2222-222222222222');
set role authenticated;
do $$ begin
  perform public.delete_post((select id from public.posts where body like 'Primeira parte editada%'));
  raise exception 'FALHOU: apagou post dos outros';
exception when insufficient_privilege then raise notice 'ok - não apaga post dos outros';
end $$;
reset role;
select public.t_as('11111111-1111-1111-1111-111111111111');
set role authenticated;
select public.t_check(public.delete_post(:'root') = array['11111111-1111-1111-1111-111111111111/a.jpg'], 'apagar devolve as fotos');
select public.t_check((select count(*) from public.posts where body in ('Segunda parte', 'Qual caminho?')) = 0, 'partes seguintes apagadas');
select public.t_check((select count(*) from public.posts where id = :'resp') = 1, 'resposta de outro continua');
select public.t_check(public.post_json(:'resp', 'aaaaaaaa-0000-0000-0000-000000000001') -> 'reply_to' = 'null'::jsonb, 'resposta sem post de cima');
select public.t_check(public.post_json(:'cit', 'aaaaaaaa-0000-0000-0000-000000000001') -> 'quote' = 'null'::jsonb, 'citação sem post citado');

-- admin apaga post de outro
select public.t_check(public.delete_post(:'cit') = '{}', 'admin apaga post de outro');

-- ===== importar quem segue no FargusGram =====
reset role;
set role service_role;
select public.t_check(public.import_follows('11111111-1111-1111-1111-111111111111',
  '[{"follower_id":"aaaaaaaa-0000-0000-0000-000000000001","followee_id":"aaaaaaaa-0000-0000-0000-000000000003"},
    {"follower_id":"aaaaaaaa-0000-0000-0000-000000000003","followee_id":"aaaaaaaa-0000-0000-0000-000000000002"},
    {"follower_id":"aaaaaaaa-0000-0000-0000-000000000002","followee_id":"aaaaaaaa-0000-0000-0000-000000000003"}]') = 2,
  'importa só para os personagens do jogador');
select public.t_check((select count(*) from public.notifications where kind = 'seguiu' and recipient_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 0, 'importação não avisa');
insert into public.follows (follower_id, followee_id) values ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003');
select public.t_check((select count(*) from public.notifications where kind = 'seguiu' and recipient_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 1, 'seguir normal avisa');

-- ===== quem saiu do FargusGram sai daqui =====
select public.t_check(public.sync_from_gram(
  '[{"id":"11111111-1111-1111-1111-111111111111","display_name":"Enrico","is_admin":true},
    {"id":"22222222-2222-2222-2222-222222222222","display_name":"Amigo","is_admin":false}]',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000001","owner_id":"11111111-1111-1111-1111-111111111111","handle":"kael","name":"Kael","bio":"Bio do Gram","avatar_path":"1111/av.jpg","is_verified":true,"follower_bonus":1000,"like_bonus":50},
    {"id":"aaaaaaaa-0000-0000-0000-000000000003","owner_id":"22222222-2222-2222-2222-222222222222","handle":"lyra","name":"Lyra","bio":"Arqueira","avatar_path":null,"is_verified":false}]'
) -> 'removed_players' ->> 0 = '44444444-4444-4444-4444-444444444444', 'jogador removido');
reset role;
select public.t_check((select count(*) from public.characters) = 2, 'personagens removidos (inclusive o NPC apagado no FargusGram)');
select public.t_check((select bio from public.characters where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Bio só do Threads', 'bio própria sobrevive à sincronização');

-- anon não chama nada além do ping
set role anon;
select public.t_check(public.ping() = 'ok', 'ping para o robô');
do $$ begin
  perform public.feed(null);
  raise exception 'FALHOU: anon chamou o feed';
exception when insufficient_privilege then raise notice 'ok - anon não chama o feed';
end $$;
reset role;

select 'TODOS OS TESTES PASSARAM' as resultado;
