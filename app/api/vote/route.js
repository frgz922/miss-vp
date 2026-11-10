import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_MONTHS = 3; // igual que EVENT.discordMinMonths y discord_min_age() en el SQL

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------- Discord ----------
function discordIdOf(user) {
  const ident = user?.identities?.find((i) => i.provider === 'discord');
  return ident?.identity_data?.provider_id || ident?.id || null;
}

function discordOldEnough(id) {
  if (!id || !/^\d{15,20}$/.test(id)) return false;
  const created = new Date(Number((BigInt(id) >> 22n) + 1420070400000n));
  const limit = new Date();
  limit.setMonth(limit.getMonth() - MIN_MONTHS);
  return created <= limit;
}

// Usuario a partir del token de sesión que manda el navegador (verificado por Supabase)
async function userFrom(req, sb) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data.user;
}

// ---------- IP ----------
// En Vercel estas cabeceras las pone la plataforma (el cliente no puede falsificarlas).
function clientIp(req) {
  const h = req.headers;
  const raw =
    h.get('x-vercel-forwarded-for') ||
    h.get('x-real-ip') ||
    (h.get('x-forwarded-for') || '').split(',')[0] ||
    '';
  return raw.trim() || 'unknown';
}

// IPv6: cada casa recibe un bloque /64 y los dispositivos rotan direcciones dentro de él,
// así que agrupamos por /64 para que nadie pueda votar varias veces cambiando de IP.
function normalizeIp(ip) {
  ip = ip.split('%')[0];
  if (ip.toLowerCase().startsWith('::ffff:')) ip = ip.slice(7);
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail ? tail.split(':') : [];
  const groups = tail !== undefined ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return groups.slice(0, 4).map((g) => parseInt(g || '0', 16).toString(16)).join(':') + '::/64';
}

function ipHash(req) {
  return crypto
    .createHash('sha256')
    .update(normalizeIp(clientIp(req)) + '|' + (process.env.VOTE_SALT || ''))
    .digest('hex');
}

async function votingOpen(sb) {
  const { data } = await sb.from('settings').select('voting_open').eq('id', 1).single();
  return data?.voting_open !== false;
}

const json = (body, status = 200) => Response.json(body, { status });

// Estado: ¿la votación está abierta? ¿esta cuenta o esta conexión ya votó?
export async function GET(req) {
  try {
    const sb = admin();
    const user = await userFrom(req, sb);
    const [open, byIp, byUser] = await Promise.all([
      votingOpen(sb),
      sb.from('votes').select('id').eq('ip_hash', ipHash(req)).maybeSingle(),
      user ? sb.from('votes').select('participant_id').eq('voter_id', user.id).maybeSingle() : { data: null },
    ]);
    return json({
      votingOpen: open,
      loggedIn: !!user,
      hasVoted: !!byUser.data,
      votedFor: byUser.data?.participant_id ?? null,
      ipUsed: !!byIp.data,
    });
  } catch {
    return json({ error: 'Servidor no configurado.' }, 500);
  }
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { body = {}; }
  const participantId = body?.participantId;
  if (!participantId || !UUID.test(participantId)) return json({ error: 'Participante no válida.' }, 400);

  const sb = admin();

  // 1) Debe haber iniciado sesión con Discord
  const user = await userFrom(req, sb);
  if (!user) return json({ error: 'Inicia sesión con Discord para votar.', needLogin: true }, 401);
  const discordId = discordIdOf(user);
  if (!discordId) return json({ error: 'Tu cuenta no está vinculada a Discord.' }, 403);

  // 2) La cuenta de Discord debe tener la antigüedad mínima
  if (!discordOldEnough(discordId)) {
    return json({ error: `Tu cuenta de Discord debe tener al menos ${MIN_MONTHS} meses para votar.` }, 403);
  }

  if (!(await votingOpen(sb))) return json({ error: 'La votación está cerrada.' }, 403);

  const { data: contestant } = await sb.from('public_contestants').select('id').eq('id', participantId).maybeSingle();
  if (!contestant) return json({ error: 'Participante no encontrada.' }, 404);

  // 3) 1 voto por cuenta de Discord y 1 por IP (lo garantiza la base de datos con índices únicos)
  const { error } = await sb.from('votes').insert({
    participant_id: participantId,
    ip_hash: ipHash(req),
    voter_id: user.id,
    discord_id: discordId,
  });
  if (error) {
    if (error.code === '23505') {
      if (/ip_hash/.test(error.message)) {
        return json({ error: 'Ya se registró un voto desde esta conexión (IP).', ipUsed: true }, 409);
      }
      const { data: prev } = await sb.from('votes').select('participant_id').eq('voter_id', user.id).maybeSingle();
      return json({ error: 'Tu cuenta de Discord ya votó.', votedFor: prev?.participant_id }, 409);
    }
    return json({ error: 'No se pudo registrar el voto.' }, 500);
  }
  return json({ ok: true });
}
