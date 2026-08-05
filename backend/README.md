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

**Esto aplica a toda migración futura, no solo a la inicial.** Como el constraint existe
en la base pero no en `schema.prisma`, Prisma lo ve como una diferencia y puede emitir un
`DROP CONSTRAINT "turnos_no_solapamiento"` en cualquier migración nueva. Perderlo en
silencio sería quedarse sin la garantía de que no se pisen dos turnos, que es justamente
la que no se puede confiar a la lógica de aplicación. Por eso el procedimiento es siempre:

```bash
npx prisma migrate dev --create-only --name <nombre>
# leer el SQL generado y borrar cualquier línea que toque turnos_no_solapamiento
npx prisma migrate deploy
```

Y después de aplicar, confirmar que sigue ahí:

```sql
SELECT conname FROM pg_constraint WHERE conname = 'turnos_no_solapamiento';
```

## Scripts

- `npm run dev` — server de desarrollo con recarga (`tsx watch`)
- `npm run build` — **solo chequea tipos.** No emite JavaScript: el `tsconfig.json` tiene
  `noEmit: true` porque usa `allowImportingTsExtensions` (los imports del cliente de
  Prisma llevan `.ts` explícito), y TypeScript no permite emitir con esa opción activada.
  No existe `dist/`.
- `npm start` — corre el server con `tsx`, o sea TypeScript directo, sin paso de compilado
- `npm run migrate:deploy` — aplica las migraciones pendientes; es lo que corre en el
  deploy (en desarrollo se usa `prisma migrate dev`)
- `npm run lint` — lint con oxlint
- `npm run format` — formatea con Prettier
- `npm test` — tests con vitest

### Por qué `tsx` y `prisma` están en `dependencies`

Parecen herramientas de desarrollo, pero producción las necesita: `npm start` corre
`tsx src/server.ts`, y tanto el `postinstall` (`prisma generate`) como
`migrate:deploy` usan el CLI de Prisma. En `devDependencies`, un `npm install` con
`NODE_ENV=production` —que es como instala Render— no las bajaría y el server no
arrancaría. Es un modo de falla que solo aparece en el deploy, nunca en local.

Ver `Docs/especificacion-api.md` (en la raíz del repo) para el contrato completo de la API.
