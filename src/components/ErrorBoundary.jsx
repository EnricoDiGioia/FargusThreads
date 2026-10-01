import { Component } from 'react';
import { useLocation } from 'react-router';
import { ThreadMark } from './Brand';
import { pageCache } from '../lib/storage';

// Rede de segurança: se alguma tela der erro, mostra um aviso com botões
// em vez de deixar o app inteiro em branco.

const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading (CSS )?chunk \S+ failed/i;

export function isChunkError(err) {
  return CHUNK_ERROR.test(String(err?.message || err || ''));
}

// Recarrega o app uma vez só: se já recarregou há pouco, não entra em loop
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem('ft-auto-reload') || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem('ft-auto-reload', String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

function CrashScreen({ error, onRetry, onHome, full }) {
  const chunk = isChunkError(error);
  const detail = String(error?.message || error || 'erro desconhecido');
  return (
    <div className={full ? 'crash crash--full' : 'crash'} role="alert">
      <ThreadMark size={48} />
      <h2>{chunk ? 'Saiu uma versão nova do FargusThreads' : 'Algo deu errado nesta tela'}</h2>
      <p className="muted">
        {chunk
          ? 'Recarregue para continuar usando o app.'
          : 'Toque em "Tentar de novo". Se continuar acontecendo, recarregue o app. O detalhe abaixo ajuda a descobrir o que houve.'}
      </p>
      <div className="crash__actions">
        {!chunk && (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            Tentar de novo
          </button>
        )}
        <button type="button" className={`btn ${chunk ? 'btn--primary' : 'btn--outline'}`} onClick={() => window.location.reload()}>
          Recarregar
        </button>
        {full && !chunk && (
          <button type="button" className="btn btn--outline" onClick={onHome}>
            Ir para o início
          </button>
        )}
      </div>
      {!chunk && <code className="crash__detail">{detail}</code>}
    </div>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = () => {
      for (const k of pageCache.keys()) pageCache.delete(k);
      this.setState({ error: null });
    };
    this.goHome = () => {
      const already = !window.location.hash || window.location.hash === '#/';
      window.location.hash = '#/';
      if (already || this.props.resetKey === undefined) this.retry();
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[FargusThreads] erro na tela:', error, info?.componentStack || '');
    if (isChunkError(error)) reloadOnce();
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.retry();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <CrashScreen error={this.state.error} onRetry={this.retry} onHome={this.goHome} full={this.props.full} />;
  }
}

// Versão que volta ao normal sozinha quando a pessoa troca de tela
export function RouteErrorBoundary({ children, full = false }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname} full={full}>
      {children}
    </ErrorBoundary>
  );
}
