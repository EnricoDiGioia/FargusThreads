import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bookmark, ChevronRight, LogOut, Moon, RefreshCw, Smartphone, Sun, SunMoon, Users, UserPlus, ArrowUpRight } from 'lucide-react';
import Avatar from '../components/Avatar';
import { GramMark } from '../components/Brand';
import CharacterSwitcher from '../components/CharacterSwitcher';
import { BackButton, TopBar, Spinner, useConfirm } from '../components/ui';
import { GRAM_SITE } from '../config';
import { importGramFollows, syncFromGram } from '../lib/auth';
import { canPromptInstall, isStandalone, onInstallChange, platform, promptInstall } from '../lib/pwa';
import { pageCache } from '../lib/storage';
import { getTheme, setTheme } from '../lib/theme';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

const THEMES = [
  { id: 'auto', label: 'Automático', icon: SunMoon },
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Escuro', icon: Moon },
];

export default function Settings() {
  const { active, me, signOut, refreshMe } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [theme, setThemeState] = useState(getTheme());
  const [switcher, setSwitcher] = useState(false);
  const [busy, setBusy] = useState(null);
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);

  const run = async (name, fn) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast(e.message, { kind: 'error', duration: 5000 });
    } finally {
      setBusy(null);
    }
  };

  const sync = () =>
    run('sync', async () => {
      await syncFromGram({ force: true });
      await refreshMe();
      pageCache.clear();
      toast('Personagens atualizados');
    });

  const importFollows = () =>
    run('import', async () => {
      const n = await importGramFollows();
      pageCache.clear();
      toast(n === 0 ? 'Você já seguia todo mundo daqui' : n === 1 ? '1 perfil seguido' : `${n} perfis seguidos`);
    });

  const logout = async () => {
    const ok = await confirm({
      title: 'Sair do FargusThreads?',
      message: 'O FargusGram continua conectado neste aparelho.',
      confirmText: 'Sair',
      danger: true,
    });
    if (ok) await signOut();
  };

  const p = platform();

  return (
    <div className="page">
      <TopBar left={<BackButton />} title="Configurações" />

      {active && (
        <button type="button" className="settings-account" onClick={() => setSwitcher(true)}>
          <Avatar character={active} size={44} />
          <span className="settings-account__text">
            <strong>{active.handle}</strong>
            <span className="muted small">
              {me?.characters?.length > 1 ? `Trocar de personagem (${me.characters.length})` : 'Seu personagem'}
            </span>
          </span>
          <ChevronRight size={20} className="muted" />
        </button>
      )}

      <div className="settings-group">
        <button type="button" className="settings-item" onClick={() => navigate('/salvos')}>
          <Bookmark size={20} /> <span>Salvos</span> <ChevronRight size={18} className="muted" />
        </button>
      </div>

      <h2 className="section-title">Tema</h2>
      <div className="segmented">
        {THEMES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`segmented__opt ${theme === t.id ? 'is-active' : ''}`}
              onClick={() => {
                setTheme(t.id);
                setThemeState(t.id);
              }}
            >
              <Icon size={18} /> {t.label}
            </button>
          );
        })}
      </div>

      <h2 className="section-title">FargusGram</h2>
      <div className="settings-group">
        <button type="button" className="settings-item" onClick={sync} disabled={!!busy}>
          {busy === 'sync' ? <Spinner size={20} /> : <RefreshCw size={20} />}
          <span>
            Atualizar personagens
            <small>Nome, foto, selo e NPCs novos</small>
          </span>
        </button>
        <button type="button" className="settings-item" onClick={importFollows} disabled={!!busy}>
          {busy === 'import' ? <Spinner size={20} /> : <UserPlus size={20} />}
          <span>
            Seguir as mesmas contas
            <small>Segue aqui quem seus personagens seguem lá</small>
          </span>
        </button>
        <a className="settings-item" href={GRAM_SITE} target="_blank" rel="noopener noreferrer">
          <GramMark size={20} />
          <span>Abrir o FargusGram</span>
          <ArrowUpRight size={18} className="muted" />
        </a>
      </div>

      {!isStandalone() && (
        <>
          <h2 className="section-title">Instalar no celular</h2>
          <div className="settings-note">
            <Smartphone size={20} />
            {p.ios ? (
              <span>No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.</span>
            ) : canPromptInstall() ? (
              <button type="button" className="btn btn--primary btn--sm" onClick={promptInstall}>
                Instalar o FargusThreads
              </button>
            ) : (
              <span>No Chrome do Android, toque no menu ⋮ e em Instalar app.</span>
            )}
          </div>
        </>
      )}

      <div className="settings-group settings-group--end">
        <button type="button" className="settings-item settings-item--danger" onClick={logout}>
          <LogOut size={20} /> <span>Sair</span>
        </button>
      </div>
      {me?.is_admin && (
        <p className="settings-foot muted small">
          <Users size={13} /> Você é admin: pode apagar qualquer post pelo ⋯. Os admins vêm do FargusGram.
        </p>
      )}
      <CharacterSwitcher open={switcher} onClose={() => setSwitcher(false)} />
    </div>
  );
}
