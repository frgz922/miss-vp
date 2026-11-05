'use client';
import Link from 'next/link';
import StaffShell from '@/components/StaffShell';
import { Badge, Loading, Photo } from '@/components/ui';
import Crown from '@/components/Crown';
import Icon from '@/components/Icon';
import { useStaffData } from '@/lib/useStaffData';
import { EVENT } from '@/lib/config';
import { fullName, mainPhoto, ageFrom, fmt } from '@/lib/utils';

function Dashboard() {
  const { loading, error, participants, totalVotes } = useStaffData();
  if (loading) return <Loading />;
  const active = participants.filter((p) => p.status !== 'pendiente');
  const inReview = participants.filter((p) => p.status === 'en_revision').length;
  const finalists = participants.filter((p) => p.is_finalist).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard del Staff</h1>
          <p className="muted">Gestiona y evalúa a las participantes</p>
        </div>
      </div>
      {error && <div className="notice mb"><Icon name="info" /> <span className="error">{error}</span></div>}

      <div className="stats">
        <div className="card stat"><div className="stat-icon"><Icon name="users" /></div><div><div className="muted small">Total Participantes</div><div className="stat-value">{active.length}</div><div className="muted small">{participants.length - active.length} sin completar</div></div></div>
        <div className="card stat"><div className="stat-icon"><Icon name="star" /></div><div><div className="muted small">Por evaluar</div><div className="stat-value">{inReview}</div></div></div>
        <div className="card stat"><div className="stat-icon"><Icon name="award" /></div><div><div className="muted small">Seleccionadas</div><div className="stat-value">{finalists} / {EVENT.finalists}</div></div></div>
        <div className="card stat"><div className="stat-icon"><Icon name="heart" /></div><div><div className="muted small">Votos del público</div><div className="stat-value">{totalVotes}</div></div></div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">Participantes Recientes <Link href="/staff/participantes" className="muted small row-flex">Ver todas <Icon name="right" /></Link></div>
          {active.length === 0 ? <div className="empty">Aún no hay inscripciones enviadas.</div> : active.slice(0, 6).map((p) => (
            <Link key={p.id} href={`/staff/evaluar/${p.id}`} className="list-row">
              <Photo src={mainPhoto(p)} className="thumb" />
              <div className="list-main"><b>{fullName(p)}</b><span className="muted small">{p.state} · {ageFrom(p.birth_date)} años</span></div>
              <span className="num muted small">{fmt(p.juryAvg)}</span>
              <Badge status={p.status} />
            </Link>
          ))}
        </div>
        <div className="card promo">
          <Crown className="hero-crown" />
          <div className="promo-title gold-text">{EVENT.line1}<br />{EVENT.line2}</div>
          <p className="promo-text">Elegimos a las {EVENT.finalists} que brillarán en la final</p>
          <Link href="/staff/final" className="btn btn-gold btn-sm">Ir a la fase final <Icon name="right" /></Link>
        </div>
      </div>
    </>
  );
}

export default function StaffPage() {
  return <StaffShell active="dashboard"><Dashboard /></StaffShell>;
}
