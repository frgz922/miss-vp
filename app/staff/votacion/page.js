'use client';
import { useState } from 'react';
import StaffShell from '@/components/StaffShell';
import { Loading, Photo, Toast } from '@/components/ui';
import Icon from '@/components/Icon';
import { useStaffData } from '@/lib/useStaffData';
import { getSupabase } from '@/lib/supabase';
import { fullName, mainPhoto } from '@/lib/utils';

const TOGGLES = [
  { key: 'registrations_open', title: 'Inscripciones abiertas', desc: 'Al apagarlo, las participantes ya no pueden inscribirse ni modificar su postulación (el botón "Participante" se desactiva).' },
  { key: 'voting_open', title: 'Votación abierta', desc: 'Permite que el público vote en /votar.' },
  { key: 'results_public', title: 'Mostrar resultados al público', desc: 'Muestra el conteo de votos en la página de votación.' },
  { key: 'finalists_public', title: 'Finalistas publicadas', desc: 'Muestra las finalistas en /finalistas.' },
];

function Votacion() {
  const { loading, participants, settings, totalVotes, reload } = useStaffData();
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  const ranked = participants.filter((p) => p.status !== 'pendiente').sort((a, b) => b.votes - a.votes);
  const max = Math.max(1, ...ranked.map((p) => p.votes));

  async function toggle(key) {
    setBusy(true);
    const { error } = await getSupabase().from('settings').update({ [key]: !settings[key] }).eq('id', 1);
    setBusy(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else { setMsg({ type: 'ok', text: 'Ajuste guardado.' }); reload(); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Votación y ajustes</h1>
          <p className="muted">{totalVotes} votos registrados · 1 voto por IP</p>
        </div>
      </div>

      <div className="card mb">
        {TOGGLES.map((t) => (
          <div key={t.key} className="switch-row">
            <div><b>{t.title}</b><div className="muted small">{t.desc}</div></div>
            <label className="switch" aria-label={t.title}>
              <input type="checkbox" checked={!!settings[t.key]} onChange={() => toggle(t.key)} disabled={busy} />
              <span />
            </label>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head"><span className="row-flex"><Icon name="bar" /> Resultados del público</span></div>
        {ranked.length === 0 ? <div className="empty">Aún no hay participantes.</div> : ranked.map((p, i) => (
          <div key={p.id} className="list-row">
            <span className={`rank ${i < 3 && p.votes ? 'rank-top' : ''}`}>{i + 1}</span>
            <Photo src={mainPhoto(p)} className="thumb" />
            <div className="list-main">
              <b>{fullName(p)}</b>
              <div className="bar" style={{ marginTop: 6 }}><span style={{ width: `${(p.votes / max) * 100}%` }} /></div>
            </div>
            <span className="num" style={{ minWidth: 70, textAlign: 'right' }}>
              {p.votes} <span className="muted small">{totalVotes ? `${Math.round((p.votes / totalVotes) * 100)}%` : ''}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="muted small mt">Para reiniciar todos los votos, ejecuta <code>truncate public.votes;</code> en el SQL Editor de Supabase.</p>
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}

export default function Page() {
  return <StaffShell active="votacion"><Votacion /></StaffShell>;
}
