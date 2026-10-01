import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Avatar from '../components/Avatar';
import { ThreadMark } from '../components/Brand';
import PostList from '../components/Lists';
import PullToRefresh from '../components/PullToRefresh';
import InstallBanner from '../components/InstallBanner';
import { Button, EmptyState } from '../components/ui';
import * as api from '../lib/api';
import { useInfinite } from '../lib/hooks';
import { local } from '../lib/storage';
import { useSession } from '../state/session';

const TABS = [
  { id: 'para_voce', label: 'Para você' },
  { id: 'seguindo', label: 'Seguindo' },
];

export default function Home() {
  const { active } = useSession();
  const navigate = useNavigate();
  const [tab, setTabState] = useState(() => (local.get('ft-feed-tab') === 'seguindo' ? 'seguindo' : 'para_voce'));
  const list = useInfinite(active ? `feed:${active.id}:${tab}` : null, (before) => api.feed(active.id, tab, before), {
    pageSize: api.PAGE,
    enabled: !!active,
  });

  const setTab = (t) => {
    local.set('ft-feed-tab', t);
    setTabState(t);
    window.scrollTo(0, 0);
  };

  const reload = useCallback(() => list.reload(), [list]);
  useEffect(() => {
    const again = () => reload();
    window.addEventListener('ft:home-again', again);
    return () => window.removeEventListener('ft:home-again', again);
  }, [reload]);

  return (
    <div className="page">
      <header className="home-head">
        <div className="home-head__logo">
          <ThreadMark size={32} />
        </div>
        <div className="feed-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`feed-tabs__tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => (tab === t.id ? reload() : setTab(t.id))}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <PullToRefresh onRefresh={list.reload}>
        <InstallBanner />
        {active && (
          <button type="button" className="composer-prompt" onClick={() => navigate('/novo')}>
            <Avatar character={active} size={36} />
            <span className="composer-prompt__text">O que há de novo?</span>
            <span className="btn btn--outline btn--sm">Publicar</span>
          </button>
        )}
        {list.refreshing && <div className="refresh-bar" />}
        <PostList
          list={list}
          empty={
            tab === 'seguindo' ? (
              <EmptyState
                title="Ninguém para mostrar"
                action={
                  <Button variant="outline" onClick={() => navigate('/buscar')}>
                    Procurar personagens
                  </Button>
                }
              >
                Siga personagens para ver aqui o que eles publicam e repostam.
              </EmptyState>
            ) : (
              <EmptyState
                title="O FargusThreads está quietinho"
                action={<Button onClick={() => navigate('/novo')}>Publicar o primeiro post</Button>}
              >
                Ninguém publicou ainda. Que tal começar a conversa?
              </EmptyState>
            )
          }
        />
      </PullToRefresh>
    </div>
  );
}
