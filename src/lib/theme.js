// Tema: automático (segue o celular), claro ou escuro
import { local } from './storage';

const KEY = 'ft-theme';

export function getTheme() {
  const t = local.get(KEY);
  return t === 'light' || t === 'dark' ? t : 'auto';
}

function systemDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(t = getTheme()) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  const dark = t === 'dark' || (t === 'auto' && systemDark());
  const color = dark ? '#101010' : '#ffffff';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (t === 'auto') {
      m.setAttribute('content', m.media?.includes('dark') ? '#101010' : '#ffffff');
    } else {
      m.setAttribute('content', color);
    }
  });
}

export function setTheme(t) {
  local.set(KEY, t === 'auto' ? null : t);
  applyTheme(t);
}
