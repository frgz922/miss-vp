# Certamen de belleza — app web

Next.js 16 + Supabase. Se despliega **gratis** en **Vercel** (la web) + **Supabase** (base de datos, login y fotos).
El inicio de sesión es **solo con Discord**.

## Qué incluye

| Página | Para quién | Qué hace |
|---|---|---|
| `/` | Todos | Portada con acceso a participantes, staff, votación y finalistas |
| `/login` | Participantes / staff | Entrar con Discord |
| `/registro` | Participante | Ficha en 4 pasos: datos personales, info adicional, fotos, confirmación |
| `/perfil` | Participante | Su perfil, fotos y estado de la inscripción |
| `/staff` | Staff | Dashboard con totales y participantes recientes |
| `/staff/participantes` | Staff | Listado con búsqueda (también por usuario o ID de Discord) |
| `/staff/evaluar/[id]` | Staff | Calificación 0–10 en 5 criterios + comentarios; muestra el Discord de la participante |
| `/staff/final` | Staff | Ranking (jurado 80 % + público 20 %), elegir las 10 finalistas y publicarlas |
| `/staff/votacion` | Staff | Abrir/cerrar votación, mostrar resultados, conteo de votos |
| `/votar` | Público | Votación con Discord: **1 voto por cuenta y 1 por IP** |
| `/finalistas` | Público | Las 10 finalistas (cuando el staff las publica) |

### Discord: ID y antigüedad mínima
- Al entrar por primera vez se guardan en `profiles`: `discord_id`, `discord_username`, `discord_name`, `discord_avatar` y `discord_created_at`.
- La fecha de creación sale del propio ID de Discord. **Si la cuenta tiene menos de 3 meses, la base de datos rechaza el registro** (la cuenta ni siquiera se crea) y la persona ve el aviso correspondiente. El servidor de votos lo vuelve a comprobar antes de aceptar cada voto.
- Para cambiar los 3 meses: `discord_min_age()` en `supabase/schema.sql`, `discordMinMonths` en `lib/config.js` y `MIN_MONTHS` en `app/api/vote/route.js`.

### Cómo funciona el voto
- El voto pasa por `/api/vote` (servidor), que comprueba la sesión de Discord con Supabase, la antigüedad de la cuenta y la IP.
- Se guarda el ID de Discord del votante y un hash de su IP (SHA‑256 + `VOTE_SALT`; la IP no se guarda en claro). La base de datos tiene índices únicos sobre la cuenta y sobre la IP, así que un segundo voto se rechaza siempre.
- Las IPv6 se agrupan por bloque /64 (cada hogar recibe uno y los dispositivos rotan direcciones dentro).
- A tener en cuenta: las personas que comparten wifi (casa, oficina, universidad) solo podrán votar una vez entre todas, aunque cada una tenga su cuenta de Discord.

---

## Despliegue paso a paso (≈20 minutos)

### 1. Supabase (base de datos)
1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo (plan Free).
2. Ve a **SQL Editor → New query**, pega todo el contenido de `supabase/schema.sql` y pulsa **Run**.
   - **Si ya lo habías ejecutado antes**, vuelve a ejecutarlo completo: se actualiza sin borrar tus datos.
3. Ve a **Project Settings → API Keys** y copia:
   - **Project URL**
   - La clave **publishable** (o *anon* en proyectos antiguos)
   - La clave **secret** (o *service_role*). Esta es privada.

### 2. Discord (aplicación para el login)
1. Entra en <https://discord.com/developers/applications> → **New Application** → ponle el nombre del certamen (es lo que verá la gente al autorizar).
2. Menú **OAuth2**:
   - Copia el **Client ID**.
   - Pulsa **Reset Secret** y copia el **Client Secret**.
   - En **Redirects** → **Add Redirect** y pega la URL de callback que te muestra Supabase en el paso siguiente (tiene esta forma: `https://TU-PROYECTO.supabase.co/auth/v1/callback`). Guarda.
3. En Supabase → **Authentication → Sign In / Providers → Discord**: actívalo, pega el **Client ID** y el **Client Secret** y guarda.
4. En esa misma pantalla, entra a **Email** y **desactívalo** (así solo se puede entrar con Discord).

### 3. GitHub
1. Crea un repositorio nuevo y sube esta carpeta:
   ```bash
   git init && git add . && git commit -m "Certamen"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/certamen.git
   git push -u origin main
   ```

### 4. Vercel (la web)
1. Entra en <https://vercel.com> con tu cuenta de GitHub → **Add New → Project** → importa el repositorio.
2. En **Environment Variables** agrega (marca Production, Preview y Development):
   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_KEY` | clave publishable / anon |
   | `SUPABASE_SECRET_KEY` | clave secret / service_role |
   | `VOTE_SALT` | un texto largo y aleatorio (no lo cambies después o los votos previos dejarán de reconocerse) |
3. Pulsa **Deploy**. Tendrás una URL tipo `https://certamen.vercel.app`.
4. En Supabase → **Authentication → URL Configuration**:
   - **Site URL**: tu URL de Vercel.
   - **Redirect URLs** → añade `https://certamen.vercel.app/**` (tu URL + `/**`) y, si pruebas en tu PC, `http://localhost:3000/**`.

   Sin esto, al volver de Discord Supabase te mandará a la página equivocada.

### 5. Crear las cuentas del staff
1. Cada persona del jurado entra una vez en la web con **Soy del Staff → Continuar con Discord** (le dirá que no tiene acceso; es normal).
2. En Supabase → SQL Editor:
   ```sql
   -- ver quién ha entrado
   select discord_username, discord_id, role from public.profiles;
   -- habilitar como staff
   update public.profiles set role = 'staff' where discord_username = 'usuario_de_discord';
   ```
3. Ya puede entrar por **Soy del Staff**.

> Las cuentas creadas antes con correo y contraseña ya no podrán entrar; el staff debe habilitarse de nuevo con su Discord.

---

## Desarrollo local
```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev                   # http://localhost:3000
```
En local todas las visitas salen con la misma IP, así que solo se podrá votar una vez (borra con `truncate public.votes;`).

## Personalización
- Nombre, eslogan, número de finalistas y peso del voto público: variables `NEXT_PUBLIC_EVENT_*`, `NEXT_PUBLIC_FINALISTS` y `NEXT_PUBLIC_PUBLIC_VOTE_WEIGHT` (ver `.env.example`), o directamente en `lib/config.js`.
- Imagen de portada: reemplaza `public/fondo-inicio.jpg`.
- Criterios de evaluación: `CRITERIA` en `lib/config.js` (si cambias las claves, cambia también las columnas de `evaluations` en el SQL).
- Colores y estilos: variables al inicio de `app/globals.css`.

## Límites del plan gratuito (aprox.)
- **Supabase Free**: 500 MB de base de datos, 1 GB de fotos, 50 000 usuarios activos/mes. El proyecto se pausa si pasa 7 días sin actividad (se reactiva desde el panel).
- **Vercel Hobby**: de sobra para un certamen; es para uso no comercial.
