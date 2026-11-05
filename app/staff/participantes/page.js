'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import StaffShell from '@/components/StaffShell';
import { Badge, Loading, Photo } from '@/components/ui';
import Icon from '@/components/Icon';
import { useStaffData } from '@/lib/useStaffData';
import { STATUS } from '@/lib/config';
import { fullName, mainPhoto, ageFrom, fmt } from '@/lib/utils';

function Participantes() {
  const { loading, participants } = useStaffData();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const list = useMemo(() => participants.filter((p) =>
    (!status || p.status === status) &&
    (!q || `${fullName(p)} ${p.state || ''} ${p.email || ''}`.toLowerCase().includes(q.toLowerCase()))
  ), [participants, q, status]);

  if (loading) return <Loading />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Participantes</h1>
          <p className="muted">{participants.length} cuentas registradas</p>
        </div>
      </div>
      <div className="filters">
        <input className="input" placeholder="Buscar por nombre, estado o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="card table-wrap">
        {list.length === 0 ? <div className="empty">Sin resultados.</div> : (
          <table className="table">
            <thead><tr><th></th><th>Nombre</th><th>Estado</th><th>Edad</th><th>Jurado</th><th>Votos</th><th>Estatus</th><th></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td style={{ width: 60 }}><Photo src={mainPhoto(p)} className="thumb" /></td>
                  <td><b>{fullName(p)}</b><div className="muted small">{p.email}</div></td>
                  <td>{p.state || '—'}</td>
                  <td>{ageFrom(p.birth_date) ?? '—'}</td>
                  <td className="num">{fmt(p.juryAvg)}<span className="muted small"> ({p.evaluations.length})</span></td>
                  <td className="num">{p.votes}</td>
                  <td><Badge status={p.status} finalist={p.is_finalist} /></td>
                  <td>
                    {p.status !== 'pendiente' && (
                      <Link href={`/staff/evaluar/${p.id}`} className="btn btn-gold btn-sm"><Icon name="star" /> Evaluar</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <StaffShell active="participantes"><Participantes /></StaffShell>;
}
