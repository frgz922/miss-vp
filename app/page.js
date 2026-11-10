'use client';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { EVENT } from '@/lib/config';
import { useSettings } from '@/lib/useSettings';

export default function Home() {
  // Los enlaces solo aparecen si el staff activó la votación o publicó las finalistas
  const settings = useSettings();
  const showVote = settings?.voting_open === true;
  const showFinalists = settings?.finalists_public === true;
  const regClosed = settings?.registrations_open === false;

  return (
    <main className="hero">
      {/* Imagen de portada: cámbiala reemplazando public/fondo-inicio.jpg */}
      <img
        className="hero-bg"
        src="/fondo-inicio.jpg"
        alt={`${EVENT.line1} ${EVENT.line2} — ${EVENT.tagline}`}
        fetchPriority="high"
      />
      <h1 className="sr-only">{EVENT.line1} {EVENT.line2}</h1>

      <div className="card login-card">
        <div>
          <h2 className="gold-text">Iniciar Sesión</h2>
          <p className="muted small" style={{ margin: 0 }}>Accede a tu cuenta</p>
        </div>
        <div className="login-btns">
          {regClosed
            ? <button className="btn btn-gold" disabled title="Las inscripciones están cerradas"><Icon name="user" /> Participante</button>
            : <Link className="btn btn-gold" href="/login?rol=participante"><Icon name="user" /> Participante</Link>}
          <Link className="btn btn-purple" href="/login?rol=staff"><Icon name="shield" /> Staff</Link>
        </div>
        {regClosed && <p className="muted small" style={{ margin: 0 }}>Las inscripciones están cerradas.</p>}
        {(showVote || showFinalists) && (
          <div className="login-links">
            {showVote && <Link href="/votar"><Icon name="heart" /> Votación del público</Link>}
            {showFinalists && <Link href="/finalistas"><Icon name="award" /> Finalistas</Link>}
          </div>
        )}
      </div>
    </main>
  );
}
