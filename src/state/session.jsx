import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import * as api from '../lib/api';
import { syncFromGram, signOutEverywhere } from '../lib/auth';
import { local, pageCache } from '../lib/storage';
import { clearPostPatches } from '../lib/postStore';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(isConfigured ? undefined : null); // undefined = carregando
  const [me, setMe] = useState(undefined); // undefined = carregando; null = sem acesso
  const [meError, setMeError] = useState(null);
  const [activeId, setActiveId] = useState(() => local.get('ft-active'));
  const [unread, setUnread] = useState({});
  const uidRef = useRef(null);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => alive && setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const uid = session?.user?.id ?? null;
  uidRef.current = uid;

  const refreshMe = useCallback(async () => {
    if (!uidRef.current) return null;
    try {
      const data = await api.me();
      setMe(data ?? null);
      setMeError(null);
      return data;
    } catch (e) {
      setMeError(api.errorMessage(e));
      return null;
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!uidRef.current) return;
    try {
      setUnread((await api.unreadCounts()) || {});
    } catch {
      /* tenta de novo na próxima */
    }
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!uid) {
      setMe(null);
      setUnread({});
      pageCache.clear();
      clearPostPatches();
      return;
    }
    setMe(undefined);
    let alive = true;
    (async () => {
      await refreshMe();
      refreshUnread();
      // personagens novos ou mudados no FargusGram (no máximo a cada 15 min)
      try {
        if (alive && (await syncFromGram())) await refreshMe();
      } catch (e) {
        console.warn('[FargusThreads] sincronização com o FargusGram:', e?.message || e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid, session === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  // avisos novos: a cada minuto e quando o app volta para a tela
  useEffect(() => {
    if (!uid) return;
    const t = setInterval(refreshUnread, 60 * 1000);
    const onVis = () => document.visibilityState === 'visible' && refreshUnread();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [uid, refreshUnread]);

  const characters = useMemo(() => me?.characters ?? [], [me]);
  // sem escolha salva, começa no personagem que está aberto no FargusGram
  const active =
    characters.find((c) => c.id === activeId) || characters.find((c) => c.id === local.get('fg-active')) || characters[0] || null;

  const setActive = useCallback((id) => {
    local.set('ft-active', id);
    setActiveId(id);
    window.scrollTo(0, 0);
  }, []);

  const patchCharacter = useCallback((c) => {
    setMe((m) => (m ? { ...m, characters: m.characters.map((x) => (x.id === c.id ? { ...x, ...c } : x)) } : m));
  }, []);

  const signOut = useCallback(async () => {
    await signOutEverywhere();
    local.set('ft-active', null);
    pageCache.clear();
    clearPostPatches();
    setMe(null);
  }, []);

  const value = {
    session,
    uid,
    me,
    meError,
    characters,
    active,
    unread,
    totalUnread: Object.values(unread).reduce((a, b) => a + (Number(b) || 0), 0),
    isAdmin: !!me?.is_admin,
    setActive,
    refreshMe,
    refreshUnread,
    setUnread,
    patchCharacter,
    signOut,
    isMine: (characterId) => characters.some((c) => c.id === characterId),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
