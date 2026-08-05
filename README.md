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
| Build Command | `npm install && npm run migrate:deploy` |
| Start Command | `npm start` |

El `npm install` dispara el `postinstall` que corre `prisma generate`, y
`migrate:deploy` aplica las migraciones a la base de producción. Sin ese segundo paso la
base queda vacía: sin tablas y, sobre todo, sin el `EXCLUDE` que impide la doble reserva.

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

Después del primer deploy, crear la cuenta de admin una sola vez (Render → Shell):

```bash
npx prisma db seed
```

### 2. Frontend (Vercel → Add New Project)

| Campo | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |

Una sola variable: `VITE_API_URL`, con la URL de Render **más `/api`** — por ejemplo
`https://turnero-ariel.onrender.com/api`. Se lee en tiempo de build, así que después de
cambiarla hay que redeployar.

Como es una SPA con rutas de cliente (`/turno/:id`, `/admin/...`), entrar directo a una de
esas URLs tiene que servir `index.html`. El preset de Vite en Vercel ya lo resuelve; si
alguna ruta profunda diera 404, agregar un `vercel.json` con un rewrite de `/(.*)` a
`/index.html`.

### 3. Después de deployar, revisar

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
