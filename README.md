# Certamen de belleza — app web

Next.js 16 + Supabase. Se despliega **gratis** en **Vercel** (la web) + **Supabase** (base de datos, login y fotos).

## Qué incluye

| Página | Para quién | Qué hace |
|---|---|---|
| `/` | Todos | Portada con acceso a participantes, staff, votación y finalistas |
| `/login` | Participantes / staff | Inicio de sesión e inscripción (cuentas nuevas) |
| `/registro` | Participante | Ficha en 4 pasos: datos personales, info adicional, fotos, confirmación |
| `/perfil` | Participante | Su perfil, fotos y estado de la inscripción |
| `/staff` | Staff | Dashboard con totales y participantes recientes |
| `/staff/participantes` | Staff | Listado con búsqueda y filtros |
| `/staff/evaluar/[id]` | Staff | Calificación 0–10 en 5 criterios + comentarios |
| `/staff/final` | Staff | Ranking (jurado 80 % + público 20 %), elegir las 15 finalistas y publicarlas |
| `/staff/votacion` | Staff | Abrir/cerrar votación, mostrar resultados, conteo de votos |
| `/votar` | Público | Votación sin cuenta, **1 voto por IP** |
| `/finalistas` | Público | Las 15 finalistas (cuando el staff las publica) |

### Cómo funciona el voto único por IP
- El voto pasa por `/api/vote` (servidor). Ahí se toma la IP real que pone Vercel (el visitante no la puede falsificar), se cifra con SHA‑256 + `VOTE_SALT` y se guarda. La base de datos tiene una restricción `unique`, así que un segundo voto desde la misma IP se rechaza siempre.
- Las IPv6 se agrupan por bloque /64 (cada hogar recibe uno y los dispositivos rotan direcciones dentro).
- No se guarda la IP en claro, solo el hash.
- Además, cada voto exige pasar el **captcha de Cloudflare Turnstile** (gratis, casi siempre invisible), verificado también en el servidor. Así se frenan los bots y scripts que intentan votar en masa.
- Limitaciones a tener en cuenta: todas las personas en el mismo wifi (casa, oficina, universidad) comparten IP y solo podrán votar una vez entre todas; quien use VPN o cambie de red móvil podrá votar otra vez.

---

## Despliegue paso a paso (≈15 minutos)

### 1. Supabase (base de datos)
1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo (plan Free).
2. Ve a **SQL Editor → New query**, pega todo el contenido de `supabase/schema.sql` y pulsa **Run**.
3. Ve a **Authentication → Sign In / Providers → Email**:
   - Para pruebas rápidas desactiva **Confirm email** (si lo dejas activo, las participantes deben confirmar su correo; el plan gratis solo envía unos pocos correos por hora, así que para un evento real conviene configurar un SMTP propio en *Authentication → Emails*).
4. Ve a **Project Settings → API Keys** y copia:
   - **Project URL**
   - La clave **publishable** (o *anon* en proyectos antiguos)
   - La clave **secret** (o *service_role*). Esta es privada.

### 2. GitHub
1. Crea un repositorio nuevo y sube esta carpeta:
   ```bash
   git init && git add . && git commit -m "Certamen"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/certamen.git
   git push -u origin main
   ```

### 3. Cloudflare Turnstile (captcha)
1. Crea una cuenta gratis en <https://dash.cloudflare.com> → menú **Turnstile** → **Add widget**.
2. Nombre: el del certamen. **Hostnames**: tu dominio de Vercel (ej. `certamen.vercel.app`) y `localhost`. Modo: **Managed**.
3. Copia la **Site Key** y la **Secret Key** para el paso siguiente.

> Si dejas las dos claves vacías la votación funciona sin captcha (solo con el límite por IP). Si pones solo la Site Key, el servidor rechaza los votos hasta que pongas también la Secret Key.

### 4. Vercel (la web)
1. Entra en <https://vercel.com> con tu cuenta de GitHub → **Add New → Project** → importa el repositorio.
2. En **Environment Variables** agrega:
   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_KEY` | clave publishable / anon |
   | `SUPABASE_SECRET_KEY` | clave secret / service_role |
   | `VOTE_SALT` | un texto largo y aleatorio (no lo cambies después o los votos previos dejarán de reconocerse) |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site Key de Turnstile |
   | `TURNSTILE_SECRET_KEY` | Secret Key de Turnstile |
3. Pulsa **Deploy**. Tendrás una URL tipo `https://certamen.vercel.app`.
4. De vuelta en Supabase → **Authentication → URL Configuration**, pon esa URL en **Site URL** (para que los enlaces de confirmación de correo funcionen).

### 5. Crear las cuentas del staff
1. En la web, entra como participante → "Inscríbete aquí" y crea la cuenta con el correo del jurado.
2. En Supabase → SQL Editor:
   ```sql
   update public.profiles set role = 'staff' where email = 'jurado@ejemplo.com';
   ```
3. Ya puede entrar por **Soy del Staff**.

---

## Desarrollo local
```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev                   # http://localhost:3000
```
Para probar el captcha en local usa las claves de prueba de Cloudflare que vienen comentadas en `.env.example` (siempre aprueban).
En local todas las visitas salen con la misma IP, así que solo podrás votar una vez (borra con `truncate public.votes;`).

## Personalización
- Nombre, eslogan, número de finalistas y peso del voto público: variables `NEXT_PUBLIC_EVENT_*`, `NEXT_PUBLIC_FINALISTS` y `NEXT_PUBLIC_PUBLIC_VOTE_WEIGHT` (ver `.env.example`), o directamente en `lib/config.js`.
- Criterios de evaluación: `CRITERIA` en `lib/config.js` (si cambias las claves, cambia también las columnas de `evaluations` en el SQL).
- Colores y estilos: variables al inicio de `app/globals.css`.

## Límites del plan gratuito (aprox.)
- **Supabase Free**: 500 MB de base de datos, 1 GB de fotos, 50 000 usuarios activos/mes. El proyecto se pausa si pasa 7 días sin actividad (se reactiva desde el panel).
- **Vercel Hobby**: de sobra para un certamen; es para uso no comercial.
