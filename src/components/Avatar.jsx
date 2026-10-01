import { useState } from 'react';
import { avatarUrl } from '../lib/supabase';

// Foto de perfil (vem do FargusGram). Sem foto: a inicial do nome.
export default function Avatar({ character, size = 36, className = '' }) {
  const [broken, setBroken] = useState(false);
  const src = !broken && character?.avatar_path ? avatarUrl(character.avatar_path) : null;
  const letter = (character?.name || character?.handle || '?').trim().charAt(0).toUpperCase();
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {src ? (
        <img src={src} alt="" crossOrigin="anonymous" loading="lazy" decoding="async" draggable="false" onError={() => setBroken(true)} />
      ) : (
        <span className="avatar__letter" aria-hidden="true">
          {letter}
        </span>
      )}
    </span>
  );
}
