# Backend — Turnero Peluquería Ariel

Node + Express + TypeScript + Prisma (PostgreSQL).

## Desarrollo

```bash
cp .env.example .env   # completar DATABASE_URL con un proyecto de Neon o Supabase
npm install
npx prisma generate
npm run dev
```

`GET /api/health` responde `{ "status": "ok" }` sin depender de la base de datos —
sirve para confirmar que el server levanta antes de tener `DATABASE_URL` configurado.

## Migraciones

Con `DATABASE_URL` ya apuntando a una base real:

```bash
npx prisma migrate dev --name init
```

**Importante:** el constraint anti-doble-reserva de `turnos` (`EXCLUDE USING gist`, ver
`Docs/modelo-datos.md`) no se puede expresar en `schema.prisma`. Después de la primera
migración hay que agregarlo a mano en el SQL generado — ver el comentario al final de
`prisma/schema.prisma`.

## Scripts

- `npm run dev` — server de desarrollo con recarga (`tsx watch`)
- `npm run build` — compila a `dist/`
- `npm start` — corre el build compilado
- `npm run lint` — lint con oxlint
- `npm run format` — formatea con Prettier

Ver `Docs/especificacion-api.md` (en la raíz del repo) para el contrato completo de la API.
