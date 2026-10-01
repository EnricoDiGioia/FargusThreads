import { useState } from 'react';
import { Check, RefreshCw, ArrowUpRight } from 'lucide-react';
import Avatar from './Avatar';
import { GramMark } from './Brand';
import { Sheet, VerifiedBadge, Spinner } from './ui';
import { GRAM_SITE } from '../config';
import { syncFromGram } from '../lib/auth';
import { pageCache } from '../lib/storage';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

// Trocar de personagem (o mestre usa para os NPCs)
export default function CharacterSwitcher({ open, onClose }) {
  const { characters, active, setActive, unread, refreshMe } = useSession();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  const pick = (id) => {
    if (id !== active?.id) {
      setActive(id);
      pageCache.clear();
    }
    onClose();
  };

  const sync = async () => {
    setSyncing(true);
    try {
      await syncFromGram({ force: true });
      await refreshMe();
      toast('Personagens atualizados');
    } catch (e) {
      toast(e.message, { kind: 'error', duration: 5000 });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Trocar de personagem">
      <div className="switcher">
        {characters.map((c) => (
          <button key={c.id} type="button" className="switcher__item" onClick={() => pick(c.id)}>
            <Avatar character={c} size={44} />
            <span className="switcher__text">
              <span className="switcher__handle">
                {c.handle}
                {c.is_verified && <VerifiedBadge size={13} />}
              </span>
              <span className="switcher__name">{c.name}</span>
            </span>
            {Number(unread?.[c.id]) > 0 && active?.id !== c.id && <span className="switcher__dot" aria-label="Avisos novos" />}
            {active?.id === c.id && <Check size={22} className="switcher__check" />}
          </button>
        ))}
        <p className="switcher__hint">
          Os personagens vêm do FargusGram. Para criar um NPC novo, crie lá e depois toque em Atualizar.
        </p>
        <div className="switcher__actions">
          <a className="btn btn--outline" href={`${GRAM_SITE}#/novo-personagem`} target="_blank" rel="noopener noreferrer">
            <GramMark size={18} /> Criar no FargusGram <ArrowUpRight size={16} />
          </a>
          <button type="button" className="btn btn--outline" onClick={sync} disabled={syncing}>
            {syncing ? <Spinner size={16} /> : <RefreshCw size={16} />} Atualizar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
