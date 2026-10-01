// Mudanças feitas neste aparelho (curtir, repostar, salvar, votar, editar,
// apagar) valem na hora em todas as telas que mostram o mesmo post.
import { useSyncExternalStore } from 'react';

const patches = new Map(); // id do post -> campos mudados
const listeners = new Set();
let version = 0;

function notify() {
  version++;
  listeners.forEach((fn) => fn());
}

export function patchPost(id, fields) {
  if (!id) return;
  patches.set(id, { ...(patches.get(id) || {}), ...fields });
  notify();
}

export function clearPostPatches() {
  patches.clear();
  notify();
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const getVersion = () => version;

// Post com as mudanças locais por cima (o citado também)
export function usePost(post) {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  if (!post) return post;
  const own = patches.get(post.id);
  const quote = post.quote && patches.get(post.quote.id);
  if (!own && !quote) return post;
  const out = own ? { ...post, ...own } : { ...post };
  if (quote) out.quote = { ...post.quote, ...quote };
  return out;
}

export function isDeleted(id) {
  return !!patches.get(id)?.deleted;
}
