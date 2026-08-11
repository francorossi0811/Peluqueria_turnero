-- Columnas de diagnóstico de las suscripciones push.
--
-- `updated_at` lleva DEFAULT CURRENT_TIMESTAMP, que Prisma no genera: sin eso, agregar
-- una columna NOT NULL sobre una tabla que ya tiene filas falla. Prisma marca el campo
-- con @updatedAt y lo escribe desde la aplicación, así que el default solo sirve para
-- darle un valor a las filas que ya existen.
ALTER TABLE "push_suscripciones"
  ADD COLUMN "user_agent"        TEXT,
  ADD COLUMN "ultimo_intento_en" TIMESTAMP(3),
  ADD COLUMN "ultimo_estado"     INTEGER,
  ADD COLUMN "ultimo_error"      TEXT,
  ADD COLUMN "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
