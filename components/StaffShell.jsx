'use client';
import { createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, signOut } from '@/lib/useAuth';
import { AppShell, Loading } from './ui';
import { avatarOf } from '@/lib/utils';

const StaffCtx = createContext(null);
export const useStaff = () => useContext(StaffCtx);

const LINKS = [
  { key: 'dashboard', href: '/staff', label: 'Dashboard', icon: 'home' },
  { key: 'participantes', href: '/staff/participantes', label: 'Participantes', icon: 'users' },
  { key: 'final', href: '/staff/final', label: 'Fase Final', icon: 'award' },
  { key: 'votacion', href: '/staff/votacion', label: 'Votación y ajustes', icon: 'bar' },
];

export default function StaffShell({ active, children }) {
  const router = useRouter();
  const { loading, user, profile } = useAuth({ role: 'staff' });
  if (loading) return <Loading full />;
  const name = `${profile?.first_name || profile?.discord_name || profile?.discord_username || 'Staff'} (Staff)`;
  return (
    <StaffCtx.Provider value={{ user, profile }}>
      <AppShell links={LINKS} active={active} userName={name} avatar={avatarOf(profile)} onLogout={() => signOut(router)}>
        {children}
      </AppShell>
    </StaffCtx.Provider>
  );
}
