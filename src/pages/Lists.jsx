import { useNavigate, useParams } from 'react-router';
import { PersonRow } from '../components/Lists';
import PostCard from '../components/PostCard';
import { BackButton, TopBar, Tabs, PageLoader, ErrorBox, EmptyState } from '../components/ui';
import * as api from '../lib/api';
import { useAsync } from '../lib/hooks';
import { useSession } from '../state/session';

// Seguidores / Seguindo de um perfil
export function FollowList() {
  const { handle, kind } = useParams();
  const { active } = useSession();
  const navigate = useNavigate();
  const tab = kind === 'seguindo' ? 'seguindo' : 'seguidores';
  const { data, loading, error, reload } = useAsync(
    active ? `follows:${handle}:${tab}:${active.id}` : null,
    async () => {
      const p = await api.profile(handle, active.id);
      if (!p) return { profile: null, people: [] };
      return { profile: p, people: await api.followList(p.id, tab, active.id) };
    },
    [handle, tab, active?.id]
  );

  return (
    <div className="page">
      <TopBar left={<BackButton />} title={handle} />
      <Tabs
        tabs={[
          { id: 'seguidores', label: 'Seguidores' },
          { id: 'seguindo', label: 'Seguindo' },
        ]}
        value={tab}
        onChange={(t) => navigate(`/u/${handle}/${t}`, { replace: true })}
      />
      {loading && !data ? (
        <PageLoader />
      ) : error && !data ? (
        <ErrorBox onRetry={reload}>{error}</ErrorBox>
      ) : !data?.people?.length ? (
        <EmptyState>
          {tab === 'seguidores' ? 'Ninguém segue este perfil no FargusThreads ainda.' : 'Este perfil ainda não segue ninguém.'}
          {tab === 'seguidores' && Number(data?.profile?.followers) > 0 && ' (Os seguidores famosos não aparecem na lista.)'}
        </EmptyState>
      ) : (
        data.people.map((p) => <PersonRow key={p.id} person={p} />)
      )}
    </div>
  );
}

// Atividade de um post: curtidas, reposts e citações
export function PostActivity() {
  const { id, kind } = useParams();
  const { active } = useSession();
  const navigate = useNavigate();
  const tab = ['curtidas', 'reposts', 'citacoes'].includes(kind) ? kind : 'curtidas';
  const { data, loading, error, reload } = useAsync(
    active ? `pact:${id}:${tab}:${active.id}` : null,
    () => api.postActivity(id, tab, active.id),
    [id, tab, active?.id]
  );

  return (
    <div className="page">
      <TopBar left={<BackButton />} title="Atividade do post" />
      <Tabs
        tabs={[
          { id: 'curtidas', label: 'Curtidas' },
          { id: 'reposts', label: 'Reposts' },
          { id: 'citacoes', label: 'Citações' },
        ]}
        value={tab}
        onChange={(t) => navigate(`/t/${id}/atividade/${t}`, { replace: true })}
      />
      {loading && !data ? (
        <PageLoader />
      ) : error && !data ? (
        <ErrorBox onRetry={reload}>{error}</ErrorBox>
      ) : !data?.length ? (
        <EmptyState>
          {tab === 'curtidas' ? 'Nenhuma curtida ainda.' : tab === 'reposts' ? 'Ninguém repostou ainda.' : 'Ninguém citou ainda.'}
        </EmptyState>
      ) : tab === 'citacoes' ? (
        data.map((p) => <PostCard key={p.id} post={p} />)
      ) : (
        data.map((p) => <PersonRow key={p.id} person={p} />)
      )}
    </div>
  );
}
