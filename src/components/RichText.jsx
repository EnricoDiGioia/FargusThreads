import { Fragment } from 'react';
import { Link } from 'react-router';

const TOKEN = /(@[A-Za-z0-9._]{2,30})|((?:https?:\/\/|www\.)[^\s<]+)|(#[\p{L}\p{N}_]{2,50})/gu;

// Texto do post com @menções, links e #tópicos clicáveis
export default function RichText({ text, className = '' }) {
  if (!text) return null;
  const out = [];
  let last = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    const start = m.index;
    let token = m[0];
    // pontuação no fim não faz parte ("@kael." / "site.com,")
    const trail = token.match(/[.,;:!?)\]]+$/);
    if (trail && !m[3]) token = token.slice(0, -trail[0].length);
    if (start > last) out.push(text.slice(last, start));
    if (m[1]) {
      const handle = token.slice(1).toLowerCase();
      out.push(
        <Link key={start} to={`/u/${handle}`} className="rich__mention" onClick={(e) => e.stopPropagation()}>
          {token}
        </Link>
      );
    } else if (m[2]) {
      const href = /^https?:\/\//i.test(token) ? token : `https://${token}`;
      out.push(
        <a key={start} href={href} target="_blank" rel="noopener noreferrer" className="rich__link" onClick={(e) => e.stopPropagation()}>
          {token.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
        </a>
      );
    } else {
      out.push(
        <Link key={start} to={`/topico/${encodeURIComponent(token.slice(1))}`} className="rich__mention" onClick={(e) => e.stopPropagation()}>
          {token}
        </Link>
      );
    }
    last = start + token.length;
    TOKEN.lastIndex = last;
  }
  if (last < text.length) out.push(text.slice(last));
  return (
    <div className={`rich ${className}`}>
      {out.map((x, i) => (typeof x === 'string' ? <Fragment key={`t${i}`}>{x}</Fragment> : x))}
    </div>
  );
}
