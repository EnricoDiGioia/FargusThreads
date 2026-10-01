import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, Outlet } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { SessionProvider, useSession } from './state/session';
import { ToastProvider, useToast } from './state/toast';
import { ConfirmProvider, Button } from './components/ui';
import BottomNav from './components/BottomNav';
import ScrollManager from './components/ScrollManager';
import { RouteErrorBoundary } from './components/ErrorBoundary';
import { ThreadMark, GramMark } from './components/Brand';
import { isConfigured } from './lib/supabase';
import { onSwUpdate } from './lib/pwa';
import { local } from './lib/storage';
import { GRAM_SITE } from './config';

import Login from './pages/Login';
import Onboarding, { onboardKey } from './pages/Onboarding';
import Home from './pages/Home';
import Search from './pages/Search';
import Activity from './pages/Activity';
import Profile from './pages/Profile';
import ThreadPage from './pages/ThreadPage';
import Compose from './pages/Compose';
import Settings from './pages/Settings';
import { FollowList, PostActivity } from './pages/Lists';
import { Topic, Saved } from './pages/Topic';

// Avisa quando existe uma versão nova do app publicada
function UpdateNotice() {
  const toast = useToast();
  useEffect(
    () =>
      onSwUpdate((apply) =>
        toast('Nova versão do FargusThreads disponível', { action: { label: 'Atualizar', onClick: apply }, duration: 60000 })
      ),
    [toast]
  );
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <UpdateNotice />
        <ConfirmProvider>
          <SessionProvider>
            <Gate />
          </SessionProvider>
        </ConfirmProvider>
      </ToastProvider>
    </HashRouter>
  );
}

function Splash() {
  return (
    <div className="splash">
      <ThreadMark size={64} className="splash__mark" />
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="center-screen">
      <ThreadMark size={52} />
      <h2>Falta configurar o Supabase</h2>
      <p className="muted">
        Abra o arquivo <code>src/config.js</code> e cole a URL e a chave pública do Supabase do FargusThreads. O passo a passo está no
        guia docs/DEPLOY.md.
      </p>
    </div>
  );
}

function NoAccess() {
  const { signOut, meError, refreshMe } = useSession();
  return (
    <div className="center-screen">
      <ThreadMark size={52} />
      <h2>{meError ? 'Não deu para carregar sua conta' : 'Conta sem acesso'}</h2>
      <p className="muted">
        {meError || 'Esta conta não está mais no grupo do FargusGram. Fale com o admin.'}
      </p>
      {meError && <Button onClick={refreshMe}>Tentar de novo</Button>}
      <Button variant="outline" onClick={signOut}>
        Sair
      </Button>
    </div>
  );
}

function NoCharacters() {
  const { signOut, refreshMe } = useSession();
  return (
    <div className="center-screen">
      <GramMark size={52} />
      <h2>Crie um personagem no FargusGram</h2>
      <p className="muted">Os personagens do FargusThreads vêm do FargusGram. Crie o seu lá e volte aqui.</p>
      <a className="btn btn--primary" href={`${GRAM_SITE}#/novo-personagem`} target="_blank" rel="noopener noreferrer">
        Abrir o FargusGram <ArrowUpRight size={16} />
      </a>
      <Button variant="outline" onClick={() => window.location.reload()}>
        Já criei
      </Button>
      <button type="button" className="link-btn" onClick={signOut}>
        Sair
      </button>
      <span hidden onClick={refreshMe} />
    </div>
  );
}

function Gate() {
  const { session, uid, me, meError, characters } = useSession();
  const [onboarded, setOnboarded] = useState(false);
  if (!isConfigured) return <NotConfigured />;
  if (session === undefined) return <Splash />;
  if (!session) return <Login />;
  if (me === undefined && !meError) return <Splash />;
  if (!me) return <NoAccess />;
  if (characters.length === 0) return <NoCharacters />;
  if (!onboarded && local.get(onboardKey(uid)) !== '1') return <Onboarding onDone={() => setOnboarded(true)} />;
  return <AppRoutes />;
}

function Shell() {
  return (
    <div className="app">
      <BottomNav />
      <main className="app__main">
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </div>
  );
}

function AppRoutes() {
  return (
    <RouteErrorBoundary full>
      <ScrollManager />
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="buscar" element={<Search />} />
          <Route path="atividade" element={<Activity />} />
          <Route path="u/:handle" element={<Profile />} />
          <Route path="u/:handle/:kind" element={<FollowList />} />
          <Route path="t/:id" element={<ThreadPage />} />
          <Route path="t/:id/atividade" element={<PostActivity />} />
          <Route path="t/:id/atividade/:kind" element={<PostActivity />} />
          <Route path="topico/:topic" element={<Topic />} />
          <Route path="salvos" element={<Saved />} />
          <Route path="configuracoes" element={<Settings />} />
        </Route>
        <Route path="novo" element={<Compose />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RouteErrorBoundary>
  );
}
