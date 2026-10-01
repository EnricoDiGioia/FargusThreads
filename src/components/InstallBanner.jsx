import { useEffect, useState } from 'react';
import { X, Share, Plus, Download } from 'lucide-react';
import { ThreadMark } from './Brand';
import { canPromptInstall, isStandalone, onInstallChange, platform, promptInstall } from '../lib/pwa';
import { local } from '../lib/storage';

// Convite para instalar o app no celular (some depois de instalar ou fechar)
export default function InstallBanner() {
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(() => local.get('ft-install-hidden') === '1');
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);

  const p = platform();
  if (hidden || isStandalone() || !p.mobile) return null;

  const close = () => {
    local.set('ft-install-hidden', '1');
    setHidden(true);
  };

  return (
    <div className="install">
      <ThreadMark size={30} />
      <div className="install__text">
        <strong>Instale o FargusThreads</strong>
        {p.inApp ? (
          <span>Abra este link no {p.ios ? 'Safari' : 'Chrome'} para instalar.</span>
        ) : p.ios ? (
          <span>
            Toque em <Share size={14} className="inline-icon" /> Compartilhar e depois em <Plus size={14} className="inline-icon" />{' '}
            Adicionar à Tela de Início.
          </span>
        ) : canPromptInstall() ? (
          <span>Abre em tela cheia, como um app.</span>
        ) : (
          <span>No menu ⋮ do Chrome, toque em Instalar app.</span>
        )}
      </div>
      {!p.ios && !p.inApp && canPromptInstall() && (
        <button type="button" className="btn btn--primary btn--sm" onClick={promptInstall}>
          <Download size={15} /> Instalar
        </button>
      )}
      <button type="button" className="icon-btn" onClick={close} aria-label="Fechar">
        <X size={18} />
      </button>
    </div>
  );
}
