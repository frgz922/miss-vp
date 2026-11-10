'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { Logo, Loading, Photo, Toast, DiscordChip } from '@/components/ui';
import DiscordButton from '@/components/DiscordButton';
import Icon from '@/components/Icon';
import { shortName, mainPhoto } from '@/lib/utils';
import { authErrorMessage } from '@/lib/discord';
import { EVENT, STATES } from '@/lib/config';

export default function VotarPage() {
  const [list, setList] = useState(null);
  const [status, setStatus] = useState({});
  const [results, setResults] = useState({});
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');

  const load = useCallback(async () => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    const headers = session ? { Authorization: `Bearer ${session.access_token}` } : {};
    const [c, r, s, p] = await Promise.all([
      sb.from('public_contestants').select('*').order('first_name'),
      sb.rpc('vote_results'),
      fetch('/api/vote', { cache: 'no-store', headers }).then((x) => x.json()).catch(() => ({})),
      session ? sb.from('profiles').select('discord_id,discord_username,discord_name,discord_avatar').eq('id', session.user.id).single() : { data: null },
    ]);
    setSession(session);
    setMe(p.data);
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
  const blocked = status.hasVoted || (status.ipUsed && !status.hasVoted) || status.votingOpen === false;

  async function logout() {
    await getSupabase().auth.signOut();
    load();
  }

  async function vote() {
    setBusy(true);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ participantId: confirm.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus((s) => ({ ...s, hasVoted: true, votedFor: confirm.id }));
        setMsg({ type: 'ok', text: `¡Gracias! Tu voto por ${shortName(confirm)} fue registrado.` });
        load();
      } else {
        if (res.status === 409) {
          setStatus((s) => data.ipUsed ? { ...s, ipUsed: true } : { ...s, hasVoted: true, votedFor: data.votedFor ?? s.votedFor });
        }
        if (data.needLogin) setSession(null);
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
      <header className="topbar">
        <Link href="/"><Logo /></Link>
        <div className="topbar-right">
          {session ? (
            <>
              <DiscordChip profile={me} />
              <button className="btn btn-ghost btn-sm" onClick={logout}><Icon name="logout" /> Salir</button>
            </>
          ) : list !== null && (
            <DiscordButton next="/votar" label="Entrar" className="btn-sm" onError={(m) => setMsg({ type: 'error', text: authErrorMessage(m) })} />
          )}
        </div>
      </header>

      <div className="pub-head">
        <h1 className="pub-title gold-text">Votación del Público</h1>
        <p className="muted">Elige a tu favorita. <b>Un voto por cuenta de Discord</b> y por conexión.</p>
      </div>
      <div className="pub-wrap">
        {list === null ? <Loading /> : (
          <>
            {status.votingOpen === false && <div className="notice notice-gold mb"><Icon name="info" /> La votación está cerrada en este momento.</div>}
            {status.hasVoted && <div className="notice notice-ok mb"><Icon name="check" /> Ya registraste tu voto. ¡Gracias por participar!</div>}
            {!status.hasVoted && status.ipUsed && <div className="notice notice-gold mb"><Icon name="info" /> Ya se registró un voto desde esta conexión (solo se permite uno por IP).</div>}
            {!session && status.votingOpen !== false && !status.ipUsed && (
              <div className="notice mb between row-flex">
                <span className="row-flex" style={{ gap: '.7rem' }}><Icon name="info" /> Para votar, entra con tu cuenta de Discord (mínimo {EVENT.discordMinMonths} meses de antigüedad).</span>
                <DiscordButton next="/votar" label="Entrar con Discord" className="btn-sm" onError={(m) => setMsg({ type: 'error', text: authErrorMessage(m) })} />
              </div>
            )}

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
                      <button type="button" className="ccard-open" onClick={() => setFicha(c)} aria-label={`Ver ficha de ${shortName(c)}`}>
                        <Photo src={mainPhoto(c)} alt={shortName(c)} />
                        <div>
                          <div className="ccard-name">{shortName(c)}</div>
                          <div className="ccard-sub">{c.state}{c.age ? ` · ${c.age} años` : ''}</div>
                        </div>
                      </button>
                      {showResults && (
                        <div style={{ padding: '0 .2rem' }}>
                          <div className="bar"><span style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></div>
                          <div className="ccard-sub" style={{ padding: 0, marginTop: 4 }}>{v} voto{v === 1 ? '' : 's'}</div>
                        </div>
                      )}
                      {mine
                        ? <span className="btn btn-gold btn-sm" aria-disabled="true"><Icon name="check" /> Tu voto</span>
                        : <button className="btn btn-purple btn-sm" disabled={blocked} onClick={() => setConfirm(c)}><Icon name="heart" /> Votar</button>}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFicha(c)}><Icon name="file" /> Ver ficha</button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {ficha && (
        <div className="modal-bg" onClick={() => setFicha(null)}>
          <div className="card modal ficha" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Ficha de ${shortName(ficha)}`}>
            <button className="ficha-close" onClick={() => setFicha(null)} aria-label="Cerrar"><Icon name="x" /></button>
            <Photo src={mainPhoto(ficha)} alt={shortName(ficha)} />
            <h3 className="gold-text" style={{ margin: 0 }}>{shortName(ficha)}</h3>
            <dl className="ficha-body">
              <dt>Estado que quiere representar</dt>
              <dd>{ficha.state || '—'}</dd>
              <dt>Acerca de mí</dt>
              <dd>{ficha.about_me || '—'}</dd>
              <dt>¿Por qué quiere participar?</dt>
              <dd>{ficha.bio || '—'}</dd>
            </dl>
            <div className="row-flex">
              <button className="btn btn-ghost" onClick={() => setFicha(null)}>Cerrar</button>
              {status.votedFor === ficha.id
                ? <span className="btn btn-gold" aria-disabled="true"><Icon name="check" /> Tu voto</span>
                : <button className="btn btn-purple" disabled={blocked} onClick={() => { setConfirm(ficha); setFicha(null); }}><Icon name="heart" /> Votar por ella</button>}
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-bg" onClick={() => !busy && setConfirm(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <Photo src={mainPhoto(confirm)} alt="" />
            <h3>¿Votar por {shortName(confirm)}?</h3>
            {session ? (
              <>
                <p className="muted small" style={{ margin: 0 }}>Solo puedes votar una vez y no podrás cambiar tu voto.</p>
                <div className="row-flex">
                  <button className="btn btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancelar</button>
                  <button className="btn btn-gold" onClick={vote} disabled={busy}><Icon name="heart" /> {busy ? 'Enviando…' : 'Confirmar voto'}</button>
                </div>
              </>
            ) : (
              <>
                <p className="muted small" style={{ margin: 0 }}>Para votar necesitas entrar con Discord. Tu cuenta debe tener al menos {EVENT.discordMinMonths} meses de antigüedad.</p>
                <DiscordButton next="/votar" className="btn-block" onError={(m) => setMsg({ type: 'error', text: authErrorMessage(m) })} />
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Cancelar</button>
              </>
            )}
          </div>
        </div>
      )}
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}
