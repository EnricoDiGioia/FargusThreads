import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import PostCard from '../components/PostCard';
import Avatar from '../components/Avatar';
import { BackButton, TopBar, PageLoader, ErrorBox, EmptyState } from '../components/ui';
import * as api from '../lib/api';
import { useAsync } from '../lib/hooks';
import { usePost } from '../lib/postStore';
import { useSession } from '../state/session';

// Um post com a conversa toda: o que veio antes, a sequência do autor e as respostas
export default function ThreadPage() {
  const { id } = useParams();
  const { active } = useSession();
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const { data, loading, error, reload } = useAsync(active ? `thread:${id}:${active.id}` : null, () => api.threadView(id, active.id), [
    id,
    active?.id,
  ]);
  const main = usePost(data?.post);

  // com posts acima, a tela começa no post aberto (como no Threads)
  const hasAncestors = !!data?.ancestors?.length;
  useEffect(() => {
    if (!hasAncestors || !mainRef.current) return;
    const top = mainRef.current.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo(0, Math.max(0, top));
  }, [hasAncestors, id]);

  let body;
  if (loading && !data) body = <PageLoader />;
  else if (error && !data) body = <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  else if (!data || !main || main.deleted)
    body = <EmptyState title="Post indisponível">Ele foi apagado ou o link está errado.</EmptyState>;
  else {
    const chain = data.chain || [];
    const ancestors = data.ancestors || [];
    body = (
      <>
        {ancestors.map((p, i) => (
          <PostCard key={p.id} post={p} lineUp={i > 0} lineDown showChain={false} />
        ))}
        <div ref={mainRef}>
          <PostCard post={main} main lineUp={ancestors.length > 0} lineDown={chain.length > 0} />
        </div>
        {chain.map((p, i) => (
          <PostCard key={p.id} post={p} lineUp lineDown={i < chain.length - 1} showChain={false} />
        ))}

        <div className="thread-replies-head">
          <span>Respostas</span>
          <button type="button" className="link-btn" onClick={() => navigate(`/t/${main.id}/atividade`)}>
            Ver atividade
          </button>
        </div>

        {data.replies?.length ? (
          data.replies.map((p) => <PostCard key={p.id} post={p} showChain={false} />)
        ) : (
          <p className="thread-empty muted">Nenhuma resposta ainda.</p>
        )}

        {active && main.can_reply && (
          <button type="button" className="reply-bar" onClick={() => navigate(`/novo?responder=${main.id}`)}>
            <Avatar character={active} size={28} />
            <span>Responder a {main.author.handle}…</span>
          </button>
        )}
      </>
    );
  }

  return (
    <div className="page page--thread">
      <TopBar left={<BackButton />} title="Thread" />
      {body}
    </div>
  );
}
