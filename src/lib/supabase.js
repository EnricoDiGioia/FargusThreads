import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL as RAW_URL, SUPABASE_KEY as RAW_KEY, GRAM_URL as RAW_GRAM_URL, GRAM_KEY as RAW_GRAM_KEY } from '../config';

// Aceita a URL copiada com barra no fim ou com /rest/v1 (acontece bastante)
const cleanUrl = (u) =>
  String(u || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(rest|auth|storage|functions)\/v1$/, '');

export const SUPABASE_URL = cleanUrl(RAW_URL);
export const SUPABASE_KEY = String(RAW_KEY || '').trim();
export const GRAM_URL = cleanUrl(RAW_GRAM_URL);
export const GRAM_KEY = String(RAW_GRAM_KEY || '').trim();

const valid = (url, key) => /^https?:\/\//.test(url) && !url.includes('SEU-PROJETO') && key && !key.startsWith('COLE-AQUI');

export const isConfigured = valid(SUPABASE_URL, SUPABASE_KEY) && valid(GRAM_URL, GRAM_KEY);

// Supabase do FargusThreads: posts, curtidas, seguidores, fotos...
export const supabase = createClient(isConfigured ? SUPABASE_URL : 'http://localhost', isConfigured ? SUPABASE_KEY : 'x', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'fargusthreads-auth',
  },
});

// Supabase do FargusGram: só o login e a lista de personagens.
// Sessão própria do FargusThreads (não mexe na do FargusGram aberto no mesmo navegador).
export const gram = createClient(isConfigured ? GRAM_URL : 'http://localhost', isConfigured ? GRAM_KEY : 'x', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'fargusthreads-gram-auth',
  },
});

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

// Foto de um post (bucket "midia" do FargusThreads)
export function mediaUrl(path) {
  if (!path) return null;
  if (/^(blob:|data:|https?:)/.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/midia/${encodePath(path)}`;
}

// Foto de perfil: vem do FargusGram (bucket "media" de lá)
export function avatarUrl(path) {
  if (!path) return null;
  if (/^(blob:|data:|https?:)/.test(path)) return path;
  return `${GRAM_URL}/storage/v1/object/public/media/${encodePath(path)}`;
}
