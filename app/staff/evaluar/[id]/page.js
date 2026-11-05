'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import StaffShell, { useStaff } from '@/components/StaffShell';
import { Badge, Loading, Photo, Stars, Toast } from '@/components/ui';
import Icon from '@/components/Icon';
import { useStaffData, avgEval } from '@/lib/useStaffData';
import { getSupabase } from '@/lib/supabase';
import { CRITERIA } from '@/lib/config';
import { fullName, ageFrom, fmt } from '@/lib/utils';

function Evaluar() {
  const { id } = useParams();
  const { user } = useStaff();
  const { loading, participants, reload } = useStaffData();
  const p = participants.find((x) => x.id === id);
  const [scores, setScores] = useState(null);
  const [comments, setComments] = useState('');
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (p && !scores) {
      const mine = p.evaluations.find((e) => e.staff_id === user.id);
      setScores(Object.fromEntries(CRITERIA.map((c) => [c.key, mine ? Number(mine[c.key]) : 8])));
      setComments(mine?.comentarios || '');
      setImg(p.photo_url || p.photos?.[0] || null);
    }
  }, [p, scores, user.id]);

  if (loading) return <Loading />;
  if (!p) return <div className="card empty">Participante no encontrada. <Link className="link" href="/staff/participantes">Volver</Link></div>;
  if (!scores) return <Loading />;

  const myAvg = avgEval(scores);
  const others = p.evaluations.filter((e) => e.staff_id !== user.id);

  async function save() {
    setBusy(true);
    const sb = getSupabase();
    const { error } = await sb.from('evaluations').upsert(
      { participant_id: p.id, staff_id: user.id, ...scores, comentarios: comments || null, updated_at: new Date().toISOString() },
      { onConflict: 'participant_id,staff_id' }
    );
    if (!error && p.status !== 'completado') {
      await sb.from('profiles').update({ status: 'completado' }).eq('id', p.id);
    }
    setBusy(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else { setMsg({ type: 'ok', text: 'Evaluación guardada.' }); reload(); }
  }

  const gallery = p.photos?.length ? p.photos : [null];

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/staff/participantes" className="muted small row-flex"><Icon name="left" /> Participantes</Link>
          <h1 className="page-title" style={{ marginTop: '.4rem' }}>Evaluación de Participante</h1>
          <p className="muted">Califica su desempeño en cada criterio</p>
        </div>
        <Badge status={p.status} finalist={p.is_finalist} />
      </div>

      <div className="eval-grid">
        <div>
          <Photo src={img} alt={fullName(p)} />
          {gallery.length > 1 && (
            <div className="thumbs">
              {gallery.map((u) => (
                <button key={u} className={img === u ? 'on' : ''} onClick={() => setImg(u)}><Photo src={u} /></button>
              ))}
            </div>
          )}
          <div className="card mt">
            <dl className="info-list">
              <dt>Altura</dt><dd>{p.height_cm ? `${p.height_cm} cm` : '—'}</dd>
              <dt>Peso</dt><dd>{p.weight_kg ? `${p.weight_kg} kg` : '—'}</dd>
              <dt>Ocupación</dt><dd>{p.occupation || '—'}</dd>
              <dt>Estudios</dt><dd>{p.education || '—'}</dd>
              <dt>Instagram</dt><dd>{p.instagram || '—'}</dd>
              <dt>Teléfono</dt><dd>{p.phone || '—'}</dd>
              <dt>Correo</dt><dd style={{ wordBreak: 'break-all' }}>{p.email || '—'}</dd>
            </dl>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-head">
              <div>
                <div style={{ fontSize: '1.2rem' }}>{fullName(p)}</div>
                <div className="muted small" style={{ fontWeight: 400 }}>{p.state} · {ageFrom(p.birth_date)} años</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="muted small" style={{ fontWeight: 400 }}>Tu promedio</div>
                <div className="gold-text" style={{ fontSize: '1.6rem', fontWeight: 700 }}>{fmt(myAvg)}</div>
              </div>
            </div>
            {CRITERIA.map((c) => (
              <div key={c.key} className="crit">
                <div className="crit-label">{c.label}</div>
                <div className="crit-ctrl">
                  <Stars value={scores[c.key]} />
                  <input type="range" min="0" max="10" step="0.5" value={scores[c.key]} aria-label={c.label}
                    onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))} />
                </div>
                <div className="crit-score">{fmt(scores[c.key])} <span>/ 10</span></div>
              </div>
            ))}
            <div className="card-pad">
              <div className="field">
                <label className="label">Comentarios (opcional)</label>
                <textarea className="input" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Agrega tus observaciones…" />
              </div>
              <div className="row-flex mt" style={{ justifyContent: 'flex-end' }}>
                <Link href="/staff/participantes" className="btn btn-ghost">Cancelar</Link>
                <button className="btn btn-gold" onClick={save} disabled={busy}><Icon name="check" /> {busy ? 'Guardando…' : 'Guardar Evaluación'}</button>
              </div>
            </div>
          </div>

          {p.bio && (
            <div className="card mt card-pad">
              <div className="label" style={{ marginBottom: '.4rem' }}>¿Por qué quiere participar?</div>
              <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{p.bio}</p>
            </div>
          )}

          <div className="card mt">
            <div className="card-head">Resumen <span className="muted small" style={{ fontWeight: 400 }}>{p.evaluations.length} evaluación(es) · {p.votes} votos del público</span></div>
            {others.length === 0 ? <div className="empty small">Ningún otro miembro del staff la ha evaluado.</div> : others.map((e) => (
              <div key={e.id} className="list-row">
                <div className="list-main"><b>Otro evaluador</b>{e.comentarios && <span className="muted small">{e.comentarios}</span>}</div>
                <span className="num">{fmt(avgEval(e))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}

export default function Page() {
  return <StaffShell active="participantes"><Evaluar /></StaffShell>;
}
