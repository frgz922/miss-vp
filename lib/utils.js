export function ageFrom(birth) {
  if (!birth) return null;
  const b = new Date(birth + 'T00:00:00');
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export function fullName(p) {
  if (!p) return '';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.discord_name || p.discord_username || 'Sin nombre';
}

export function shortName(p) {
  if (!p) return '';
  const last = (p.last_name || '').split(' ')[0];
  return [p.first_name?.split(' ')[0], last].filter(Boolean).join(' ') || 'Sin nombre';
}

export function fmt(n, d = 1) {
  return n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(d);
}

export function mainPhoto(p) {
  return p?.photo_url || p?.photos?.[0] || null;
}

export function avatarOf(p) {
  return p?.photo_url || p?.photos?.[0] || p?.discord_avatar || null;
}
