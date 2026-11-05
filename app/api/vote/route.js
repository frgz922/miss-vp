import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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

// Verifica el captcha de Cloudflare Turnstile en el servidor (el token es de un solo uso).
async function verifyCaptcha(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Si la web muestra captcha pero falta la clave secreta, no aceptamos votos sin verificar.
    return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? 'misconfigured' : 'ok';
  }
  if (!token || typeof token !== 'string' || token.length > 2048) return 'fail';
  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') form.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const d = await r.json();
    return d.success === true ? 'ok' : 'fail';
  } catch {
    return 'fail';
  }
}

async function votingOpen(sb) {
  const { data } = await sb.from('settings').select('voting_open').eq('id', 1).single();
  return data?.voting_open !== false;
}

export async function GET(req) {
  try {
    const sb = admin();
    const [{ data: vote }, open] = await Promise.all([
      sb.from('votes').select('participant_id').eq('ip_hash', ipHash(req)).maybeSingle(),
      votingOpen(sb),
    ]);
    return Response.json({ hasVoted: !!vote, votedFor: vote?.participant_id ?? null, votingOpen: open });
  } catch (e) {
    return Response.json({ error: 'Servidor no configurado.' }, { status: 500 });
  }
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { body = {}; }
  const participantId = body?.participantId;
  if (!participantId || !UUID.test(participantId)) {
    return Response.json({ error: 'Participante no válida.' }, { status: 400 });
  }

  const captcha = await verifyCaptcha(body?.captchaToken, clientIp(req));
  if (captcha === 'misconfigured') {
    return Response.json({ error: 'Falta configurar el captcha en el servidor.' }, { status: 500 });
  }
  if (captcha !== 'ok') {
    return Response.json({ error: 'No pudimos verificar que eres una persona. Inténtalo de nuevo.' }, { status: 400 });
  }

  const sb = admin();
  if (!(await votingOpen(sb))) {
    return Response.json({ error: 'La votación está cerrada.' }, { status: 403 });
  }

  const { data: contestant } = await sb.from('public_contestants').select('id').eq('id', participantId).maybeSingle();
  if (!contestant) return Response.json({ error: 'Participante no encontrada.' }, { status: 404 });

  const hash = ipHash(req);
  const { error } = await sb.from('votes').insert({ participant_id: participantId, ip_hash: hash });
  if (error) {
    if (error.code === '23505') {
      const { data: prev } = await sb.from('votes').select('participant_id').eq('ip_hash', hash).maybeSingle();
      return Response.json({ error: 'Ya se registró un voto desde esta conexión.', votedFor: prev?.participant_id }, { status: 409 });
    }
    return Response.json({ error: 'No se pudo registrar el voto.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
