import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ImagePlus, ChartNoAxesColumn, X, Plus, Hash, AtSign, ChevronDown } from 'lucide-react';
import Avatar from '../components/Avatar';
import PostCard, { QuoteCard } from '../components/PostCard';
import CharacterSwitcher from '../components/CharacterSwitcher';
import { Button, Sheet, SheetGroup, SheetItem, Spinner, VerifiedBadge, useConfirm, useBack } from '../components/ui';
import * as api from '../lib/api';
import { preparePhoto } from '../lib/media';
import { pageCache } from '../lib/storage';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

const MAX = 500;
const MAX_PARTS = 10;
const MAX_PHOTOS = 10;

const POLICIES = [
  { id: 'todos', label: 'Qualquer pessoa', footer: 'Qualquer pessoa pode responder e citar' },
  { id: 'seguidos', label: 'Perfis que você segue', footer: 'Perfis que você segue podem responder e citar' },
  { id: 'mencionados', label: 'Só quem você mencionar', footer: 'Só perfis mencionados podem responder e citar' },
];

const DURATIONS = [
  { hours: 1, label: '1 hora' },
  { hours: 6, label: '6 horas' },
  { hours: 24, label: '1 dia' },
  { hours: 72, label: '3 dias' },
  { hours: 168, label: '7 dias' },
];

let seq = 0;
const newPart = () => ({ key: ++seq, body: '', photos: [], poll: null });

function partIsEmpty(p) {
  return !p.body.trim() && p.photos.length === 0 && !p.poll;
}

export default function Compose() {
  const [params] = useSearchParams();
  const replyId = params.get('responder');
  const quoteId = params.get('citar');
  const contextId = replyId || quoteId;
  const { active, uid } = useSession();
  const navigate = useNavigate();
  const back = useBack();
  const toast = useToast();
  const confirm = useConfirm();

  const [context, setContext] = useState(null); // post respondido ou citado
  const [contextError, setContextError] = useState(null);
  const [parts, setParts] = useState(() => {
    const first = newPart();
    const mention = (params.get('mencionar') || '').replace(/[^A-Za-z0-9._]/g, '');
    if (mention) first.body = `@${mention} `;
    return [first];
  });
  const [focus, setFocus] = useState(0);
  const [topic, setTopic] = useState('');
  const [showTopic, setShowTopic] = useState(false);
  const [policy, setPolicy] = useState('todos');
  const [policyOpen, setPolicyOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [preparing, setPreparing] = useState(0);
  const [sending, setSending] = useState(null); // texto do progresso
  const [chars, setChars] = useState(() => pageCache.get('all-chars', 10 * 60 * 1000) || []);
  const fileInput = useRef(null);
  const fileTarget = useRef(0);

  useEffect(() => {
    if (!contextId || !active) return;
    let alive = true;
    api
      .threadView(contextId, active.id)
      .then((d) => {
        if (!alive) return;
        if (!d?.post) setContextError('Esse post foi apagado.');
        else setContext(d.post);
      })
      .catch((e) => alive && setContextError(api.errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [contextId, active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // lista de personagens para o @
  useEffect(() => {
    if (chars.length) return;
    api
      .allCharacters()
      .then((list) => {
        pageCache.set('all-chars', list || []);
        setChars(list || []);
      })
      .catch(() => {});
  }, [chars.length]);

  // libera a memória das prévias
  const partsRef = useRef(parts);
  partsRef.current = parts;
  useEffect(
    () => () => partsRef.current.forEach((p) => p.photos.forEach((ph) => URL.revokeObjectURL(ph.preview))),
    []
  );

  const update = (i, fn) => setParts((ps) => ps.map((p, j) => (j === i ? fn(p) : p)));
  const hasContent = parts.some((p) => !partIsEmpty(p));
  const canAddPart = parts.length < MAX_PARTS && !partIsEmpty(parts[parts.length - 1]);
  const ready =
    !!active &&
    !sending &&
    !preparing &&
    !contextError &&
    (!contextId || !!context) &&
    parts.every((p, i) => !partIsEmpty(p) || (i === 0 && quoteId && parts.length === 1)) &&
    parts.every((p) => p.body.length <= MAX) &&
    parts.every((p) => !p.poll || p.poll.options.filter((o) => o.trim()).length >= 2);

  const title = replyId ? 'Responder' : quoteId ? 'Citar' : 'Novo thread';

  const cancel = async () => {
    if (hasContent && !sending) {
      const ok = await confirm({ title: 'Descartar thread?', confirmText: 'Descartar', danger: true });
      if (!ok) return;
    }
    back();
  };

  const pickPhotos = (i) => {
    fileTarget.current = i;
    fileInput.current?.click();
  };

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const i = fileTarget.current;
    const room = MAX_PHOTOS - (parts[i]?.photos.length || 0);
    if (files.length > room) toast(`Cada parte pode ter até ${MAX_PHOTOS} fotos.`);
    const chosen = files.slice(0, Math.max(0, room));
    setPreparing((n) => n + chosen.length);
    for (const f of chosen) {
      try {
        const ph = await preparePhoto(f);
        update(i, (p) => ({ ...p, poll: null, photos: [...p.photos, { key: ++seq, ...ph }].slice(0, MAX_PHOTOS) }));
      } catch (err) {
        toast(err.message, { kind: 'error' });
      } finally {
        setPreparing((n) => n - 1);
      }
    }
  };

  const removePhoto = (i, key) =>
    update(i, (p) => {
      const ph = p.photos.find((x) => x.key === key);
      if (ph) URL.revokeObjectURL(ph.preview);
      return { ...p, photos: p.photos.filter((x) => x.key !== key) };
    });

  const togglePoll = (i) =>
    update(i, (p) => (p.poll ? { ...p, poll: null } : { ...p, photos: [], poll: { options: ['', ''], hours: 24 } }));

  const addPart = () => {
    if (!canAddPart) return;
    setParts((ps) => [...ps, newPart()]);
    setFocus(parts.length);
  };

  const removePart = (i) => {
    setParts((ps) => {
      ps[i]?.photos.forEach((ph) => URL.revokeObjectURL(ph.preview));
      return ps.filter((_, j) => j !== i);
    });
    setFocus(Math.max(0, i - 1));
  };

  const publish = async () => {
    if (!ready) return;
    const uploaded = [];
    try {
      const total = parts.reduce((n, p) => n + p.photos.length, 0);
      const payload = [];
      for (const p of parts) {
        const media = [];
        for (const ph of p.photos) {
          setSending(total > 1 ? `Enviando fotos ${uploaded.length + 1}/${total}…` : 'Enviando foto…');
          const path = await api.uploadPhoto(uid, ph.blob);
          uploaded.push(path);
          media.push({ path, width: ph.width, height: ph.height });
        }
        const part = { body: p.body.trim(), media };
        if (p.poll) part.poll = { options: p.poll.options.map((o) => o.trim()).filter(Boolean), hours: p.poll.hours };
        payload.push(part);
      }
      setSending('Publicando…');
      const ids = await api.createThread({
        author: active.id,
        parts: payload,
        parent: replyId || null,
        quote: quoteId || null,
        topic: replyId ? null : topic.trim() || null,
        replyPolicy: replyId ? 'todos' : policy,
      });
      pageCache.deletePrefix('feed:');
      pageCache.deletePrefix('thread:');
      pageCache.deletePrefix('pp:');
      toast(replyId ? 'Resposta publicada' : 'Publicado', {
        action: ids?.[0] ? { label: 'Ver', onClick: () => navigate(`/t/${ids[0]}`) } : undefined,
        duration: 4000,
      });
      back();
    } catch (err) {
      api.removePhotos(uploaded);
      toast(api.errorMessage(err), { kind: 'error', duration: 5000 });
      setSending(null);
    }
  };

  if (!active) return null;

  return (
    <div className="compose">
      <header className="compose__top">
        <button type="button" className="link-btn compose__cancel" onClick={cancel}>
          Cancelar
        </button>
        <h1>{title}</h1>
        <span className="compose__spacer" />
      </header>

      <div className="compose__body">
        {replyId && contextError && <p className="login__error">{contextError}</p>}
        {replyId && !context && !contextError && (
          <div className="list-loader">
            <Spinner />
          </div>
        )}
        {replyId && context && (
          <div className="compose__context">
            <PostCard post={context} lineDown showChain={false} />
          </div>
        )}

        {parts.map((p, i) => (
          <ComposePart
            key={p.key}
            part={p}
            index={i}
            count={parts.length}
            author={active}
            autoFocus={i === focus}
            placeholder={
              i > 0 ? 'Diga mais…' : replyId && context ? `Responder a ${context.author.handle}…` : 'O que há de novo?'
            }
            topic={i === 0 && !replyId ? { value: topic, set: setTopic, show: showTopic, setShow: setShowTopic } : null}
            quote={i === 0 && quoteId ? context : null}
            quoteError={i === 0 && quoteId ? contextError : null}
            chars={chars}
            onChange={(fn) => update(i, fn)}
            onPickPhotos={() => pickPhotos(i)}
            onRemovePhoto={(key) => removePhoto(i, key)}
            onTogglePoll={() => togglePoll(i)}
            onRemove={() => removePart(i)}
            onSwitch={() => setSwitcher(true)}
            onFocus={() => setFocus(i)}
          />
        ))}

        <button type="button" className={`compose__add ${canAddPart ? '' : 'is-disabled'}`} onClick={addPart} disabled={!canAddPart}>
          <span className="compose__add-rail">
            <Avatar character={active} size={20} />
          </span>
          <span>Adicionar à sequência</span>
        </button>
      </div>

      <footer className="compose__foot">
        {preparing > 0 ? (
          <span className="muted small compose__preparing">
            <Spinner size={14} /> Preparando {preparing === 1 ? 'a foto' : 'as fotos'}…
          </span>
        ) : replyId ? (
          <span className="muted small">Respondendo como {active.handle}</span>
        ) : (
          <button type="button" className="link-btn compose__policy" onClick={() => setPolicyOpen(true)}>
            {POLICIES.find((x) => x.id === policy).footer}
          </button>
        )}
        <Button onClick={publish} disabled={!ready} loading={!!sending && sending === 'Publicando…'}>
          Publicar
        </Button>
      </footer>
      {sending && sending !== 'Publicando…' && <div className="compose__progress">{sending}</div>}

      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onFiles} />

      <Sheet open={policyOpen} onClose={() => setPolicyOpen(false)} title="Quem pode responder e citar">
        <SheetGroup>
          {POLICIES.map((x) => (
            <SheetItem
              key={x.id}
              onClick={() => {
                setPolicy(x.id);
                setPolicyOpen(false);
              }}
              right={policy === x.id ? '✓' : null}
            >
              {x.label}
            </SheetItem>
          ))}
        </SheetGroup>
      </Sheet>
      <CharacterSwitcher open={switcher} onClose={() => setSwitcher(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Uma parte da sequência
// ---------------------------------------------------------------------
function ComposePart({
  part,
  index,
  count,
  author,
  autoFocus,
  placeholder,
  topic,
  quote,
  quoteError,
  chars,
  onChange,
  onPickPhotos,
  onRemovePhoto,
  onTogglePoll,
  onRemove,
  onSwitch,
  onFocus,
}) {
  const area = useRef(null);
  const [caret, setCaret] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const left = MAX - part.body.length;

  // a caixa de texto cresce com o texto
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [part.body]);

  useEffect(() => {
    if (autoFocus) area.current?.focus({ preventScroll: false });
  }, [autoFocus]);

  // "@ka" antes do cursor → sugestões
  const mention = useMemo(() => {
    const before = part.body.slice(0, caret);
    const m = before.match(/(^|[^A-Za-z0-9._])@([A-Za-z0-9._]{0,30})$/);
    return m ? { query: m[2].toLowerCase(), start: caret - m[2].length - 1 } : null;
  }, [part.body, caret]);

  const suggestions = useMemo(() => {
    if (!mention || !mentionOpen) return [];
    const q = mention.query;
    return chars
      .filter((c) => !q || c.handle.startsWith(q) || (c.name || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [mention, mentionOpen, chars]);

  const insertMention = (handle) => {
    if (!mention) return;
    const before = part.body.slice(0, mention.start);
    const after = part.body.slice(caret).replace(/^[A-Za-z0-9._]*/, '');
    const text = `${before}@${handle} ${after}`.slice(0, MAX);
    onChange((p) => ({ ...p, body: text }));
    const pos = Math.min(text.length, before.length + handle.length + 2);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const typeAt = () => {
    const el = area.current;
    const pos = el ? el.selectionStart : part.body.length;
    const needsSpace = pos > 0 && !/\s/.test(part.body[pos - 1]);
    const text = `${part.body.slice(0, pos)}${needsSpace ? ' ' : ''}@${part.body.slice(pos)}`.slice(0, MAX);
    onChange((p) => ({ ...p, body: text }));
    const at = pos + (needsSpace ? 2 : 1);
    setMentionOpen(true);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at, at);
      setCaret(at);
    });
  };

  const setOption = (k, v) =>
    onChange((p) => ({ ...p, poll: { ...p.poll, options: p.poll.options.map((o, j) => (j === k ? v.slice(0, 25) : o)) } }));

  return (
    <div className={`cpart ${index < count - 1 ? 'cpart--line' : ''}`}>
      <div className="cpart__rail">
        <button type="button" className="cpart__avatar" onClick={index === 0 ? onSwitch : undefined} aria-label="Trocar de personagem">
          <Avatar character={author} size={36} />
        </button>
        <span className="cpart__line" />
      </div>
      <div className="cpart__main">
        <div className="cpart__head">
          <span className="post__name">{author.handle}</span>
          {author.is_verified && <VerifiedBadge size={14} />}
          {index === 0 && (
            <button type="button" className="cpart__switch" onClick={onSwitch} aria-label="Trocar de personagem">
              <ChevronDown size={16} />
            </button>
          )}
          {topic &&
            (topic.show || topic.value ? (
              <span className="cpart__topic">
                <span className="post__topic-sep">›</span>
                <input
                  className="cpart__topic-input"
                  value={topic.value}
                  placeholder="Adicionar um tópico"
                  maxLength={50}
                  autoFocus={!topic.value}
                  onChange={(e) => topic.set(e.target.value.replace(/^#+/, ''))}
                />
                <button
                  type="button"
                  className="icon-btn icon-btn--xs"
                  aria-label="Tirar o tópico"
                  onClick={() => {
                    topic.set('');
                    topic.setShow(false);
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            ) : (
              <button type="button" className="cpart__topic-btn" onClick={() => topic.setShow(true)}>
                <span className="post__topic-sep">›</span> Adicionar um tópico
              </button>
            ))}
          {index > 0 && (
            <button type="button" className="icon-btn icon-btn--xs cpart__remove" onClick={onRemove} aria-label="Tirar esta parte">
              <X size={16} />
            </button>
          )}
        </div>

        <textarea
          ref={area}
          className="cpart__text"
          rows={1}
          value={part.body}
          placeholder={placeholder}
          onFocus={onFocus}
          onChange={(e) => {
            onChange((p) => ({ ...p, body: e.target.value.slice(0, MAX + 50) }));
            setCaret(e.target.selectionStart);
            setMentionOpen(true);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMentionOpen(false);
            if (e.key === 'Enter' && suggestions.length && mention) {
              e.preventDefault();
              insertMention(suggestions[0].handle);
            }
          }}
          onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
        />

        {suggestions.length > 0 && (
          <div className="mention-list" role="listbox">
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                className="mention-list__item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(c.handle)}
              >
                <Avatar character={c} size={28} />
                <span className="mention-list__handle">
                  {c.handle}
                  {c.is_verified && <VerifiedBadge size={12} />}
                </span>
                <span className="mention-list__name">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {part.photos.length > 0 && (
          <div className="cpart__photos">
            {part.photos.map((ph) => (
              <div key={ph.key} className="cpart__photo" style={{ '--r': Math.min(1.5, Math.max(0.6, ph.width / ph.height)) }}>
                <img src={ph.preview} alt="" />
                <button type="button" className="cpart__photo-x" onClick={() => onRemovePhoto(ph.key)} aria-label="Tirar a foto">
                  <X size={14} strokeWidth={2.6} />
                </button>
              </div>
            ))}
          </div>
        )}

        {part.poll && (
          <div className="poll-edit">
            {part.poll.options.map((o, k) => (
              <div key={k} className="poll-edit__row">
                <input
                  className="field field--sm"
                  value={o}
                  maxLength={25}
                  placeholder={k < 2 ? `Opção ${k + 1}` : 'Opção (opcional)'}
                  onChange={(e) => setOption(k, e.target.value)}
                />
                {k >= 2 && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--xs"
                    aria-label="Tirar opção"
                    onClick={() => onChange((p) => ({ ...p, poll: { ...p.poll, options: p.poll.options.filter((_, j) => j !== k) } }))}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            {part.poll.options.length < 4 && (
              <button
                type="button"
                className="link-btn poll-edit__add"
                onClick={() => onChange((p) => ({ ...p, poll: { ...p.poll, options: [...p.poll.options, ''] } }))}
              >
                <Plus size={14} /> Adicionar outra opção
              </button>
            )}
            <div className="poll-edit__dur">
              <span className="muted small">Termina em</span>
              {DURATIONS.map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  className={`chip ${part.poll.hours === d.hours ? 'is-active' : ''}`}
                  onClick={() => onChange((p) => ({ ...p, poll: { ...p.poll, hours: d.hours } }))}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {quoteError && <p className="login__error">{quoteError}</p>}
        {quote && <QuoteCard post={quote} onOpen={() => {}} />}

        <div className="cpart__tools">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={onPickPhotos}
            aria-label="Fotos"
            disabled={part.photos.length >= MAX_PHOTOS}
          >
            <ImagePlus size={20} strokeWidth={1.7} />
          </button>
          <button
            type="button"
            className={`icon-btn icon-btn--sm ${part.poll ? 'is-on' : ''}`}
            onClick={onTogglePoll}
            aria-label="Enquete"
          >
            <ChartNoAxesColumn size={20} strokeWidth={1.7} />
          </button>
          <button type="button" className="icon-btn icon-btn--sm" onClick={typeAt} aria-label="Mencionar">
            <AtSign size={19} strokeWidth={1.7} />
          </button>
          {topic && !topic.show && !topic.value && (
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => topic.setShow(true)} aria-label="Tópico">
              <Hash size={19} strokeWidth={1.7} />
            </button>
          )}
          {part.body.length > MAX - 100 && <span className={`counter ${left < 0 ? 'is-over' : left < 20 ? 'is-low' : ''}`}>{left}</span>}
        </div>
      </div>
    </div>
  );
}
