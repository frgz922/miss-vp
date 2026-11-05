import Link from 'next/link';
import Crown from '@/components/Crown';
import Icon from '@/components/Icon';
import { EVENT } from '@/lib/config';

export default function Home() {
  return (
    <main className="hero">
      <div className="lights" aria-hidden="true">
        <div className="beam" /><div className="beam" /><div className="beam" /><div className="beam" />
        <div className="sparkles" />
        <div className="stage-glow" />
      </div>

      <div className="hero-inner">
        <div className="hero-brand">
          <Crown className="hero-crown" />
          <h1 className="hero-title gold-text">{EVENT.line1.split(' ').map((w, i) => <span key={i}>{w}<br /></span>)}</h1>
          <div className="hero-sub">{EVENT.line2}</div>
          <p className="script hero-tag">{EVENT.tagline}</p>
        </div>

        <div className="card login-card">
          <div>
            <h2>Iniciar Sesión</h2>
            <p className="muted small">Accede a tu cuenta</p>
          </div>
          <Link className="btn btn-gold btn-block" href="/login?rol=participante"><Icon name="user" /> Soy Participante</Link>
          <Link className="btn btn-purple btn-block" href="/login?rol=staff"><Icon name="shield" /> Soy del Staff</Link>
          <div className="divider">o</div>
          <Link className="btn btn-ghost btn-block" href="/votar"><Icon name="heart" /> Votación del Público</Link>
          <Link className="btn btn-ghost btn-block" href="/finalistas"><Icon name="award" /> Ver las finalistas</Link>
        </div>
      </div>
    </main>
  );
}
