import { useState } from 'react';
import { Check } from 'lucide-react';
import * as api from '../lib/api';
import { patchPost } from '../lib/postStore';
import { timeLeft, plural } from '../lib/format';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

// Enquete: toca numa opção para votar; depois aparecem as porcentagens
export default function Poll({ post }) {
  const { active } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const poll = post.poll;
  if (!poll) return null;

  // quem fez a enquete vê os resultados sem votar (como no Threads)
  const showResults = !!poll.my_vote || poll.closed || post.author.id === active?.id;
  const total = Number(poll.total) || 0;
  const top = Math.max(0, ...poll.options.map((o) => Number(o.votes) || 0));

  const choose = async (e, option) => {
    e.stopPropagation();
    if (showResults || busy || !active) return;
    setBusy(option.id);
    // mostra na hora; o servidor confirma
    patchPost(post.id, {
      poll: {
        ...poll,
        my_vote: option.id,
        total: total + 1,
        options: poll.options.map((o) => (o.id === option.id ? { ...o, votes: (Number(o.votes) || 0) + 1 } : o)),
      },
    });
    try {
      const fresh = await api.vote(post.id, option.id, active.id);
      if (fresh) patchPost(post.id, { poll: fresh });
    } catch (err) {
      patchPost(post.id, { poll });
      toast(api.errorMessage(err), { kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="poll" onClick={(e) => e.stopPropagation()}>
      {poll.options.map((o) => {
        const votes = Number(o.votes) || 0;
        const pct = total ? Math.round((votes / total) * 100) : 0;
        const mine = poll.my_vote === o.id;
        const winner = poll.closed && votes === top && top > 0;
        return (
          <button
            key={o.id}
            type="button"
            className={`poll__option ${showResults ? 'is-result' : ''} ${mine ? 'is-mine' : ''} ${winner ? 'is-winner' : ''}`}
            onClick={(e) => choose(e, o)}
            disabled={showResults || !!busy}
          >
            {showResults && <span className="poll__bar" style={{ width: `${pct}%` }} />}
            <span className="poll__label">
              {o.label}
              {mine && <Check size={15} strokeWidth={2.6} className="poll__check" />}
            </span>
            {showResults && <span className="poll__pct">{pct}%</span>}
          </button>
        );
      })}
      <div className="poll__meta">
        {plural(total, 'voto', 'votos')} · {timeLeft(poll.ends_at)}
      </div>
    </div>
  );
}
