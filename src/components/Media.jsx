import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { mediaUrl } from '../lib/supabase';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Fotos do post: uma só ocupa a largura; várias viram uma fileira que desliza
export default function Media({ media }) {
  const [open, setOpen] = useState(null);
  if (!media?.length) return null;

  const show = (i) => (e) => {
    e.stopPropagation();
    setOpen(i);
  };

  return (
    <>
      {media.length === 1 ? (
        <button
          type="button"
          className="media media--single"
          style={{ '--r': clamp(media[0].width / media[0].height, 0.75, 1.91) }}
          onClick={show(0)}
          aria-label="Ver foto"
        >
          <img src={mediaUrl(media[0].path)} alt="" crossOrigin="anonymous" loading="lazy" decoding="async" draggable="false" />
        </button>
      ) : (
        <div className="media media--row" onClick={(e) => e.stopPropagation()}>
          {media.map((m, i) => (
            <button
              key={m.path}
              type="button"
              className="media__item"
              style={{ '--r': clamp(m.width / m.height, 0.6, 1.5) }}
              onClick={show(i)}
              aria-label={`Ver foto ${i + 1}`}
            >
              <img src={mediaUrl(m.path)} alt="" crossOrigin="anonymous" loading="lazy" decoding="async" draggable="false" />
            </button>
          ))}
        </div>
      )}
      {open !== null && <Lightbox media={media} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ media, start, onClose }) {
  const strip = useRef(null);
  const [index, setIndex] = useState(start);

  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && el) el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
      if (e.key === 'ArrowLeft' && el) el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('no-scroll');
    };
  }, [start, onClose]);

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Fotos" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="lightbox__close" onClick={onClose} aria-label="Fechar">
        <X size={26} />
      </button>
      {media.length > 1 && (
        <div className="lightbox__count">
          {index + 1} / {media.length}
        </div>
      )}
      <div
        className="lightbox__strip"
        ref={strip}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        onClick={onClose}
      >
        {media.map((m) => (
          <div className="lightbox__slide" key={m.path}>
            <img src={mediaUrl(m.path)} alt="" crossOrigin="anonymous" draggable="false" onClick={(e) => e.stopPropagation()} />
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
