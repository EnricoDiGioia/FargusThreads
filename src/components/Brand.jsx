import { useId } from 'react';

// Marca do FargusThreads: um "F" desenhado com uma linha só, com as pontas
// enroladas como fio de costura
export function ThreadMark({ size = 32, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 41.5V16.5C16 11 19.6 7.5 25 7.5h6.5c4.6 0 6.2 5.3 2.6 7.3-3 1.7-6.4-1.3-4.2-4" />
        <path d="M16 25h11.5c3.8 0 4.9 4.4 2.2 6.4" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = '' }) {
  return (
    <span className={`wordmark ${className}`}>
      <ThreadMark size={26} />
      <span>fargusthreads</span>
    </span>
  );
}

// Marca do FargusGram (o portal com a fissura), para os links de lá
export function GramMark({ size = 22, className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`gm-${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#06b6d4" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="16.5" fill="none" stroke={`url(#gm-${id})`} strokeWidth="4.5" />
      <path
        d="M27.5 4.5 L20 21.5 L28.5 25.5 L20.5 43.5"
        fill="none"
        stroke={`url(#gm-${id})`}
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
