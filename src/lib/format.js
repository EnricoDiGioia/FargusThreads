const nf = new Intl.NumberFormat('pt-BR');
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const dayMonthYear = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function count(n) {
  n = Number(n) || 0;
  return n < 10000 ? nf.format(n) : compact.format(n);
}

export function plural(n, one, many) {
  return `${count(n)} ${Number(n) === 1 ? one : many}`;
}

function diffSeconds(date) {
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
}

// Como no Threads: "agora", "5 min", "3 h", "2 d", depois a data "12/03"
export function timeShort(date) {
  const s = diffSeconds(date);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  const d = new Date(date);
  return d.getFullYear() === new Date().getFullYear() ? dayMonth.format(d) : dayMonthYear.format(d);
}

export function fullDateTime(date) {
  return longDate.format(new Date(date));
}

// Quanto falta para a enquete terminar
export function timeLeft(date) {
  const s = (new Date(date).getTime() - Date.now()) / 1000;
  if (s <= 0) return 'Encerrada';
  if (s < 3600) return `${Math.max(1, Math.ceil(s / 60))} min restantes`;
  if (s < 86400) return `${Math.ceil(s / 3600)} h restantes`;
  const d = Math.ceil(s / 86400);
  return `${d} ${d === 1 ? 'dia restante' : 'dias restantes'}`;
}

export function activityBucket(date) {
  const s = diffSeconds(date);
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoje';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ontem';
  if (s < 7 * 86400) return 'Últimos 7 dias';
  if (s < 30 * 86400) return 'Últimos 30 dias';
  return 'Anteriores';
}

// Deixa o link clicável mesmo sem http:// ("fargus.wiki" → "https://fargus.wiki")
export function linkHref(link) {
  const v = String(link || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function linkLabel(link) {
  return String(link || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}
