'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from './supabase';

// role: 'staff' | 'participant' | undefined (sin protección)
export function useAuth({ role } = {}) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, user: null, profile: null });

  const load = useCallback(async () => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      setState({ loading: false, user: null, profile: null });
      if (role) router.replace(`/login?rol=${role === 'staff' ? 'staff' : 'participante'}`);
      return;
    }
    const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    if (role === 'staff' && profile?.role !== 'staff') return router.replace('/perfil');
    if (role === 'participant' && profile?.role === 'staff') return router.replace('/staff');
    setState({ loading: false, user: session.user, profile });
  }, [role, router]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}

export async function signOut(router) {
  await getSupabase().auth.signOut();
  router.replace('/');
}
