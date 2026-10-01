import { useParams } from 'react-router';
import { Hash } from 'lucide-react';
import PostList from '../components/Lists';
import { BackButton, TopBar, EmptyState } from '../components/ui';
import * as api from '../lib/api';
import { useInfinite } from '../lib/hooks';
import { useSession } from '../state/session';

// Posts de um tópico
export function Topic() {
  const { topic } = useParams();
  const { active } = useSession();
  const list = useInfinite(
    active ? `topic:${topic.toLowerCase()}:${active.id}` : null,
    (before) => api.topicPosts(topic, active.id, before),
    { pageSize: api.PAGE, enabled: !!active }
  );
  return (
    <div className="page">
      <TopBar left={<BackButton />} title={topic} />
      <div className="topic-hero">
        <span className="topic-row__icon topic-row__icon--lg">
          <Hash size={26} />
        </span>
        <h1>{topic}</h1>
      </div>
      <PostList list={list} empty={<EmptyState>Nenhum post com este tópico ainda.</EmptyState>} />
    </div>
  );
}

// Posts salvos do personagem em uso
export function Saved() {
  const { active } = useSession();
  const list = useInfinite(active ? `saved:${active.id}` : null, (before) => api.savedPosts(active.id, before), {
    pageSize: api.PAGE,
    enabled: !!active,
  });
  return (
    <div className="page">
      <TopBar left={<BackButton />} title="Salvos" />
      <PostList
        list={list}
        empty={<EmptyState title="Nada salvo">Toque no ⋯ de um post e em Salvar para guardar aqui. Só você vê.</EmptyState>}
      />
    </div>
  );
}
