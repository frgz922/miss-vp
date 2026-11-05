import { useId } from 'react';

export default function Crown({ className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} viewBox="0 0 120 84" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c2" />
          <stop offset=".45" stopColor="#e9bd62" />
          <stop offset="1" stopColor="#a8742a" />
        </linearGradient>
        <radialGradient id={`j${id}`} cx=".35" cy=".35" r=".7">
          <stop offset="0" stopColor="#e8d4ff" />
          <stop offset="1" stopColor="#7c3aed" />
        </radialGradient>
      </defs>
      <path d="M12 64 L6 24 L32 44 L45 14 L60 40 L75 14 L88 44 L114 24 L108 64 Z" fill={`url(#g${id})`} />
      <path d="M22 58 L18 36 L34 50 Z M98 58 L102 36 L86 50 Z" fill="rgba(255,255,255,.25)" />
      <rect x="11" y="63" width="98" height="12" rx="4" fill={`url(#g${id})`} />
      {[6, 45, 75, 114].map((x, i) => (
        <circle key={i} cx={x} cy={i === 1 || i === 2 ? 12 : 22} r="4.5" fill={`url(#g${id})`} />
      ))}
      <circle cx="60" cy="8" r="6" fill={`url(#g${id})`} />
      <circle cx="60" cy="54" r="6" fill={`url(#j${id})`} />
      <circle cx="38" cy="69" r="3.2" fill={`url(#j${id})`} />
      <circle cx="60" cy="69" r="3.2" fill="#fff" opacity=".85" />
      <circle cx="82" cy="69" r="3.2" fill={`url(#j${id})`} />
    </svg>
  );
}
