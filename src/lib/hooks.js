import { useCallback, useEffect, useRef, useState } from 'react';
import { pageCache } from './storage';
import { errorMessage } from './api';

// Lista com "carregar mais" (paginação por data) e cache para voltar sem recarregar.
// fetchPage(before) => Promise<array>; cada item tem `at` (ou getCursor) e uma chave (getKey)
export function useInfinite(
  key,
  fetchPage,
  { pageSize = 15, getCursor = (it) => it.at, getKey = (it) => it.post?.id ?? it.id, enabled = true } = {}
) {
  const cached = key ? pageCache.get(key) : null;
  const [items, setItems] = useState(cached?.items ?? []);
  const [done, setDone] = useState(cached?.done ?? false);
  const [loading, setLoading] = useState(!cached && enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const busy = useRef(false);
  const req = useRef(0);
  const keyRef = useRef(key);
  keyRef.current = key;
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const cursorRef = useRef(getCursor);
  cursorRef.current = getCursor;
  const keyOf = useRef(getKey);
  keyOf.current = getKey;
  const stateRef = useRef({ items, done });
  stateRef.current = { items, done };

  const persist = useCallback((forKey, next) => {
    if (forKey) pageCache.set(forKey, { ...(pageCache.get(forKey) || {}), ...next });
  }, []);

  const load = useCallback(
    async (reset = false, { quiet = false } = {}) => {
      if (!reset && (busy.current || stateRef.current.done)) return;
      const my = ++req.current;
      const forKey = keyRef.current;
      busy.current = true;
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const cur = reset ? [] : stateRef.current.items;
        const before = cur.length ? cursorRef.current(cur[cur.length - 1]) : null;
        const page = ((await fetchRef.current(before)) || []).filter((x) => x && (x.post === undefined || x.post));
        if (my !== req.current) return;
        const seen = new Set(cur.map((x) => keyOf.current(x)));
        const fresh = [];
        for (const x of page) {
          const k = keyOf.current(x);
          if (seen.has(k)) continue;
          seen.add(k);
          fresh.push(x);
        }
        const next = [...cur, ...fresh];
        const isDone = page.length < pageSize;
        setItems(next);
        setDone(isDone);
        persist(forKey, { items: next, done: isDone });
      } catch (e) {
        if (my === req.current) setError(errorMessage(e));
      } finally {
        if (my === req.current) {
          busy.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [pageSize, persist]
  );

  useEffect(() => {
    if (!enabled) return;
    const c = key ? pageCache.get(key) : null;
    if (c) {
      req.current++;
      busy.current = false;
      setItems(c.items);
      setDone(c.done);
      setLoading(false);
      setError(null);
    } else {
      setItems([]);
      setDone(false);
      load(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const update = useCallback(
    (fn) => {
      setItems((prev) => {
        const next = fn(prev);
        persist(keyRef.current, { items: next });
        return next;
      });
    },
    [persist]
  );

  return {
    items,
    loading,
    refreshing,
    done,
    error,
    loadMore: () => load(false),
    reload: () => load(true, { quiet: stateRef.current.items.length > 0 }),
    setItems: update,
  };
}

// Carrega um dado (mostra o que já tinha no cache e atualiza por trás)
export function useAsync(key, fn, deps = []) {
  const cached = key ? pageCache.get(key) : null;
  const [data, setData] = useState(cached ?? null);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const req = useRef(0);

  const reload = useCallback(async () => {
    const my = ++req.current;
    setError(null);
    try {
      const d = await fnRef.current();
      if (my !== req.current) return d;
      setData(d);
      if (key) pageCache.set(key, d);
      return d;
    } catch (e) {
      if (my === req.current) setError(errorMessage(e));
    } finally {
      if (my === req.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    const c = key ? pageCache.get(key) : null;
    if (c) {
      setData(c);
      setLoading(false);
    } else {
      setLoading(true);
      setData(null);
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  const mutate = useCallback(
    (fnOrValue) => {
      setData((prev) => {
        const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue;
        if (key) pageCache.set(key, next);
        return next;
      });
    },
    [key]
  );

  return { data, loading, error, reload, mutate };
}

// Chama fn quando o elemento aparece na tela (carregar mais no fim da lista)
export function useOnVisible(fn, enabled = true) {
  const ref = useRef(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) fnRef.current();
      },
      { rootMargin: '800px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useInterval(fn, ms, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => fnRef.current(), ms);
    return () => clearInterval(t);
  }, [ms, enabled]);
}

// Segurar o dedo (ou botão direito no computador)
export function longPress(fn, ms = 450) {
  let timer = null;
  let fired = false;
  const start = () => {
    fired = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fired = true;
      if (navigator.vibrate) navigator.vibrate(10);
      fn();
    }, ms);
  };
  const cancel = () => clearTimeout(timer);
  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onTouchCancel: cancel,
    onContextMenu: (e) => {
      e.preventDefault();
      if (!fired) fn();
    },
    onClickCapture: (e) => {
      if (fired) {
        e.preventDefault();
        e.stopPropagation();
        fired = false;
      }
    },
  };
}
