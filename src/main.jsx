import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import App from './App';
import ErrorBoundary, { reloadOnce } from './components/ErrorBoundary';
import { initPwa, registerServiceWorker } from './lib/pwa';
import { applyTheme } from './lib/theme';

applyTheme();
initPwa();
registerServiceWorker();

// o celular mudou de claro para escuro com o tema automático
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());

// Saiu versão nova com o app aberto e um pedaço antigo sumiu do servidor:
// recarrega uma vez para pegar a versão nova (em vez de quebrar a tela)
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnce()) event.preventDefault();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary full>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
