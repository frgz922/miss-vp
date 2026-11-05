'use client';
import { useState } from 'react';
import Link from 'next/link';
import StaffShell from '@/components/StaffShell';
import { Loading, Photo, Toast } from '@/components/ui';
import Icon from '@/components/Icon';
import { useStaffData } from '@/lib/useStaffData';
import { getSupabase } from '@/lib/supabase';
import { EVENT } from '@/lib/config';
import { fullName, mainPhoto, fmt } from '@/lib/utils';

function Final() {
  const { loading, participants, settings, reload } = useStaffData();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (loading) return <Loading />;

  const N = EVENT.finalists;
  const ranked = participants
    .filter((p) => p.status !== 'pendiente')
    .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1) || b.votes - a.votes);
  const selected = ranked.filter((p) => p.is_finalist).length;
  const w = Math.round(EVENT.publicVoteWeight * 100);

  async function run(fn, okText) {
    setBusy(true);
    try {
      await fn(getSupabase());
      setMsg({ type: 'ok', text: okText });
      await reload();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }
  const check = ({ error }) => { if (error) throw error; };

  function toggle(p) {
    if (!p.is_finalist && selected >= N) return setMsg({ type: 'error', text: `Ya seleccionaste ${N} finalistas.` });
    run(async (sb) => check(await sb.from('profiles').update({ is_finalist: !p.is_finalist }).eq('id', p.id)),
      p.is_finalist ? 'Quitada de las finalistas.' : 'Agregada a las finalistas.');
  }

  function autoTop() {
    const top = ranked.filter((p) => p.finalScore != null).slice(0, N).map((p) => p.id);
    if (!top.length) return setMsg({ type: 'error', text: 'Primero evalúa a las participantes.' });
    if (!confirm(`Esto reemplazará la selección actual por el top ${top.length} según la puntuación final. ¿Continuar?`)) return;
    run(async (sb) => {
      check(await sb.from('profiles').update({ is_finalist: false }).eq('is_finalist', true));
      check(await sb.from('profiles').update({ is_finalist: true }).in('id', top));
    }, `Top ${top.length} seleccionado.`);
  }

  function publish() {
    run(async (sb) => check(await sb.from('settings').update({ finalists_public: !settings.finalists_public }).eq('id', 1)),
      settings.finalists_public ? 'Finalistas ocultas al público.' : '¡Finalistas publicadas!');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Fase Final</h1>
          <p className="muted">Puntuación final = jurado {100 - w}% + voto del público {w}% · Seleccionadas: <b>{selected} / {N}</b></p>
        </div>
        <div className="row-flex">
          <button className="btn btn-ghost btn-sm" onClick={autoTop} disabled={busy}><Icon name="award" /> Seleccionar top {N}</button>
          <button className={`btn btn-sm ${settings.finalists_public ? 'btn-danger' : 'btn-gold'}`} onClick={publish} disabled={busy}>
            <Icon name={settings.finalists_public ? 'x' : 'check'} /> {settings.finalists_public ? 'Ocultar finalistas' : 'Publicar finalistas'}
          </button>
          <Link href="/finalistas" target="_blank" className="btn btn-ghost btn-sm">Ver página <Icon name="right" /></Link>
        </div>
      </div>

      <div className="card table-wrap">
        {ranked.length === 0 ? <div className="empty">Aún no hay participantes con inscripción enviada.</div> : (
          <table className="table">
            <thead><tr><th>#</th><th></th><th>Nombre</th><th>Jurado</th><th>Público</th><th>Final</th><th>Finalista</th></tr></thead>
            <tbody>
              {ranked.map((p, i) => (
                <tr key={p.id}>
                  <td><span className={`rank ${i < N && p.finalScore != null ? 'rank-top' : ''}`}>{i + 1}</span></td>
                  <td style={{ width: 60 }}><Photo src={mainPhoto(p)} className="thumb" /></td>
                  <td><Link href={`/staff/evaluar/${p.id}`}><b>{fullName(p)}</b></Link><div className="muted small">{p.state}</div></td>
                  <td className="num">{fmt(p.juryAvg)}</td>
                  <td className="num">{p.votes} <span className="muted small">({fmt(p.publicScore)})</span></td>
                  <td className="num gold-text" style={{ fontSize: '1.05rem' }}>{fmt(p.finalScore, 2)}</td>
                  <td>
                    <label className="switch" aria-label="Finalista">
                      <input type="checkbox" checked={p.is_finalist} onChange={() => toggle(p)} disabled={busy} />
                      <span />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}

export default function Page() {
  return <StaffShell active="final"><Final /></StaffShell>;
}
