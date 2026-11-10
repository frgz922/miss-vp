'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useSettings } from '@/lib/useSettings';
import { EVENT, STATES } from '@/lib/config';
import { ageFrom, fullName } from '@/lib/utils';
import { Logo, Loading, Photo, DiscordChip } from '@/components/ui';
import Icon from '@/components/Icon';

const STEPS = ['Datos Personales', 'Información Adicional', 'Fotos Solicitadas', 'Confirmación'];
const FIELDS = ['first_name', 'last_name', 'birth_date', 'state', 'height_cm', 'weight_kg', 'phone', 'instagram', 'occupation', 'about_me', 'bio'];

function RegistroInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { loading, user, profile } = useAuth({ role: 'participant' });
  const [step, setStep] = useState(Math.min(4, Math.max(1, Number(params.get('paso')) || 1)));
  const [form, setForm] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [main, setMain] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [accept, setAccept] = useState(false);
  const fileRef = useRef(null);
  const settings = useSettings();

  useEffect(() => {
    if (profile && !form) {
      setForm(Object.fromEntries(FIELDS.map((k) => [k, profile[k] ?? ''])));
      setPhotos(profile.photos || []);
      setMain(profile.photo_url || profile.photos?.[0] || null);
    }
  }, [profile, form]);

  if (loading || !form || !settings) return <Loading full />;

  if (settings.registrations_open === false) {
    return (
      <>
        <header className="topbar">
          <Link href="/"><Logo /></Link>
          <DiscordChip profile={profile} />
        </header>
        <div className="auth-wrap">
          <div className="card auth-card" style={{ textAlign: 'center' }}>
            <h2>Inscripciones cerradas</h2>
            <p className="muted" style={{ margin: 0 }}>El periodo de inscripción terminó. Ya no es posible inscribirse ni modificar la postulación.</p>
            {profile.role === 'participant' && profile.status !== 'pendiente'
              ? <Link href="/perfil" className="btn btn-gold btn-block"><Icon name="user" /> Ver mi perfil</Link>
              : <Link href="/" className="btn btn-ghost btn-block"><Icon name="home" /> Volver al inicio</Link>}
          </div>
        </div>
      </>
    );
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const age = ageFrom(form.birth_date);
  const isNew = profile.status === 'pendiente';

  function validate(s) {
    if (s === 1) {
      for (const k of ['first_name', 'last_name', 'birth_date', 'state', 'height_cm', 'weight_kg']) {
        if (!String(form[k]).trim()) return 'Completa todos los campos marcados con *.';
      }
      if (age == null || age < EVENT.minAge) return `Debes tener al menos ${EVENT.minAge} años para participar.`;
      if (form.height_cm < 120 || form.height_cm > 230) return 'Revisa la altura (en centímetros).';
      if (form.weight_kg < 30 || form.weight_kg > 200) return 'Revisa el peso (en kilogramos).';
    }
    if (s === 2 && !String(form.phone).trim()) return 'El número de celular IC es obligatorio.';
    if (s === 3 && photos.length < 1) return 'Sube al menos una foto (recomendamos 3: rostro, cuerpo completo y casual).';
    return '';
  }

  async function save(extra = {}, nextPhotos = photos, nextMain = main) {
    const payload = {
      ...form,
      height_cm: form.height_cm === '' ? null : Number(form.height_cm),
      weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
      birth_date: form.birth_date || null,
      photos: nextPhotos,
      photo_url: nextMain,
      role: 'participant', // pasa de 'publico' a participante al llenar la ficha
      ...extra,
    };
    const { error } = await getSupabase().from('profiles').update(payload).eq('id', user.id);
    if (error) throw new Error(/INSCRIPCIONES_CERRADAS/.test(error.message) ? 'Las inscripciones se cerraron. Ya no puedes modificar tu postulación.' : error.message);
  }

  async function go(target) {
    setErr('');
    if (target > step) {
      for (let s = step; s < target; s++) {
        const v = validate(s);
        if (v) { setErr(v); setStep(s); return; }
      }
    }
    setBusy(true);
    try {
      await save();
      setStep(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErr('No se pudo guardar: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setErr('');
    setBusy(true);
    const sb = getSupabase();
    let list = [...photos];
    try {
      for (const file of files) {
        if (list.length >= EVENT.maxPhotos) { setErr(`Máximo ${EVENT.maxPhotos} fotos.`); break; }
        if (!file.type.startsWith('image/')) { setErr('Solo se permiten imágenes.'); continue; }
        if (file.size > 5 * 1024 * 1024) { setErr(`"${file.name}" pesa más de 5 MB.`); continue; }
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await sb.storage.from('photos').upload(path, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        list.push(sb.storage.from('photos').getPublicUrl(path).data.publicUrl);
      }
      const nextMain = main || list[0] || null;
      setPhotos(list);
      setMain(nextMain);
      await save({}, list, nextMain);
    } catch (e2) {
      setErr('Error al subir la foto: ' + e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(url) {
    setBusy(true);
    const list = photos.filter((p) => p !== url);
    const nextMain = main === url ? list[0] || null : main;
    try {
      const path = url.split('/photos/')[1];
      if (path) await getSupabase().storage.from('photos').remove([decodeURIComponent(path)]);
      setPhotos(list);
      setMain(nextMain);
      await save({}, list, nextMain);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function makeMain(url) {
    setMain(url);
    try { await save({}, photos, url); } catch (e) { setErr(e.message); }
  }

  async function submit() {
    setErr('');
    for (let s = 1; s <= 3; s++) {
      const v = validate(s);
      if (v) { setErr(v); setStep(s); return; }
    }
    if (!accept) return setErr('Debes aceptar las bases del certamen.');
    setBusy(true);
    try {
      await save(isNew ? { status: 'en_revision' } : {});
      router.push('/perfil?ok=1');
    } catch (e) {
      setErr('No se pudo enviar: ' + e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <Link href="/"><Logo /></Link>
        <div className="topbar-right">
          <DiscordChip profile={profile} />
          <Link href={isNew ? '/' : '/perfil'} className="btn btn-ghost btn-sm">
            <Icon name={isNew ? 'home' : 'left'} /> {isNew ? 'Inicio' : 'Mi perfil'}
          </Link>
        </div>
      </header>

      <div className="reg">
        <nav className="stepper" aria-label="Pasos">
          {STEPS.map((s, i) => {
            const n = i + 1;
            return (
              <button key={s} className={`step ${step === n ? 'active' : ''} ${step > n ? 'done' : ''}`} onClick={() => n !== step && go(n)} disabled={busy}>
                <span className="step-num">{step > n ? <Icon name="check" /> : n}</span>
                <span>{s}</span>
              </button>
            );
          })}
        </nav>

        <section>
          <h1 className="page-title">{isNew ? 'Registro de Participante' : 'Mi Ficha'}</h1>
          <p className="muted mb">Completa tu perfil para participar en el certamen</p>

          <div className="card">
            <div className="card-head">
              <span className="row-flex"><Icon name={['user', 'file', 'camera', 'check'][step - 1]} /> {STEPS[step - 1]}</span>
              <span className="muted small">Paso {step} de 4</span>
            </div>
            <div className="card-pad">
              {step === 1 && (
                <div className="grid2">
                  <div className="field"><label className="label">Nombre(s) *</label><input className="input" value={form.first_name} onChange={set('first_name')} placeholder="Tu nombre" /></div>
                  <div className="field"><label className="label">Apellido(s) *</label><input className="input" value={form.last_name} onChange={set('last_name')} placeholder="Tus apellidos" /></div>
                  <div className="field"><label className="label">Fecha de nacimiento *</label><input className="input" type="date" value={form.birth_date} onChange={set('birth_date')} /></div>
                  <div className="field"><label className="label">Edad</label><input className="input" disabled value={age != null && age >= 0 ? `${age} años` : '—'} /></div>
                  <div className="field">
                    <label className="label">Estado / Ciudad *</label>
                    <select className="input" value={form.state} onChange={set('state')}>
                      <option value="">Selecciona tu estado</option>
                      {STATES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field"><label className="label">Altura (cm) *</label><input className="input" type="number" inputMode="numeric" value={form.height_cm} onChange={set('height_cm')} placeholder="Ej. 169" /></div>
                  <div className="field"><label className="label">Peso (kg) *</label><input className="input" type="number" inputMode="decimal" step="0.1" value={form.weight_kg} onChange={set('weight_kg')} placeholder="Ej. 58" /></div>
                </div>
              )}

              {step === 2 && (
                <div className="grid2">
                  <div className="field"><label className="label">Número de celular IC *</label><input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="Tu número IC" /></div>
                  <div className="field"><label className="label">Instapik</label><input className="input" value={form.instagram} onChange={set('instagram')} placeholder="@usuario" /></div>
                  <div className="field field-full"><label className="label">Ocupación</label><input className="input" value={form.occupation} onChange={set('occupation')} placeholder="Ej. Estudiante, modelo…" /></div>
                  <div className="field field-full"><label className="label">Acerca de mí</label><textarea className="input" value={form.about_me} onChange={set('about_me')} maxLength={800} placeholder="Preséntate: quién eres, tu personalidad, tus gustos y lo que te hace única." /></div>
                  <div className="field field-full"><label className="label">¿Por qué quieres participar?</label><textarea className="input" value={form.bio} onChange={set('bio')} maxLength={800} placeholder="Cuéntale al jurado sobre ti, tus metas y tu causa social." /></div>
                  <p className="muted small field-full" style={{ margin: 0 }}>Tu número de celular IC solo lo verá la organización. En la votación pública solo se muestra tu nombre, estado y fotos.</p>
                </div>
              )}

              {step === 3 && (
                <>
                  <p className="muted small">Sube hasta {EVENT.maxPhotos} fotos (máx. 5 MB c/u). Recomendado: rostro, cuerpo completo y casual. La foto con borde dorado es la principal.</p>
                  <div className="photos-row">
                    {photos.map((url) => (
                      <div key={url} className={`photo-tile ${main === url ? 'is-main' : ''}`}>
                        <Photo src={url} />
                        <div className="tile-actions">
                          <button type="button" className={`tile-btn ${main === url ? 'main' : ''}`} onClick={() => makeMain(url)} disabled={busy}>
                            <Icon name="star" /> {main === url ? 'Principal' : 'Usar'}
                          </button>
                          <button type="button" className="tile-btn" onClick={() => removePhoto(url)} disabled={busy} aria-label="Eliminar foto"><Icon name="x" /></button>
                        </div>
                      </div>
                    ))}
                    {photos.length < EVENT.maxPhotos && (
                      <button type="button" className="upload-box" onClick={() => fileRef.current?.click()} disabled={busy}>
                        <span><Icon name="upload" />{busy ? 'Subiendo…' : 'Agregar fotos'}</span>
                      </button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={upload} />
                </>
              )}

              {step === 4 && (
                <div className="grid2" style={{ alignItems: 'start' }}>
                  <dl className="summary field-full" style={{ gridColumn: 'auto' }}>
                    <dt>Nombre</dt><dd>{fullName(form)}</dd>
                    <dt>Edad</dt><dd>{age} años</dd>
                    <dt>Estado</dt><dd>{form.state}</dd>
                    <dt>Altura / Peso</dt><dd>{form.height_cm} cm · {form.weight_kg} kg</dd>
                    <dt>Celular IC</dt><dd>{form.phone || '—'}</dd>
                    <dt>Instapik</dt><dd>{form.instagram || '—'}</dd>
                    <dt>Ocupación</dt><dd>{form.occupation || '—'}</dd>
                    <dt>Fotos</dt><dd>{photos.length}</dd>
                  </dl>
                  <div style={{ maxWidth: 200 }}><Photo src={main} alt="Foto principal" /></div>
                  <label className="check-row field-full">
                    <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                    <span>Confirmo que mis datos son verdaderos, que soy mayor de edad y acepto que mi nombre, estado y fotos se muestren públicamente durante el certamen.</span>
                  </label>
                </div>
              )}

              {err && <p className="error mt" role="alert">{err}</p>}

              <div className="row-flex between mt">
                {step > 1 ? <button className="btn btn-ghost" onClick={() => go(step - 1)} disabled={busy}><Icon name="left" /> Atrás</button> : <span />}
                {step < 4
                  ? <button className="btn btn-gold" onClick={() => go(step + 1)} disabled={busy}>{busy ? 'Guardando…' : 'Siguiente'} <Icon name="right" /></button>
                  : <button className="btn btn-gold" onClick={submit} disabled={busy}><Icon name="check" /> {isNew ? 'Enviar inscripción' : 'Guardar cambios'}</button>}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default function RegistroPage() {
  return <Suspense fallback={<Loading full />}><RegistroInner /></Suspense>;
}
