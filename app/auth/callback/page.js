'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { routeAfterLogin } from '@/lib/routes';
import { authErrorMessage, discordIdOf, isOldEnough } from '@/lib/discord';
import { PublicHeader, Loading } from '@/components/ui';
import Icon from '@/components/Icon';

// Discord → Supabase → aquí. Supabase canjea el código y crea la sesión;
// luego enviamos a cada quien a su sitio.
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [err, setErr] = useState('');
  const next = params.get('next') || 'participante';

  useEffect(() => {
    let done = false;
    (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const urlError = params.get('error_description') || params.get('error') || hash.get('error_description');
      if (urlError) return setErr(authErrorMessage(urlError));

      const sb = getSupabase();
      // getSession espera a que termine el canje del código de la URL
      let { data: { session }, error } = await sb.auth.getSession();
      if (!session && params.get('code')) {
        const r = await sb.auth.exchangeCodeForSession(params.get('code'));
        session = r.data?.session; error = r.error;
      }
      if (done) return;
      if (error || !session) return setErr(authErrorMessage(error?.message || 'No se recibió la sesión de Discord.'));

      // Cuenta demasiado nueva: solo pasa si el staff la autorizó como excepción
      const did = discordIdOf(session.user);
      if (!isOldEnough(did)) {
        const { data: allowed } = await sb.rpc('discord_allowed', { did });
        if (allowed !== true) {
          await sb.auth.signOut();
          return setErr(authErrorMessage('DISCORD_CUENTA_NUEVA'));
        }
      }

      const { data: st } = await sb.from('settings').select('registrations_open').eq('id', 1).single();
      const closed = st?.registrations_open === false;
      const to = await routeAfterLogin(sb, session.user.id, next, { closedForParticipants: closed });
      if (!to) {
        await sb.auth.signOut();
        return setErr(next === 'staff'
          ? 'Tu cuenta de Discord no tiene acceso de staff. Pide a la organización que te habilite.'
          : 'Las inscripciones están cerradas. Ya no es posible inscribirse ni modificar la postulación.');
      }
      router.replace(to);
    })();
    return () => { done = true; };
  }, [params, next, router]);

  if (!err) return <Loading full />;
  const back = next.startsWith('/') ? next : `/login?rol=${next}`;
  return (
    <>
      <PublicHeader />
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: 'center' }}>
          <h2>No se pudo iniciar sesión</h2>
          <div className="notice" role="alert" style={{ textAlign: 'left' }}><Icon name="info" /><span className="error">{err}</span></div>
          <Link href={back} className="btn btn-ghost btn-block"><Icon name="left" /> Volver</Link>
        </div>
      </div>
    </>
  );
}

export default function CallbackPage() {
  return <Suspense fallback={<Loading full />}><CallbackInner /></Suspense>;
}
