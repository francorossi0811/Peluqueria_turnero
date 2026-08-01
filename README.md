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
