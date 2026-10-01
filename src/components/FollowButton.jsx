import { useEffect, useState } from 'react';
import { Button } from './ui';
import * as api from '../lib/api';
import { pageCache } from '../lib/storage';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

// Botão Seguir / Seguindo (com "Seguir de volta" quando a pessoa já segue você)
export default function FollowButton({ character, following, followsYou = false, onChange, size = 'sm', className = '' }) {
  const { active, isMine } = useSession();
  const toast = useToast();
  const [on, setOn] = useState(!!following);
  const [busy, setBusy] = useState(false);
  useEffect(() => setOn(!!following), [following]);
  if (!active || !character || character.id === active.id) return null;

  const toggle = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      await api.setFollow(active.id, character.id, next);
      pageCache.deletePrefix(`feed:${active.id}:seguindo`);
      onChange?.(next);
    } catch (err) {
      setOn(!next);
      toast(api.errorMessage(err), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const label = on ? 'Seguindo' : followsYou ? 'Seguir de volta' : 'Seguir';
  return (
    <Button
      variant={on ? 'outline' : 'primary'}
      className={`follow-btn follow-btn--${size} ${className}`}
      onClick={toggle}
      disabled={busy}
      title={isMine(character.id) ? 'Outro personagem seu' : undefined}
    >
      {label}
    </Button>
  );
}
