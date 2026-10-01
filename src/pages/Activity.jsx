import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Heart, UserPlus, MessageCircle, Repeat2, Quote, AtSign } from 'lucide-react';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import FollowButton from '../components/FollowButton';
import PullToRefresh from '../components/PullToRefresh';
import { Spinner, ErrorBox, EmptyState, VerifiedBadge } from '../components/ui';
import * as api from '../lib/api';
import { useInfinite, useOnVisible } from '../lib/hooks';
import { activityBucket, timeShort } from '../lib/format';
import { useSession } from '../state/session';

const FILTERS = [
  { id: 'tudo', label: 'Tudo' },
  { id: 'seguidores', label: 'Seguidores' },
  { id: 'respostas', label: 'Respostas' },
  { id: 'mencoes', label: 'Menções' },
  { id: 'citacoes', label: 'Citações' },
  { id: 'reposts', label: 'Reposts' },
  { id: 'curtidas', label: 'Curtidas' },
];

const KIND = {
  curtida: { icon: Heart, cls: 'kind--like', text: 'Curtiu seu post' },
  seguiu: { icon: UserPlus, cls: 'kind--follow', text: 'Começou a seguir você' },
  resposta: { icon: MessageCircle, cls: 'kind--reply', text: 'Respondeu' },
  mencao: { icon: AtSign, cls: 'kind--mention', text: 'Mencionou você' },
  citacao: { icon: Quote, cls: 'kind--quote', text: 'Citou seu post' },
  repost: { icon: Repeat2, cls: 'kind--repost', text: 'Repostou seu post' },
};

export default function Activity() {
  const { active, refreshUnread, setUnread } = useSession();
  const [filter, setFilter] = useState('tudo');
  const list = useInfinite(
    active ? `act:${active.id}:${filter}` : null,
    (before) => api.activity(active.id, filter, before),
    { pageSize: 30, getKey: (n) => n.id, enabled: !!active }
  );
  const sentinel = useOnVisible(() => list.loadMore(), !list.done && !list.loading && list.items.length > 0);

  // abriu a atividade: depois de mostrar o que era novo (com destaque), passa a lido
  const loaded = !list.loading;
  useEffect(() => {
    if (!active || !loaded) return;
    api
      .markActivityRead(active.id)
      .then(() => {
        setUnread((u) => ({ ...u, [active.id]: 0 }));
        refreshUnread();
      })
      .catch(() => {});
  }, [active?.id, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  let lastBucket = null;
  return (
    <div className="page">
      <header className="activity-head">
        <h1 className="page-title">Atividade</h1>
        <div className="chips" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`chip chip--lg ${filter === f.id ? 'is-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>
      <PullToRefresh onRefresh={list.reload}>
        {list.items.map((n) => {
          const bucket = activityBucket(n.at);
          const head = bucket !== lastBucket;
          lastBucket = bucket;
          return (
            <Fragment key={n.id}>
              {head && <h2 className="section-title">{bucket}</h2>}
              <ActivityItem n={n} />
            </Fragment>
          );
        })}
        {list.loading && (
          <div className="list-loader">
            <Spinner />
          </div>
        )}
        {list.error && <ErrorBox onRetry={list.reload}>{list.error}</ErrorBox>}
        {!list.loading && !list.error && list.items.length === 0 && (
          <EmptyState title="Nada por aqui ainda">Curtidas, respostas, menções e novos seguidores aparecem aqui.</EmptyState>
        )}
        {!list.done && <div ref={sentinel} className="list-sentinel" />}
      </PullToRefresh>
    </div>
  );
}

function ActivityItem({ n }) {
  const navigate = useNavigate();
  const k = KIND[n.kind] || KIND.curtida;
  const Icon = k.icon;
  const withPost = ['resposta', 'mencao', 'citacao'].includes(n.kind) && n.post;

  if (withPost) {
    return (
      <div className={`act act--post ${n.read ? '' : 'is-new'}`}>
        <div className="act__label">
          <Icon size={13} strokeWidth={2.4} /> {k.text}
        </div>
        <PostCard post={n.post} showReplyTo={n.kind !== 'resposta'} />
      </div>
    );
  }

  const open = () => {
    if (n.post) navigate(`/t/${n.post.id}`);
    else navigate(`/u/${n.actor.handle}`);
  };

  return (
    <div className={`act ${n.read ? '' : 'is-new'}`} onClick={open} role="link" tabIndex={0}>
      <Link to={`/u/${n.actor.handle}`} className="act__avatar" onClick={(e) => e.stopPropagation()}>
        <Avatar character={n.actor} size={40} />
        <span className={`act__kind ${k.cls}`}>
          <Icon size={11} strokeWidth={2.8} fill={n.kind === 'curtida' ? 'currentColor' : 'none'} />
        </span>
      </Link>
      <div className="act__main">
        <div className="act__line">
          <Link to={`/u/${n.actor.handle}`} className="post__name" onClick={(e) => e.stopPropagation()}>
            {n.actor.handle}
          </Link>
          {n.actor.is_verified && <VerifiedBadge size={13} />}
          <span className="post__time">{timeShort(n.at)}</span>
        </div>
        <div className="act__text">{k.text}</div>
        {n.post?.body && <div className="act__snippet">{n.post.body}</div>}
      </div>
      {n.kind === 'seguiu' && (
        <div className="act__right" onClick={(e) => e.stopPropagation()}>
          <FollowButton character={n.actor} following={n.actor.is_following} followsYou />
        </div>
      )}
    </div>
  );
}
