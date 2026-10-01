import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import Avatar from '../components/Avatar';
import { ThreadMark, GramMark } from '../components/Brand';
import { Button } from '../components/ui';
import { GRAM_SITE } from '../config';
import { continueWithGram, gramCharactersOf, loginWithPassword, readGramAppSession } from '../lib/auth';
import { local } from '../lib/storage';

// Entrar com a conta do FargusGram (como o Threads de verdade entra com a do Instagram)
export default function Login() {
  const [gramSession] = useState(() => readGramAppSession());
  const [gramChar, setGramChar] = useState(null);
  const [useForm, setUseForm] = useState(!gramSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // FargusGram aberto neste navegador: mostra o personagem para "Continuar como"
  useEffect(() => {
    if (!gramSession) return;
    let alive = true;
    gramCharactersOf(gramSession).then((list) => {
      if (!alive || !list?.length) return;
      const activeId = local.get('fg-active');
      setGramChar(list.find((c) => c.id === activeId) || list[0]);
    });
    return () => {
      alive = false;
    };
  }, [gramSession]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message || String(e));
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha.');
      return;
    }
    run(() => loginWithPassword(email, password));
  };

  return (
    <div className="login">
      <div className="login__card">
        <ThreadMark size={64} className="login__mark" />
        <h1 className="login__title">FargusThreads</h1>
        <p className="login__lead">Entre com a sua conta do FargusGram. Seus personagens e NPCs já estão aqui.</p>

        {!useForm && gramSession ? (
          <div className="login__gram">
            <button type="button" className="login__continue" onClick={() => run(continueWithGram)} disabled={busy}>
              {gramChar ? (
                <Avatar character={gramChar} size={44} />
              ) : (
                <span className="login__gram-icon">
                  <GramMark size={30} />
                </span>
              )}
              <span className="login__continue-text">
                <span className="login__continue-label">Continuar com o FargusGram</span>
                <span className="login__continue-who">{gramChar ? gramChar.handle : gramSession.user?.email}</span>
              </span>
              <GramMark size={24} />
            </button>
            {busy && <p className="muted small center">Entrando…</p>}
            <button type="button" className="link-btn" onClick={() => setUseForm(true)} disabled={busy}>
              Entrar com outra conta
            </button>
          </div>
        ) : (
          <form className="login__form" onSubmit={submit}>
            <input
              className="field"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="E-mail do FargusGram"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" loading={busy} className="btn--block">
              Entrar
            </Button>
            {gramSession && (
              <button type="button" className="link-btn" onClick={() => setUseForm(false)} disabled={busy}>
                Voltar
              </button>
            )}
          </form>
        )}

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        <div className="login__foot">
          <a href={`${GRAM_SITE}#/cadastro`} target="_blank" rel="noopener noreferrer">
            Ainda não tem conta? Cadastre-se no FargusGram <ArrowUpRight size={14} />
          </a>
          <span className="muted small">Esqueceu a senha? O admin redefine no Painel do admin do FargusGram.</span>
        </div>
      </div>
    </div>
  );
}
