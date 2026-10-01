import { useState } from 'react';
import { Link } from 'react-router';
import { Search as SearchIcon, X, Hash } from 'lucide-react';
import PostCard from '../components/PostCard';
import { PersonRow } from '../components/Lists';
import { PageLoader, ErrorBox, EmptyState } from '../components/ui';
import * as api from '../lib/api';
import { useAsync, useDebounced } from '../lib/hooks';
import { local } from '../lib/storage';
import { plural } from '../lib/format';
import { useSession } from '../state/session';

export default function Search() {
  const { active } = useSession();
  const [q, setQ] = useState(() => local.get('ft-last-search') || '');
  const query = useDebounced(q.trim(), 300);

  const change = (v) => {
    setQ(v);
    local.set('ft-last-search', v || null);
  };

  return (
    <div className="page">
      <header className="search-head">
        <h1 className="page-title">Buscar</h1>
        <div className="search-box">
          <SearchIcon size={18} className="search-box__icon" />
          <input
            className="search-box__input"
            type="search"
            enterKeyHint="search"
            placeholder="Buscar personagens, tópicos e posts"
            value={q}
            onChange={(e) => change(e.target.value)}
          />
          {q && (
            <button type="button" className="icon-btn icon-btn--xs" onClick={() => change('')} aria-label="Limpar">
              <X size={16} />
            </button>
          )}
        </div>
      </header>
      {active && (query ? <Results query={query} viewer={active.id} /> : <Suggestions viewer={active.id} />)}
    </div>
  );
}

function Suggestions({ viewer }) {
  const { data, loading, error, reload } = useAsync(`suggest:${viewer}`, () => api.suggestions(viewer), [viewer]);
  if (loading && !data) return <PageLoader />;
  if (error && !data) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!data?.length) return <EmptyState title="Você já segue todo mundo">Quando surgirem personagens novos no FargusGram, eles aparecem aqui.</EmptyState>;
  return (
    <section>
      <h2 className="section-title">Sugestões para seguir</h2>
      {data.map((p) => (
        <PersonRow key={p.id} person={p} bio={p.bio} showFollowers />
      ))}
    </section>
  );
}

function Results({ query, viewer }) {
  const { data, loading, error, reload } = useAsync(`search:${viewer}:${query}`, () => api.search(query, viewer), [query, viewer]);
  if (loading && !data) return <PageLoader />;
  if (error && !data) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  const people = data?.people || [];
  const topics = data?.topics || [];
  const posts = data?.posts || [];
  if (!people.length && !topics.length && !posts.length) {
    return <EmptyState title="Nada encontrado">Tente outro nome, @ ou palavra.</EmptyState>;
  }
  return (
    <>
      {topics.length > 0 && (
        <section>
          {topics.map((t) => (
            <Link key={t.topic} to={`/topico/${encodeURIComponent(t.topic)}`} className="topic-row">
              <span className="topic-row__icon">
                <Hash size={18} />
              </span>
              <span className="topic-row__text">
                <strong>{t.topic}</strong>
                <span className="muted small">{plural(t.posts, 'post', 'posts')}</span>
              </span>
            </Link>
          ))}
        </section>
      )}
      {people.length > 0 && (
        <section>
          {people.map((p) => (
            <PersonRow key={p.id} person={p} showFollowers />
          ))}
        </section>
      )}
      {posts.length > 0 && (
        <section>
          <h2 className="section-title">Posts</h2>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} showReplyTo />
          ))}
        </section>
      )}
    </>
  );
}
