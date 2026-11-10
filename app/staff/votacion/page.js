'use client';
import { useCallback, useEffect, useState } from 'react';
import StaffShell from '@/components/StaffShell';
import { Loading, Photo, Toast } from '@/components/ui';
import Icon from '@/components/Icon';
import { useStaffData } from '@/lib/useStaffData';
import { getSupabase } from '@/lib/supabase';
import { fullName, mainPhoto } from '@/lib/utils';
import { discordCreatedAt, fmtDate } from '@/lib/discord';
import { EVENT } from '@/lib/config';

const TOGGLES = [
  { key: 'registrations_open', title: 'Inscripciones abiertas', desc: 'Al apagarlo, las participantes ya no pueden inscribirse ni modificar su postulación (el botón "Participante" se desactiva).' },
  { key: 'voting_open', title: 'Votación abierta', desc: 'Permite que el público vote en /votar.' },
  { key: 'results_public', title: 'Mostrar resultados al público', desc: 'Muestra el conteo de votos en la página de votación.' },
  { key: 'finalists_public', title: 'Finalistas publicadas', desc: 'Muestra las finalistas en /finalistas.' },
];

// Cuentas de Discord autorizadas aunque tengan menos de la antigüedad mínima
function Excepciones({ onMsg }) {
  const [list, setList] = useState([]);
  const [id, setId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from('discord_exceptions').select('*').order('created_at', { ascending: false });
    setList(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    const did = id.trim();
    if (!/^\d{15,20}$/.test(did)) return onMsg({ type: 'error', text: 'El ID de Discord es un número de 17 a 20 dígitos.' });
    setBusy(true);
    const { error } = await getSupabase().from('discord_exceptions').insert({ discord_id: did, note: note.trim() || null });
    setBusy(false);
    if (error) return onMsg({ type: 'error', text: error.code === '23505' ? 'Ese ID ya está en la lista.' : error.message });
    setId(''); setNote('');
    onMsg({ type: 'ok', text: 'Cuenta autorizada. Ya puede entrar con Discord.' });
    load();
  }

  async function remove(did) {
    const { error } = await getSupabase().from('discord_exceptions').delete().eq('discord_id', did);
    if (error) return onMsg({ type: 'error', text: error.message });
    onMsg({ type: 'ok', text: 'Excepción eliminada.' });
    load();
  }

  return (
    <div className="card mb">
      <div className="card-head"><span className="row-flex"><Icon name="shield" /> Excepciones de antigüedad de Discord</span></div>
      <div className="card-pad">
        <p className="muted small">Autoriza cuentas de Discord con menos de {EVENT.discordMinMonths} meses. Pega el ID de usuario (en Discord: Ajustes → Avanzado → Modo desarrollador, luego clic derecho en el usuario → Copiar ID de usuario).</p>
        <form className="filters" onSubmit={add} style={{ marginBottom: 0 }}>
          <input className="input" inputMode="numeric" placeholder="ID de Discord (ej. 123456789012345678)" value={id} onChange={(e) => setId(e.target.value)} />
          <input className="input" placeholder="Nota (opcional): quién es o por qué" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
          <button className="btn btn-gold" disabled={busy}><Icon name="check" /> Autorizar</button>
        </form>
      </div>
      {list.map((x) => (
        <div key={x.discord_id} className="list-row">
          <div className="list-main">
            <b>{x.discord_id}</b>
            <span className="muted small">{x.note ? `${x.note} · ` : ''}cuenta creada el {fmtDate(discordCreatedAt(x.discord_id))}</span>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => remove(x.discord_id)}><Icon name="x" /> Quitar</button>
        </div>
      ))}
    </div>
  );
}

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

      <Excepciones onMsg={setMsg} />

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
