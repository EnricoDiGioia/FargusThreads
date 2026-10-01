import { useState } from 'react';
import Avatar from '../components/Avatar';
import { ThreadMark } from '../components/Brand';
import { Button, VerifiedBadge } from '../components/ui';
import { importGramFollows } from '../lib/auth';
import { local } from '../lib/storage';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

export const onboardKey = (uid) => `ft-onboarded:${uid}`;

// Primeira vez: mostra os personagens e oferece seguir as mesmas contas do FargusGram
export default function Onboarding({ onDone }) {
  const { uid, characters } = useSession();
  const toast = useToast();
  const [importFollows, setImportFollows] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const finish = () => {
    local.set(onboardKey(uid), '1');
    onDone();
  };

  const go = async () => {
    if (!importFollows) return finish();
    setBusy(true);
    setError(null);
    try {
      const n = await importGramFollows();
      toast(n === 1 ? '1 perfil seguido' : `${n} perfis seguidos`);
      finish();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <ThreadMark size={52} />
      <h1>Bem-vindo ao FargusThreads</h1>
      <p className="muted">Estes são os seus personagens, trazidos do FargusGram com o mesmo @, foto e selo.</p>

      <div className="onboard__chars">
        {characters.map((c) => (
          <div key={c.id} className="onboard__char">
            <Avatar character={c} size={56} />
            <span className="onboard__handle">
              {c.handle}
              {c.is_verified && <VerifiedBadge size={12} />}
            </span>
          </div>
        ))}
      </div>

      <label className="onboard__option">
        <span>
          <strong>Seguir as mesmas contas</strong>
          <span className="muted small">
            Cada personagem passa a seguir aqui quem já segue no FargusGram. Ninguém recebe aviso.
          </span>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={importFollows}
          onChange={(e) => setImportFollows(e.target.checked)}
          disabled={busy}
        />
      </label>

      {error && (
        <p className="login__error" role="alert">
          {error}
        </p>
      )}

      <Button onClick={go} loading={busy} className="btn--block btn--lg">
        Entrar no FargusThreads
      </Button>
      {error && (
        <button type="button" className="link-btn" onClick={finish}>
          Continuar sem importar
        </button>
      )}
    </div>
  );
}
