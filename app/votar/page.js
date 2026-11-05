'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { PublicHeader, Loading, Photo, Toast } from '@/components/ui';
import Icon from '@/components/Icon';
import Turnstile, { TURNSTILE_SITE_KEY } from '@/components/Turnstile';
import { shortName, mainPhoto } from '@/lib/utils';
import { STATES } from '@/lib/config';

export default function VotarPage() {
  const [list, setList] = useState(null);
  const [status, setStatus] = useState({});
  const [results, setResults] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const needCaptcha = !!TURNSTILE_SITE_KEY;

  function openConfirm(c) {
    setCaptcha(null);
    setConfirm(c);
  }

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [c, r, s] = await Promise.all([
      sb.from('public_contestants').select('*').order('first_name'),
      sb.rpc('vote_results'),
      fetch('/api/vote', { cache: 'no-store' }).then((x) => x.json()).catch(() => ({})),
    ]);
    setList(c.data || []);
    setResults(Object.fromEntries((r.data || []).map((x) => [x.participant_id, Number(x.votes)])));
    setStatus(s || {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (list || []).filter((c) =>
    (!st || c.state === st) &&
    (!q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.toLowerCase()))
  ), [list, q, st]);

  const showResults = Object.keys(results).length > 0;
  const total = Object.values(results).reduce((a, b) => a + b, 0);

  async function vote() {
    setBusy(true);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: confirm.id, captchaToken: captcha }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus((s) => ({ ...s, hasVoted: true, votedFor: confirm.id }));
        setMsg({ type: 'ok', text: `¡Gracias! Tu voto por ${shortName(confirm)} fue registrado.` });
        load();
      } else {
        if (res.status === 409) setStatus((s) => ({ ...s, hasVoted: true, votedFor: data.votedFor ?? s.votedFor }));
        setMsg({ type: 'error', text: data.error || 'No se pudo registrar el voto.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Error de conexión. Inténtalo de nuevo.' });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <>
      <PublicHeader />
      <div className="pub-head">
        <h1 className="pub-title gold-text">Votación del Público</h1>
        <p className="muted">Elige a tu favorita. Solo se permite <b>un voto por conexión</b>.</p>
      </div>
      <div className="pub-wrap">
        {list === null ? <Loading /> : (
          <>
            {status.votingOpen === false && <div className="notice notice-gold mb"><Icon name="info" /> La votación está cerrada en este momento.</div>}
            {status.hasVoted && <div className="notice notice-ok mb"><Icon name="check" /> Ya registraste tu voto desde esta conexión. ¡Gracias por participar!</div>}

            <div className="filters">
              <input className="input" placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="input" value={st} onChange={(e) => setSt(e.target.value)} style={{ maxWidth: 240 }}>
                <option value="">Todos los estados</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? <div className="card empty">No hay participantes para mostrar todavía.</div> : (
              <div className="cgrid">
                {filtered.map((c) => {
                  const mine = status.votedFor === c.id;
                  const v = results[c.id] || 0;
                  return (
                    <div key={c.id} className={`ccard ${mine ? 'voted' : ''}`}>
                      <Photo src={mainPhoto(c)} alt={shortName(c)} />
                      <div>
                        <div className="ccard-name">{shortName(c)}</div>
                        <div className="ccard-sub">{c.state}{c.age ? ` · ${c.age} años` : ''}</div>
                      </div>
                      {showResults && (
                        <div style={{ padding: '0 .2rem' }}>
                          <div className="bar"><span style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></div>
                          <div className="ccard-sub" style={{ padding: 0, marginTop: 4 }}>{v} voto{v === 1 ? '' : 's'}</div>
                        </div>
                      )}
                      {mine
                        ? <span className="btn btn-gold btn-sm" aria-disabled="true"><Icon name="check" /> Tu voto</span>
                        : <button className="btn btn-purple btn-sm" disabled={status.hasVoted || status.votingOpen === false} onClick={() => openConfirm(c)}><Icon name="heart" /> Votar</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {confirm && (
        <div className="modal-bg" onClick={() => !busy && setConfirm(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <Photo src={mainPhoto(confirm)} alt="" />
            <h3>¿Votar por {shortName(confirm)}?</h3>
            <p className="muted small" style={{ margin: 0 }}>Solo puedes votar una vez y no podrás cambiar tu voto.</p>
            <Turnstile onToken={setCaptcha} />
            <div className="row-flex">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancelar</button>
              <button className="btn btn-gold" onClick={vote} disabled={busy || (needCaptcha && !captcha)} title={needCaptcha && !captcha ? 'Completa la verificación' : undefined}><Icon name="heart" /> {busy ? 'Enviando…' : 'Confirmar voto'}</button>
            </div>
          </div>
        </div>
      )}
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}
