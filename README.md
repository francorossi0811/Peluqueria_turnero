# Turnero — La Peluquería de Ariel Enrique

Turnero web para una peluquería unisex de un solo peluquero. Reemplaza la gestión de
turnos por WhatsApp/papel sin reemplazar WhatsApp como canal de contacto.

Proyecto de portfolio (Ingeniería en Sistemas). Documentación completa del diseño en
[`Docs/`](Docs/):

- [`historias-de-usuario-casos-de-uso.md`](Docs/historias-de-usuario-casos-de-uso.md)
- [`arquitectura.md`](Docs/arquitectura.md)
- [`modelo-datos.md`](Docs/modelo-datos.md)
- [`especificacion-api.md`](Docs/especificacion-api.md)
- [`wireframes-ui.md`](Docs/wireframes-ui.md)

## Estructura

```
frontend/   React + Vite + TypeScript + Tailwind (Vercel)
backend/    Node + Express + TypeScript + Prisma (Render)
```

Monorepo: cada carpeta es una app independiente, con su propio `package.json` y su
propio README con instrucciones de desarrollo.

## Requisitos

- Node.js (instalado vía [nvm](https://github.com/nvm-sh/nvm); ver `.nvmrc` en cada app)
- Una base PostgreSQL (Neon o Supabase) para el backend

## Arrancar en local

```bash
# Backend
cd backend
cp .env.example .env   # completar DATABASE_URL
npm install
npm run dev

# Frontend (en otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Deploy

Backend en **Render**, frontend en **Vercel**, base en **Neon**. Los dos servicios
apuntan al mismo repo, cada uno con su carpeta como raíz.

### 1. Backend (Render → New Web Service)

| Campo | Valor |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install && npm run migrate:deploy && npm run seed` |
| Start Command | `npm start` |

Los tres pasos del build, en orden: `npm install` dispara el `postinstall` que corre
`prisma generate`; `migrate:deploy` aplica las migraciones (sin esto la base queda sin
tablas y, sobre todo, sin el `EXCLUDE` que impide la doble reserva); y `seed` crea los
cuatro servicios, el horario laboral y la cuenta de Ariel.

**El seed va en el build a propósito**, y no como paso manual: el plan gratuito de Render
no da acceso a shell, así que no hay dónde correrlo a mano. Es seguro que se repita en
cada deploy porque `prisma/seed.ts` es idempotente — cada bloque comprueba si el dato ya
existe antes de crearlo. En particular, **el administrador solo se crea si no existe**, así
que si Ariel cambia su contraseña desde el panel, un redeploy no se la revierte.

> Si preferís no atar el deploy al seed, la alternativa es correrlo una sola vez desde tu
> máquina apuntando a la base de producción:
> `DATABASE_URL="<la-url-de-neon>" npm run seed` dentro de `backend/`. Neon es accesible
> por internet, así que no hace falta shell en Render.

Variables de entorno (las mismas de `backend/.env.example`):

- `DATABASE_URL` — la connection string de Neon
- `JWT_SECRET` — uno propio, largo y aleatorio. **No reusar el de desarrollo**
- `ADMIN_USUARIO` / `ADMIN_PASSWORD` — solo los lee el seed, para crear la cuenta
- `FRONTEND_URL` — **la URL de Vercel, sin barra final.** Si falta, cae al default
  `http://localhost:5173` y los mails de confirmación salen con links a localhost, que no
  le sirven a ningún cliente
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — para el push a Ariel. Las
  tres van juntas; si faltan, el push queda apagado y el resto anda igual
- `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NOMBRE` — envío de mail. Sin la key, el mail se
  imprime por consola en vez de enviarse
- `MAIL_REPLY_TO` — a dónde responden los clientes. Conviene el mail de la peluquería

#### Cómo generar los secretos

**`JWT_SECRET`** — firma los tokens de sesión del panel. Cualquiera que lo tenga puede
fabricarse un token válido y entrar como Ariel, así que tiene que ser largo y aleatorio,
distinto del de desarrollo, y no salir nunca del panel de variables de Render:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Claves VAPID** — identifican a este servidor ante los servicios de push de Google y
Apple. Se generan de a pares y van juntas:

```bash
cd backend && npx web-push generate-vapid-keys
```

Imprime una pública y una privada: van en `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`.
`VAPID_SUBJECT` es un dato de contacto en formato `mailto:` (por ejemplo
`mailto:turnos@lapeluqueria.com`) que el servicio de push usa si necesita reportar un
problema con los envíos.

Generá un par nuevo para producción y **no lo cambies después**: las suscripciones que
Ariel ya tenga están firmadas contra la clave pública vigente, y si la reemplazás el
celular deja de recibir avisos hasta volver a activarlos desde "Mi cuenta".

### 2. Frontend (Vercel → Add New Project)

| Campo | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |

Una sola variable: `VITE_API_URL`, con la URL de Render **más `/api`** — por ejemplo
`https://turnero-ariel.onrender.com/api`. Se lee en tiempo de build, así que después de
cambiarla hay que redeployar.

Como es una SPA con rutas de cliente (`/turno/:id`, `/admin/...`), entrar directo a una de
esas URLs tiene que servir `index.html`. **El preset de Vite no alcanza:** sin ayuda,
Vercel busca un archivo físico en `/admin`, no lo encuentra y devuelve 404 antes de que
React Router llegue a intervenir. Solo funcionaría la raíz, y el link único que va en cada
mail (`/turno/:id`) quedaría roto para todos los clientes.

Por eso está `frontend/vercel.json`, que reescribe cualquier ruta a `index.html`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

No afecta a los assets (`/assets/...`): Vercel sirve primero los archivos que existen y
solo reescribe lo que no encuentra.

### 3. Después de deployar, revisar

- Que el log del build de Render termine con `Seed listo: { servicios: 4, franjas: 10,
  administradores: 1 }` — si dice `administradores: 0`, faltó `ADMIN_USUARIO` o
  `ADMIN_PASSWORD`
- Reservar un turno de prueba con email y confirmar que el mail llega con un link de la
  URL de Vercel, no de localhost — es el error más fácil de cometer
- Desde el celular de Ariel: **Mi cuenta → Activar avisos en este dispositivo → Enviar
  prueba**
- Cambiar la contraseña del admin desde el panel, ya que la del seed viajó por una
  variable de entorno
- Borrar el turno de prueba

> **Ojo con el plan gratuito de Render:** el servicio se suspende tras ~15 minutos sin
> tráfico y el primer request después tarda bastante. Para un cliente que entra a
> reservar, eso es una pantalla de carga larga.
