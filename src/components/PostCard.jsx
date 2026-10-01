import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Ellipsis,
  Bookmark,
  BookmarkCheck,
  Link2,
  Pencil,
  Trash2,
  ChartNoAxesColumn,
  Quote,
  Share,
} from 'lucide-react';
import Avatar from './Avatar';
import RichText from './RichText';
import Media from './Media';
import Poll from './Poll';
import { VerifiedBadge, Sheet, SheetGroup, SheetItem, Button, useConfirm } from './ui';
import * as api from '../lib/api';
import { patchPost, usePost } from '../lib/postStore';
import { count, timeShort, fullDateTime } from '../lib/format';
import { mediaUrl } from '../lib/supabase';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

const EDIT_WINDOW = 15 * 60 * 1000;

export function postLink(id) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/t/${id}`;
}

export function NameLine({ author, topic, at, edited, onTopic = true }) {
  return (
    <div className="post__head">
      <Link to={`/u/${author.handle}`} className="post__name" onClick={(e) => e.stopPropagation()}>
        {author.handle}
      </Link>
      {author.is_verified && <VerifiedBadge size={14} />}
      {topic && (
        <>
          <span className="post__topic-sep" aria-hidden="true">
            ›
          </span>
          {onTopic ? (
            <Link to={`/topico/${encodeURIComponent(topic)}`} className="post__topic" onClick={(e) => e.stopPropagation()}>
              {topic}
            </Link>
          ) : (
            <span className="post__topic">{topic}</span>
          )}
        </>
      )}
      {at && (
        <time className="post__time" dateTime={at} title={fullDateTime(at)}>
          {timeShort(at)}
          {edited ? ' · editado' : ''}
        </time>
      )}
    </div>
  );
}

// Post citado, dentro de outro post
export function QuoteCard({ post, onOpen }) {
  const navigate = useNavigate();
  if (!post) return null;
  const first = post.media?.[0];
  return (
    <div
      className="quote"
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        if (onOpen) onOpen();
        else navigate(`/t/${post.id}`);
      }}
    >
      <div className="quote__head">
        <Avatar character={post.author} size={20} />
        <span className="post__name">{post.author.handle}</span>
        {post.author.is_verified && <VerifiedBadge size={13} />}
        <span className="post__time">{timeShort(post.created_at)}</span>
      </div>
      {post.body && <div className="quote__body">{post.body}</div>}
      {first && (
        <div className="quote__media">
          <img src={mediaUrl(first.path)} alt="" crossOrigin="anonymous" loading="lazy" />
          {post.media.length > 1 && <span className="quote__more">+{post.media.length - 1}</span>}
        </div>
      )}
      {post.poll && <div className="quote__poll">Enquete · {post.poll.options.length} opções</div>}
    </div>
  );
}

// ---------------------------------------------------------------------
// Post
// ---------------------------------------------------------------------
export default function PostCard({
  post: raw,
  repostBy = null,
  lineUp = false,
  lineDown = false,
  main = false,
  showReplyTo = false,
  showChain = true,
  className = '',
}) {
  const post = usePost(raw);
  const navigate = useNavigate();
  if (!post || post.deleted) return null;

  const open = (e) => {
    if (main) return;
    if (e.target.closest('a, button, input, textarea, .media, .poll, .quote')) return;
    if (window.getSelection?.().toString()) return;
    navigate(`/t/${post.id}`);
  };

  return (
    <article className={`post ${main ? 'post--main' : ''} ${lineDown ? 'post--line-down' : ''} ${className}`} onClick={open}>
      {repostBy && (
        <div className="post__repost">
          <Repeat2 size={14} strokeWidth={2.2} />
          <Link to={`/u/${repostBy.handle}`}>{repostBy.handle}</Link> repostou
        </div>
      )}
      <div className="post__grid">
        <div className="post__rail">
          {lineUp && <span className="post__line post__line--up" />}
          <Link to={`/u/${post.author.handle}`} className="post__avatar" aria-label={post.author.handle}>
            <Avatar character={post.author} size={36} />
          </Link>
          {lineDown && <span className="post__line post__line--down" />}
        </div>
        <div className="post__main">
          <div className="post__top">
            <NameLine author={post.author} topic={post.topic} at={post.created_at} edited={!!post.edited_at} />
            <PostMenu post={post} />
          </div>
          {showReplyTo && post.is_reply && !post.is_chain && (
            <div className="post__replyto">
              {post.reply_to ? (
                <>
                  Respondendo a{' '}
                  <Link to={`/u/${post.reply_to.handle}`} onClick={(e) => e.stopPropagation()}>
                    @{post.reply_to.handle}
                  </Link>
                </>
              ) : (
                'Respondendo a um post apagado'
              )}
            </div>
          )}
          {post.body && <RichText text={post.body} className={main ? 'rich--big' : ''} />}
          <Media media={post.media} />
          <Poll post={post} />
          {post.quote && <QuoteCard post={post.quote} />}
          {main && (
            <div className="post__stamp">
              {fullDateTime(post.created_at)}
              {post.edited_at ? ' · editado' : ''}
            </div>
          )}
          <ActionBar post={post} />
          {showChain && !main && !post.is_reply && post.chain > 0 && (
            <Link to={`/t/${post.id}`} className="post__chain" onClick={(e) => e.stopPropagation()}>
              Ver sequência · mais {post.chain} {post.chain === 1 ? 'parte' : 'partes'}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------
// Curtir, responder, repostar, compartilhar
// ---------------------------------------------------------------------
function ActionBar({ post }) {
  const { active } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [repostOpen, setRepostOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const like = async (e) => {
    e.stopPropagation();
    if (!active) return;
    const on = !post.liked;
    patchPost(post.id, { liked: on, likes: Math.max(0, (post.likes || 0) + (on ? 1 : -1)) });
    try {
      await api.setLike(post.id, active.id, on);
    } catch (err) {
      patchPost(post.id, { liked: !on, likes: post.likes });
      toast(api.errorMessage(err), { kind: 'error' });
    }
  };

  const reply = (e) => {
    e.stopPropagation();
    if (!post.can_reply) {
      toast(
        post.reply_policy === 'seguidos'
          ? `Só quem @${post.author.handle} segue pode responder.`
          : `Só quem @${post.author.handle} mencionou pode responder.`
      );
      return;
    }
    navigate(`/novo?responder=${post.id}`);
  };

  const repost = async () => {
    setRepostOpen(false);
    if (!active) return;
    const on = !post.reposted;
    patchPost(post.id, { reposted: on, reposts: Math.max(0, (post.reposts || 0) + (on ? 1 : -1)) });
    try {
      await api.setRepost(post.id, active.id, on);
      toast(on ? 'Repostado' : 'Repost removido');
    } catch (err) {
      patchPost(post.id, { reposted: !on, reposts: post.reposts });
      toast(api.errorMessage(err), { kind: 'error' });
    }
  };

  const quote = () => {
    setRepostOpen(false);
    if (!post.can_reply) {
      toast('Você não pode citar este post.');
      return;
    }
    navigate(`/novo?citar=${post.id}`);
  };

  const copyLink = async () => {
    setShareOpen(false);
    try {
      await navigator.clipboard.writeText(postLink(post.id));
      toast('Link copiado');
    } catch {
      toast('Não deu para copiar o link', { kind: 'error' });
    }
  };

  const shareNative = async () => {
    setShareOpen(false);
    try {
      await navigator.share({ url: postLink(post.id), text: post.body?.slice(0, 120) || `Post de @${post.author.handle}` });
    } catch {
      /* cancelou */
    }
  };

  return (
    <div className="actions" onClick={(e) => e.stopPropagation()}>
      <button type="button" className={`action ${post.liked ? 'is-liked' : ''}`} onClick={like} aria-pressed={!!post.liked} aria-label="Curtir">
        <Heart size={20} strokeWidth={1.8} fill={post.liked ? 'currentColor' : 'none'} />
        {post.likes > 0 && <span>{count(post.likes)}</span>}
      </button>
      <button type="button" className={`action ${post.can_reply ? '' : 'is-locked'}`} onClick={reply} aria-label="Responder">
        <MessageCircle size={20} strokeWidth={1.8} />
        {post.replies > 0 && <span>{count(post.replies)}</span>}
      </button>
      <button
        type="button"
        className={`action ${post.reposted ? 'is-reposted' : ''}`}
        onClick={() => setRepostOpen(true)}
        aria-label="Repostar"
      >
        <Repeat2 size={20} strokeWidth={post.reposted ? 2.6 : 1.8} />
        {post.reposts + post.quotes > 0 && <span>{count(post.reposts + post.quotes)}</span>}
      </button>
      <button type="button" className="action" onClick={() => setShareOpen(true)} aria-label="Compartilhar">
        <Send size={19} strokeWidth={1.8} />
      </button>

      <Sheet open={repostOpen} onClose={() => setRepostOpen(false)}>
        <SheetGroup>
          <SheetItem onClick={repost} danger={post.reposted} icon={<Repeat2 size={20} />}>
            {post.reposted ? 'Remover' : 'Repostar'}
          </SheetItem>
          <SheetItem onClick={quote} icon={<Quote size={20} />}>
            Citar
          </SheetItem>
        </SheetGroup>
      </Sheet>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)}>
        <SheetGroup>
          <SheetItem onClick={copyLink} icon={<Link2 size={20} />}>
            Copiar link
          </SheetItem>
          {typeof navigator !== 'undefined' && navigator.share && (
            <SheetItem onClick={shareNative} icon={<Share size={20} />}>
              Compartilhar via…
            </SheetItem>
          )}
        </SheetGroup>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------
// Menu ⋯ do post
// ---------------------------------------------------------------------
function PostMenu({ post }) {
  const { active, isMine, isAdmin } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const mine = isMine(post.author.id);
  const canEdit = mine && Date.now() - new Date(post.created_at).getTime() < EDIT_WINDOW;

  const save = async () => {
    setOpen(false);
    if (!active) return;
    const on = !post.saved;
    patchPost(post.id, { saved: on });
    try {
      await api.setSave(post.id, active.id, on);
      toast(on ? 'Salvo' : 'Removido dos salvos');
    } catch (err) {
      patchPost(post.id, { saved: !on });
      toast(api.errorMessage(err), { kind: 'error' });
    }
  };

  const copy = async () => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(postLink(post.id));
      toast('Link copiado');
    } catch {
      toast('Não deu para copiar o link', { kind: 'error' });
    }
  };

  const remove = async () => {
    setOpen(false);
    const chained = !post.is_reply || post.is_chain;
    const ok = await confirm({
      title: 'Apagar post?',
      message:
        mine
          ? chained
            ? 'Se ele fizer parte de uma sequência, as partes seguintes também saem. Não dá para desfazer.'
            : 'Não dá para desfazer.'
          : `Você é admin: o post de @${post.author.handle} vai sumir para todo mundo.`,
      confirmText: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deletePost(post.id);
      patchPost(post.id, { deleted: true });
      toast('Post apagado');
    } catch (err) {
      toast(api.errorMessage(err), { kind: 'error' });
    }
  };

  return (
    <>
      <button
        type="button"
        className="icon-btn post__menu"
        aria-label="Mais opções"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Ellipsis size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SheetGroup>
          <SheetItem onClick={save} icon={post.saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}>
            {post.saved ? 'Remover dos salvos' : 'Salvar'}
          </SheetItem>
          <SheetItem onClick={copy} icon={<Link2 size={20} />}>
            Copiar link
          </SheetItem>
          <SheetItem
            onClick={() => {
              setOpen(false);
              navigate(`/t/${post.id}/atividade`);
            }}
            icon={<ChartNoAxesColumn size={20} />}
          >
            Atividade do post
          </SheetItem>
        </SheetGroup>
        {(canEdit || mine || isAdmin) && (
          <SheetGroup>
            {canEdit && (
              <SheetItem
                onClick={() => {
                  setOpen(false);
                  setEditing(true);
                }}
                icon={<Pencil size={20} />}
              >
                Editar
              </SheetItem>
            )}
            {(mine || isAdmin) && (
              <SheetItem onClick={remove} danger icon={<Trash2 size={20} />}>
                Apagar
              </SheetItem>
            )}
          </SheetGroup>
        )}
      </Sheet>
      {editing && <EditSheet post={post} onClose={() => setEditing(false)} />}
    </>
  );
}

function EditSheet({ post, onClose }) {
  const toast = useToast();
  const [text, setText] = useState(post.body || '');
  const [busy, setBusy] = useState(false);
  const left = 500 - text.length;

  const submit = async () => {
    setBusy(true);
    try {
      await api.editPost(post.id, text);
      patchPost(post.id, { body: text.trim(), edited_at: new Date().toISOString() });
      toast('Post editado');
      onClose();
    } catch (err) {
      toast(api.errorMessage(err), { kind: 'error' });
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Editar post" className="sheet--form">
      <div className="edit-sheet" onClick={(e) => e.stopPropagation()}>
        <textarea
          className="field field--area"
          value={text}
          maxLength={500}
          rows={5}
          autoFocus
          onChange={(e) => setText(e.target.value)}
        />
        <div className="edit-sheet__foot">
          <span className={`counter ${left < 20 ? 'is-low' : ''}`}>{left}</span>
          <Button onClick={submit} loading={busy}>
            Salvar
          </Button>
        </div>
        <p className="muted small">Dá para editar nos primeiros 15 minutos. O post fica marcado como editado.</p>
      </div>
    </Sheet>
  );
}
