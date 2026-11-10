'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { routeAfterLogin } from '@/lib/routes';
import { authErrorMessage } from '@/lib/discord';
import { EVENT } from '@/lib/config';
import { PublicHeader, Loading } from '@/components/ui';
import DiscordButton from '@/components/DiscordButton';
import Icon from '@/components/Icon';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const rol = params.get('rol') === 'staff' ? 'staff' : 'participante';
  const isStaff = rol === 'staff';
  const [err, setErr] = useState(params.get('error') ? authErrorMessage(params.get('error')) : '');

  // Si ya tiene sesión, lo mandamos directo a su panel
  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const to = await routeAfterLogin(sb, session.user.id, rol);
      if (to) router.replace(to);
      else setErr('Tu cuenta de Discord no tiene acceso de staff.');
    })();
  }, [rol, router]);

  return (
    <>
      <PublicHeader />
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: 'center' }}>
          <div>
            <h2>{isStaff ? 'Acceso del Staff' : 'Acceso de Participantes'}</h2>
            <p className="muted small" style={{ margin: 0 }}>
              {isStaff ? 'Solo para jurado y organización' : 'Inscríbete o revisa tu perfil'}
            </p>
          </div>

          <DiscordButton next={rol} className="btn-block" onError={(m) => setErr(authErrorMessage(m))} />

          {err && (
            <div className="notice" role="alert" style={{ textAlign: 'left' }}>
              <Icon name="info" /><span className="error">{err}</span>
            </div>
          )}

          <p className="muted small" style={{ margin: 0 }}>
            Solo se aceptan cuentas de Discord con al menos {EVENT.discordMinMonths} meses de antigüedad.
            {isStaff && ' Tu cuenta debe haber sido habilitada como staff por la organización.'}
          </p>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<Loading full />}><LoginInner /></Suspense>;
}
