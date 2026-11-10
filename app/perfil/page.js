'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useAuth, signOut } from '@/lib/useAuth';
import { EVENT } from '@/lib/config';
import { ageFrom, fullName, mainPhoto, avatarOf } from '@/lib/utils';
import { AppShell, Badge, Loading, Photo } from '@/components/ui';
import Icon from '@/components/Icon';

const LINKS = [
  { key: 'perfil', href: '/perfil', label: 'Mi Perfil', icon: 'home' },
  { key: 'ficha', href: '/registro', label: 'Mi Ficha', icon: 'file' },
  { key: 'fotos', href: '/registro?paso=3', label: 'Mis Fotos', icon: 'camera' },
];

function PerfilInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { loading, profile } = useAuth({ role: 'participant' });
  const [settings, setSettings] = useState({});

  useEffect(() => {
    getSupabase().from('settings').select('*').eq('id', 1).single().then(({ data }) => setSettings(data || {}));
  }, []);

  // Quien solo ha votado (aún sin ficha) va directo a inscribirse
  useEffect(() => {
    if (profile?.role === 'publico') router.replace('/registro');
  }, [profile, router]);

  if (loading || profile?.role === 'publico') return <Loading full />;
  const p = profile || {};
  const isFinalist = settings.finalists_public && p.is_finalist;
  const age = ageFrom(p.birth_date);

  return (
    <AppShell links={LINKS} active="perfil" userName={fullName(p)} avatar={avatarOf(p)} onLogout={() => signOut(router)}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Mi Perfil</h1>
          <p className="muted">Revisa y actualiza tu información</p>
        </div>
        {p.status === 'pendiente'
          ? <Link href="/registro" className="btn btn-gold btn-sm"><Icon name="edit" /> Completar registro</Link>
          : <span className="row-flex"><Badge status={p.status} finalist={isFinalist} /></span>}
      </div>

      {params.get('ok') && (
        <div className="notice notice-ok mb"><Icon name="check" /> Tu perfil ha sido registrado correctamente.</div>
      )}
      {isFinalist && (
        <div className="notice notice-gold mb"><Icon name="award" /> ¡Felicidades! Eres una de las {EVENT.finalists} finalistas.</div>
      )}

      <div className="profile-grid">
        <div>
          <Photo src={mainPhoto(p)} alt={fullName(p)} />
          <Link href="/registro?paso=3" className="btn btn-ghost btn-sm btn-block mt" style={{ marginTop: '.6rem' }}><Icon name="camera" /> Cambiar foto</Link>
        </div>
        <div className="card">
          <div className="card-head">Información Personal <Link href="/registro" className="btn btn-ghost btn-sm"><Icon name="edit" /> Editar</Link></div>
          <dl className="info-list">
            <dt>Nombre:</dt><dd>{fullName(p)}</dd>
            <dt>Edad:</dt><dd>{age != null ? `${age} años` : '—'}</dd>
            <dt>Estado:</dt><dd>{p.state || '—'}</dd>
            <dt>Altura:</dt><dd>{p.height_cm ? `${(p.height_cm / 100).toFixed(2)} m` : '—'}</dd>
            <dt>Peso:</dt><dd>{p.weight_kg ? `${p.weight_kg} kg` : '—'}</dd>
            <dt>Ocupación:</dt><dd>{p.occupation || '—'}</dd>
            <dt>Instapik:</dt><dd>{p.instagram || '—'}</dd>
            <dt>Celular IC:</dt><dd>{p.phone || '—'}</dd>
            <dt>Discord:</dt><dd style={{ wordBreak: 'break-word' }}>{p.discord_username ? `@${p.discord_username}` : '—'}{p.discord_id && ` (${p.discord_id})`}</dd>
          </dl>
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">Mis Fotos <Link href="/registro?paso=3" className="btn btn-ghost btn-sm">Gestionar <Icon name="right" /></Link></div>
        <div className="card-pad">
          {p.photos?.length
            ? <div className="photos-row">{p.photos.map((u) => <Photo key={u} src={u} />)}</div>
            : <p className="muted" style={{ margin: 0 }}>Aún no has subido fotos.</p>}
        </div>
      </div>

      <div className="notice mt">
        <Icon name="info" />
        {p.status === 'pendiente' && 'Tu inscripción está incompleta. Termina tu ficha para aparecer en el certamen.'}
        {p.status === 'en_revision' && 'Tu inscripción fue recibida y está siendo evaluada por el jurado.'}
        {p.status === 'completado' && 'El jurado ya completó tu evaluación. ¡Mucha suerte!'}
      </div>
    </AppShell>
  );
}

export default function PerfilPage() {
  return <Suspense fallback={<Loading full />}><PerfilInner /></Suspense>;
}
