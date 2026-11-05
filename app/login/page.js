'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { PublicHeader, Loading } from '@/components/ui';
import Icon from '@/components/Icon';

async function routeFor(sb, userId, rol) {
  const { data: profile } = await sb.from('profiles').select('role,status').eq('id', userId).single();
  if (rol === 'staff') return profile?.role === 'staff' ? '/staff' : null;
  if (profile?.role === 'staff') return '/staff';
  return !profile || profile.status === 'pendiente' ? '/registro' : '/perfil';
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const rol = params.get('rol') === 'staff' ? 'staff' : 'participante';
  const isStaff = rol === 'staff';
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const to = await routeFor(sb, session.user.id, rol);
        if (to) router.replace(to);
      }
    })();
  }, [rol, router]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = getSupabase();
    try {
      if (mode === 'signup') {
        if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/login?rol=participante` },
        });
        if (error) throw error;
        if (!data.session) {
          setMsg({ type: 'ok', text: 'Te enviamos un correo para confirmar tu cuenta. Al confirmarla, inicia sesión aquí.' });
          setMode('login');
          return;
        }
        router.replace('/registro');
        return;
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(
          error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.'
            : error.message === 'Email not confirmed' ? 'Debes confirmar tu correo antes de entrar.'
            : error.message
        );
      }
      const to = await routeFor(sb, data.user.id, rol);
      if (!to) {
        await sb.auth.signOut();
        throw new Error('Esta cuenta no tiene acceso de staff.');
      }
      router.replace(to);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PublicHeader />
      <div className="auth-wrap">
        <form className="card auth-card" onSubmit={submit}>
          <div style={{ textAlign: 'center' }}>
            <h2>{isStaff ? 'Acceso del Staff' : mode === 'signup' ? 'Crea tu cuenta' : 'Acceso de Participantes'}</h2>
            <p className="muted small">
              {isStaff ? 'Solo para jurado y organización'
                : mode === 'signup' ? 'Después completarás tu ficha de inscripción'
                : 'Entra para completar o revisar tu perfil'}
            </p>
          </div>
          <div className="field">
            <label className="label" htmlFor="email">Correo electrónico</label>
            <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          </div>
          <div className="field">
            <label className="label" htmlFor="pw">Contraseña</label>
            <input id="pw" className="input" type="password" required minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {msg && <div className={`notice ${msg.type === 'ok' ? 'notice-ok' : ''}`}><Icon name={msg.type === 'ok' ? 'check' : 'info'} /><span className={msg.type === 'error' ? 'error' : ''}>{msg.text}</span></div>}
          <button className={`btn btn-block ${isStaff ? 'btn-purple' : 'btn-gold'}`} disabled={busy}>
            {busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </button>
          {!isStaff && (
            <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
              {mode === 'login' ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? '}
              <button type="button" className="link" style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null); }}>
                {mode === 'login' ? 'Inscríbete aquí' : 'Inicia sesión'}
              </button>
            </p>
          )}
        </form>
      </div>
    </>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<Loading full />}><LoginInner /></Suspense>;
}
