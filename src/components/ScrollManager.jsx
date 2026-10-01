import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

// Voltar para uma tela devolve a rolagem de onde a pessoa estava;
// abrir uma tela nova começa do topo
const positions = new Map();

export default function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const keyRef = useRef(location.key);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const save = () => positions.set(keyRef.current, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, []);

  useLayoutEffect(() => {
    keyRef.current = location.key;
    if (navType !== 'POP') {
      window.scrollTo(0, 0);
      return;
    }
    const y = positions.get(location.key) || 0;
    // a lista pode demorar um pouco para desenhar: tenta algumas vezes
    let tries = 0;
    let raf = 0;
    const attempt = () => {
      window.scrollTo(0, y);
      if (Math.abs(window.scrollY - y) > 2 && tries++ < 20) raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(raf);
  }, [location.key, navType]);

  return null;
}
