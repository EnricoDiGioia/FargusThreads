import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { House, Search, Plus, Heart, User, Menu } from 'lucide-react';
import Avatar from './Avatar';
import { ThreadMark } from './Brand';
import CharacterSwitcher from './CharacterSwitcher';
import { longPress } from '../lib/hooks';
import { useSession } from '../state/session';

// Barra de baixo no celular; no computador vira a coluna da esquerda
export default function BottomNav() {
  const { active, unread } = useSession();
  const mine = Number(unread?.[active?.id]) || 0;
  const others = Object.entries(unread || {}).some(([id, n]) => id !== active?.id && Number(n) > 0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [switcher, setSwitcher] = useState(false);
  const profilePath = active ? `/u/${active.handle}` : '/';
  const onProfile = pathname === profilePath;

  // tocar no Início estando no Início sobe para o topo e atualiza
  const home = (e) => {
    if (pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.dispatchEvent(new CustomEvent('ft:home-again'));
    }
  };

  return (
    <>
      <nav className="nav" aria-label="Navegação">
        <NavLink to="/" className="nav__logo" aria-label="Início" onClick={home}>
          <ThreadMark size={34} />
        </NavLink>
        <div className="nav__items">
          <NavLink to="/" end className="nav__item" aria-label="Início" onClick={home}>
            {({ isActive }) => <House size={27} strokeWidth={isActive ? 2.5 : 1.8} />}
          </NavLink>
          <NavLink to="/buscar" className="nav__item" aria-label="Buscar">
            {({ isActive }) => <Search size={27} strokeWidth={isActive ? 2.6 : 1.8} />}
          </NavLink>
          <button type="button" className="nav__item nav__item--new" aria-label="Criar" onClick={() => navigate('/novo')}>
            <span>
              <Plus size={24} strokeWidth={2} />
            </span>
          </button>
          <NavLink to="/atividade" className="nav__item" aria-label="Atividade">
            {({ isActive }) => (
              <span className="nav__icon">
                <Heart size={27} strokeWidth={isActive ? 2.4 : 1.8} fill={isActive ? 'currentColor' : 'none'} />
                {mine > 0 && <span className="nav__dot" />}
              </span>
            )}
          </NavLink>
          <NavLink
            to={profilePath}
            className={`nav__item ${onProfile ? 'active' : ''}`}
            aria-label="Perfil (segure para trocar de personagem)"
            {...longPress(() => setSwitcher(true))}
          >
            <span className="nav__icon">
              {active?.avatar_path ? (
                <Avatar character={active} size={28} className={onProfile ? 'avatar--ring' : ''} />
              ) : (
                <User size={27} strokeWidth={onProfile ? 2.5 : 1.8} />
              )}
              {others && <span className="nav__dot nav__dot--other" title="Avisos em outro personagem" />}
            </span>
          </NavLink>
        </div>
        <NavLink to="/configuracoes" className="nav__more" aria-label="Configurações">
          <Menu size={26} strokeWidth={1.8} />
        </NavLink>
      </nav>
      <CharacterSwitcher open={switcher} onClose={() => setSwitcher(false)} />
    </>
  );
}
