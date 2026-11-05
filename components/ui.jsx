'use client';
import Link from 'next/link';
import Crown from './Crown';
import Icon from './Icon';
import { EVENT, STATUS } from '@/lib/config';

export function Logo({ size = 'sm' }) {
  return (
    <div className={`logo logo-${size}`}>
      <Crown className="logo-crown" />
      <div className="logo-text">
        <span className="logo-l1 gold-text">{EVENT.line1}</span>
        <span className="logo-l2">{EVENT.line2}</span>
      </div>
    </div>
  );
}

export function Photo({ src, alt = '', className = '' }) {
  if (src) return <img src={src} alt={alt} className={`photo ${className}`} loading="lazy" />;
  return (
    <div className={`photo photo-empty ${className}`} role="img" aria-label={alt || 'Sin foto'}>
      <Icon name="user" />
    </div>
  );
}

export function Stars({ value = 0 }) {
  return (
    <span className="stars" aria-label={`${value} de 10`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, (value - (i - 1) * 2) / 2));
        return (
          <span key={i} className="star">
            <span className="star-bg">★</span>
            <span className="star-fg" style={{ width: `${fill * 100}%` }}>★</span>
          </span>
        );
      })}
    </span>
  );
}

export function Badge({ status, finalist }) {
  if (finalist) return <span className="badge b-fin">Finalista</span>;
  const s = STATUS[status] || STATUS.pendiente;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export function Loading({ full }) {
  return (
    <div className={full ? 'center center-full' : 'center'}>
      <div className="spinner" />
    </div>
  );
}

export function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className={`toast ${msg.type === 'error' ? 'toast-err' : ''}`} onClick={onClose}>
      <Icon name={msg.type === 'error' ? 'info' : 'check'} /> {msg.text}
    </div>
  );
}

export function PublicHeader({ right }) {
  return (
    <header className="topbar">
      <Link href="/"><Logo /></Link>
      <div className="topbar-right">
        {right ?? (
          <Link href="/" className="btn btn-ghost btn-sm"><Icon name="home" /> Volver al inicio</Link>
        )}
      </div>
    </header>
  );
}

export function AppShell({ links, active, userName, avatar, onLogout, children }) {
  return (
    <div className="app">
      <header className="topbar">
        <Link href="/"><Logo /></Link>
        <div className="user-chip">
          {avatar ? <img className="avatar" src={avatar} alt="" /> : <span className="avatar avatar-empty"><Icon name="user" /></span>}
          <span className="user-name">{userName}</span>
        </div>
      </header>
      <div className="app-body">
        <nav className="sidebar">
          {links.map((l) => (
            <Link key={l.key} href={l.href} className={`side-link ${active === l.key ? 'active' : ''}`}>
              <Icon name={l.icon} /> {l.label}
            </Link>
          ))}
          <div className="side-spacer" />
          <button className="side-link" onClick={onLogout}><Icon name="logout" /> Cerrar Sesión</button>
        </nav>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
