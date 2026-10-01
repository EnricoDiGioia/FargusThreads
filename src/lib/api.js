import { supabase } from './supabase';

// Mensagem em português para qualquer erro do Supabase / da rede
export function errorMessage(err) {
  if (!err) return 'Algo deu errado.';
  const msg = String(err.message || err.error_description || err.msg || err || '');
  const code = err.code || '';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return 'Sem conexão. Confira a internet e tente de novo.';
  }
  if (code === 'PGRST202' || /could not find the function/i.test(msg)) {
    return 'O banco do FargusThreads está desatualizado: rode o supabase/setup.sql de novo no SQL Editor.';
  }
  if (/jwt expired|invalid jwt|refresh token/i.test(msg)) return 'Sua sessão expirou. Entre de novo.';
  if (code === '23505' || /duplicate key/i.test(msg)) return 'Isso já foi feito.';
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) return 'A foto é grande demais.';
  if (/row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para isso.';
  return msg || 'Algo deu errado.';
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------
// Conta e personagens
// ---------------------------------------------------------------------
export const me = () => rpc('me');
export const allCharacters = () => rpc('all_characters');

export async function updateProfile(id, { bio, link }) {
  const { error } = await supabase
    .from('characters')
    .update({ bio: bio === null ? null : String(bio).trim().slice(0, 150), link: String(link || '').trim().slice(0, 200) })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------
export const PAGE = 15;
export const feed = (viewer, tab, before) =>
  rpc('feed', { p_viewer: viewer, p_tab: tab, p_before: before ?? null, p_limit: PAGE });
export const threadView = (post, viewer) => rpc('thread_view', { p_post: post, p_viewer: viewer });
export const profile = (handle, viewer) => rpc('profile', { p_handle: handle, p_viewer: viewer });
export const profilePosts = (character, viewer, tab, before) =>
  rpc('profile_posts', { p_character: character, p_viewer: viewer, p_tab: tab, p_before: before ?? null, p_limit: PAGE });
export const topicPosts = (topic, viewer, before) =>
  rpc('topic_posts', { p_topic: topic, p_viewer: viewer, p_before: before ?? null, p_limit: PAGE });
export const savedPosts = (character, before) =>
  rpc('saved_posts', { p_character: character, p_before: before ?? null, p_limit: PAGE });
export const search = (query, viewer) => rpc('search', { p_query: query, p_viewer: viewer });
export const suggestions = (viewer) => rpc('suggestions', { p_viewer: viewer });
export const followList = (character, kind, viewer) =>
  rpc('follow_list', { p_character: character, p_kind: kind, p_viewer: viewer });
export const postActivity = (post, kind, viewer) => rpc('post_activity', { p_post: post, p_kind: kind, p_viewer: viewer });
export const activity = (character, filter, before) =>
  rpc('activity', { p_character: character, p_filter: filter, p_before: before ?? null, p_limit: 30 });
export const unreadCounts = () => rpc('unread_counts');
export const markActivityRead = (character) => rpc('mark_activity_read', { p_character: character });

// ---------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------
export const createThread = ({ author, parts, parent = null, quote = null, topic = null, replyPolicy = 'todos' }) =>
  rpc('create_thread', {
    p_author: author,
    p_parts: parts,
    p_parent: parent,
    p_quote: quote,
    p_topic: topic,
    p_reply_policy: replyPolicy,
  });

export const editPost = (post, body) => rpc('edit_post', { p_post: post, p_body: body });

export async function deletePost(post) {
  const paths = await rpc('delete_post', { p_post: post });
  if (paths?.length) await removePhotos(paths);
}

export const vote = (post, option, character) => rpc('vote', { p_post: post, p_option: option, p_character: character });

async function toggle(table, row, on) {
  if (on) {
    const { error } = await supabase.from(table).insert(row);
    if (error && error.code !== '23505') throw error;
  } else {
    let q = supabase.from(table).delete();
    for (const [k, v] of Object.entries(row)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
  }
}

export const setLike = (post, character, on) => toggle('likes', { post_id: post, character_id: character }, on);
export const setRepost = (post, character, on) => toggle('reposts', { post_id: post, character_id: character }, on);
export const setSave = (post, character, on) => toggle('saves', { post_id: post, character_id: character }, on);
export const setFollow = (follower, followee, on) => toggle('follows', { follower_id: follower, followee_id: followee }, on);

// ---------------------------------------------------------------------
// Fotos (bucket "midia", pasta do jogador)
// ---------------------------------------------------------------------
export async function uploadPhoto(uid, blob) {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${uid}/${id}.jpg`;
  const { error } = await supabase.storage
    .from('midia')
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return path;
}

export async function removePhotos(paths) {
  if (!paths?.length) return;
  await supabase.storage
    .from('midia')
    .remove(paths)
    .catch(() => {});
}
