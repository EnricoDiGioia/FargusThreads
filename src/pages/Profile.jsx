import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Ellipsis, Menu, Link2, Pencil, ArrowUpRight, Repeat } from 'lucide-react';
import Avatar from '../components/Avatar';
import PostList from '../components/Lists';
import { GramMark } from '../components/Brand';
import FollowButton from '../components/FollowButton';
import RichText from '../components/RichText';
import {
  BackButton,
  Button,
  EmptyState,
  ErrorBox,
  IconButton,
  PageLoader,
  Sheet,
  SheetGroup,
  SheetItem,
  Tabs,
  TopBar,
  VerifiedBadge,
} from '../components/ui';
import { GRAM_SITE } from '../config';
import * as api from '../lib/api';
import { useAsync, useInfinite } from '../lib/hooks';
import { avatarUrl } from '../lib/supabase';
import { count, linkHref, linkLabel } from '../lib/format';
import { pageCache } from '../lib/storage';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

const TABS = [
  { id: 'threads', label: 'Threads' },
  { id: 'respostas', label: 'Respostas' },
  { id: 'midia', label: 'Mídia' },
  { id: 'reposts', label: 'Reposts' },
];

export default function Profile() {
  const { handle } = useParams();
  const { active, setActive } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('threads');
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const key = active ? `profile:${handle}:${active.id}` : null;
  const { data: p, loading, error, reload, mutate } = useAsync(key, () => api.profile(handle, active.id), [handle, active?.id]);
  const isActive = p && active && p.id === active.id;

  const list = useInfinite(
    p && active ? `pp:${p.id}:${tab}:${active.id}` : null,
    (before) => api.profilePosts(p.id, active.id, tab, before),
    { pageSize: api.PAGE, enabled: !!(p && active), getKey: (it) => `${it.post?.id}:${it.repost_by?.id || ''}` }
  );

  const share = async () => {
    setMenu(false);
    const url = `${window.location.origin}${window.location.pathname}#/u/${p.handle}`;
    try {
      if (navigator.share) await navigator.share({ url, title: `@${p.handle} no FargusThreads` });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link do perfil copiado');
      }
    } catch {
      /* cancelou */
    }
  };

  if (loading && !p) return <PageLoader />;
  if (error && !p)
    return (
      <div className="page">
        <TopBar left={<BackButton />} />
        <ErrorBox onRetry={reload}>{error}</ErrorBox>
      </div>
    );
  if (!p)
    return (
      <div className="page">
        <TopBar left={<BackButton />} />
        <EmptyState title="Perfil não encontrado">O @{handle} não existe no FargusGram (ou mudou de nome).</EmptyState>
      </div>
    );

  return (
    <div className="page">
      <TopBar
        left={isActive ? null : <BackButton />}
        right={
          isActive ? (
            <IconButton label="Configurações" onClick={() => navigate('/configuracoes')}>
              <Menu size={24} strokeWidth={1.8} />
            </IconButton>
          ) : (
            <IconButton label="Mais opções" onClick={() => setMenu(true)}>
              <Ellipsis size={24} />
            </IconButton>
          )
        }
      />

      <section className="profile">
        <div className="profile__top">
          <div className="profile__names">
            <h1 className="profile__name">{p.name || p.handle}</h1>
            <div className="profile__handle">
              <span>{p.handle}</span>
              {p.is_verified && <VerifiedBadge size={15} />}
            </div>
          </div>
          <a className="profile__avatar" href={avatarUrl(p.avatar_path) || undefined} target="_blank" rel="noopener noreferrer">
            <Avatar character={p} size={76} />
          </a>
        </div>

        {p.bio && <RichText text={p.bio} className="profile__bio" />}

        <div className="profile__meta">
          <Link to={`/u/${p.handle}/seguidores`} className="profile__followers">
            {p.followers_preview?.length > 0 && (
              <span className="stack">
                {p.followers_preview.map((path, i) => (
                  <Avatar key={i} character={{ avatar_path: path, handle: '?' }} size={20} />
                ))}
              </span>
            )}
            {count(p.followers)} {Number(p.followers) === 1 ? 'seguidor' : 'seguidores'}
          </Link>
          {p.link && (
            <>
              <span className="dot-sep">·</span>
              <a href={linkHref(p.link)} target="_blank" rel="noopener noreferrer" className="profile__link">
                {linkLabel(p.link)}
              </a>
            </>
          )}
          <a
            className="profile__gram"
            href={`${GRAM_SITE}#/u/${p.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir no FargusGram"
            title="Abrir no FargusGram"
          >
            <GramMark size={22} />
          </a>
        </div>

        {p.follows_you && !isActive && <div className="profile__follows-you">Segue você</div>}

        <div className="profile__buttons">
          {isActive ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                Editar perfil
              </Button>
              <Button variant="outline" onClick={share}>
                Compartilhar perfil
              </Button>
            </>
          ) : (
            <>
              <FollowButton
                character={p}
                following={p.is_following}
                followsYou={p.follows_you}
                size="lg"
                onChange={(on) => mutate((x) => ({ ...x, is_following: on, followers: Number(x.followers) + (on ? 1 : -1) }))}
              />
              <Button variant="outline" onClick={() => navigate(`/novo?mencionar=${p.handle}`)}>
                Mencionar
              </Button>
            </>
          )}
        </div>

        {p.is_mine && !isActive && (
          <button
            type="button"
            className="profile__use"
            onClick={() => {
              setActive(p.id);
              pageCache.clear();
              toast(`Agora você está usando @${p.handle}`);
            }}
          >
            <Repeat size={15} /> Este personagem é seu. Usar @{p.handle}
          </button>
        )}
      </section>

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="tabs--sticky" />
      <PostList
        list={list}
        empty={
          <EmptyState>
            {tab === 'threads'
              ? isActive
                ? 'Você ainda não publicou nada.'
                : `@${p.handle} ainda não publicou nada.`
              : tab === 'respostas'
                ? 'Nenhuma resposta ainda.'
                : tab === 'midia'
                  ? 'Nenhuma foto ainda.'
                  : 'Nenhum repost ainda.'}
          </EmptyState>
        }
      />

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <SheetGroup>
          <SheetItem onClick={share} icon={<Link2 size={20} />}>
            Compartilhar perfil
          </SheetItem>
          <SheetItem
            onClick={() => {
              setMenu(false);
              window.open(`${GRAM_SITE}#/u/${p.handle}`, '_blank', 'noopener');
            }}
            icon={<ArrowUpRight size={20} />}
          >
            Abrir no FargusGram
          </SheetItem>
        </SheetGroup>
      </Sheet>

      {editing && (
        <EditProfile
          profile={p}
          onClose={() => setEditing(false)}
          onSaved={(fields) => mutate((x) => ({ ...x, ...fields }))}
        />
      )}
    </div>
  );
}

// Bio e link próprios do FargusThreads (nome e foto vêm do FargusGram)
function EditProfile({ profile, onClose, onSaved }) {
  const { patchCharacter } = useSession();
  const toast = useToast();
  const [useGramBio, setUseGramBio] = useState(profile.own_bio === null || profile.own_bio === undefined);
  const [bio, setBio] = useState(profile.own_bio ?? profile.gram_bio ?? '');
  const [link, setLink] = useState(profile.link || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const own = useGramBio ? null : bio.trim();
      await api.updateProfile(profile.id, { bio: own, link });
      const effective = own === null ? profile.gram_bio : own;
      onSaved({ bio: effective, own_bio: own, link: link.trim() });
      patchCharacter({ id: profile.id, bio: effective, link: link.trim() });
      toast('Perfil atualizado');
      onClose();
    } catch (e) {
      toast(api.errorMessage(e), { kind: 'error' });
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Editar perfil" className="sheet--form">
      <div className="edit-profile">
        <div className="edit-profile__row">
          <div>
            <div className="edit-profile__label">Nome</div>
            <div>
              {profile.name || profile.handle} <span className="muted">(@{profile.handle})</span>
            </div>
          </div>
          <Avatar character={profile} size={52} />
        </div>
        <p className="muted small">
          Nome, @ e foto vêm do FargusGram. Para mudar, edite lá e toque em Atualizar na troca de personagem.
        </p>

        <label className="edit-profile__switch">
          <span>Usar a bio do FargusGram</span>
          <input type="checkbox" className="switch" checked={useGramBio} onChange={(e) => setUseGramBio(e.target.checked)} />
        </label>
        {useGramBio ? (
          <div className="edit-profile__gram-bio">{profile.gram_bio || <span className="muted">Sem bio no FargusGram</span>}</div>
        ) : (
          <>
            <textarea
              className="field field--area"
              rows={3}
              maxLength={150}
              placeholder="Escreva a bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <div className="counter">{150 - bio.length}</div>
          </>
        )}

        <label className="edit-profile__label" htmlFor="ep-link">
          <Pencil size={12} /> Link
        </label>
        <input
          id="ep-link"
          className="field"
          inputMode="url"
          placeholder="Adicionar link"
          maxLength={200}
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />

        <Button onClick={save} loading={busy} className="btn--block">
          Concluir
        </Button>
      </div>
    </Sheet>
  );
}
