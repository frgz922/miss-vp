// A dónde enviar a alguien después de entrar con Discord.
// Devuelve null si pidió entrar como staff y su cuenta no lo es.
export async function routeAfterLogin(sb, userId, next) {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  const { data: profile } = await sb.from('profiles').select('role,status').eq('id', userId).single();
  if (next === 'staff') return profile?.role === 'staff' ? '/staff' : null;
  if (profile?.role === 'staff') return '/staff';
  if (profile?.role === 'participant' && profile.status !== 'pendiente') return '/perfil';
  return '/registro';
}
