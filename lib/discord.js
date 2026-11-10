import { getSupabase } from './supabase';
import { EVENT } from './config';

const DISCORD_EPOCH = 1420070400000n;

// La fecha de creación de una cuenta de Discord va codificada en su ID ("snowflake").
export function discordCreatedAt(id) {
  if (!id || !/^\d{15,20}$/.test(String(id))) return null;
  return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
}

export function minCreatedDate(now = new Date()) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - EVENT.discordMinMonths);
  return d;
}

export function isOldEnough(id) {
  const created = discordCreatedAt(id);
  return !!created && created <= minCreatedDate();
}

// Discord ID del usuario de Supabase (lo pone Supabase al entrar con Discord)
export function discordIdOf(user) {
  const ident = user?.identities?.find((i) => i.provider === 'discord');
  return ident?.identity_data?.provider_id || ident?.id || user?.user_metadata?.provider_id || null;
}

export function fmtDate(d) {
  return d ? d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}

// next: 'participante' | 'staff' | una ruta como '/votar'
export async function signInWithDiscord(next) {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || 'participante')}`;
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo, scopes: 'identify email' },
  });
  if (error) throw error;
}

// Traduce los errores que devuelve Supabase al volver de Discord
export function authErrorMessage(raw) {
  const t = String(raw || '');
  if (/DISCORD_CUENTA_NUEVA|Database error saving new user/i.test(t)) {
    return `Tu cuenta de Discord debe tener al menos ${EVENT.discordMinMonths} meses de antigüedad para participar.`;
  }
  if (/access_denied|denied/i.test(t)) return 'Cancelaste el inicio de sesión con Discord.';
  if (/provider is not enabled|Unsupported provider/i.test(t)) return 'El inicio de sesión con Discord aún no está activado en Supabase.';
  return t ? `No se pudo iniciar sesión: ${t}` : 'No se pudo iniciar sesión.';
}
