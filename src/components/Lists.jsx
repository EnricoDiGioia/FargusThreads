import { Fragment } from 'react';
import { Link } from 'react-router';
import PostCard from './PostCard';
import Avatar from './Avatar';
import FollowButton from './FollowButton';
import { Spinner, ErrorBox, EmptyState, VerifiedBadge } from './ui';
import { useOnVisible } from '../lib/hooks';
import { count } from '../lib/format';
import { isDeleted } from '../lib/postStore';

// Item de lista: { post, repost_by?, context? } (context = post respondido, nas respostas do perfil)
export function FeedItem({ item }) {
  if (!item?.post || isDeleted(item.post.id)) return null;
  if (item.context && !isDeleted(item.context.id)) {
    return (
      <div className="feed-pair">
        <PostCard post={item.context} lineDown showChain={false} />
        <PostCard post={item.post} lineUp />
      </div>
    );
  }
  return <PostCard post={item.post} repostBy={item.repost_by} showReplyTo />;
}

// Lista infinita de posts (feed, perfil, tópico, salvos)
export default function PostList({ list, empty }) {
  const sentinel = useOnVisible(() => list.loadMore(), !list.done && !list.loading && !list.error && list.items.length > 0);
  return (
    <div className="post-list">
      {list.items.map((it, i) => (
        <Fragment key={`${it.post?.id}:${it.repost_by?.id || ''}:${i}`}>
          <FeedItem item={it} />
        </Fragment>
      ))}
      {list.loading && (
        <div className="list-loader">
          <Spinner />
        </div>
      )}
      {list.error && <ErrorBox onRetry={list.items.length ? list.loadMore : list.reload}>{list.error}</ErrorBox>}
      {!list.loading && !list.error && list.items.length === 0 && empty}
      {!list.done && <div ref={sentinel} className="list-sentinel" />}
    </div>
  );
}

// Linha de pessoa (busca, seguidores, curtidas)
export function PersonRow({ person, showFollowers = false, bio = null, onFollowChange }) {
  return (
    <div className="person">
      <Link to={`/u/${person.handle}`} className="person__link">
        <Avatar character={person} size={40} />
        <span className="person__text">
          <span className="person__handle">
            {person.handle}
            {person.is_verified && <VerifiedBadge size={13} />}
          </span>
          <span className="person__name">{person.name}</span>
          {bio && <span className="person__bio">{bio}</span>}
          {showFollowers && person.followers !== undefined && (
            <span className="person__meta">
              {count(person.followers)} {Number(person.followers) === 1 ? 'seguidor' : 'seguidores'}
            </span>
          )}
        </span>
      </Link>
      <FollowButton character={person} following={person.is_following} onChange={onFollowChange} />
    </div>
  );
}

export function EmptyPosts({ title = 'Nada por aqui ainda', children }) {
  return <EmptyState title={title}>{children}</EmptyState>;
}
