-- Agrega "Corte de Pelo mujer" con su foto.
--
-- Va como migración y no como un INSERT suelto por lo mismo que dice CLAUDE.md sobre las
-- fotos: el panel deja a Ariel crear servicios (HU-13) pero NO elegirles la imagen, así
-- que un servicio creado desde la pantalla nace sin foto y cae a la de stock. La foto se
-- asigna en la base, y una migración es la forma de que eso quede versionado y se aplique
-- igual en desarrollo y en producción.
--
-- Es idempotente a propósito: en desarrollo el servicio ya existe (se creó a mano cuando
-- se probó la landing), así que sin el WHERE NOT EXISTS esta migración lo duplicaría.
-- `nombre` no tiene restricción de unicidad, o sea que nada de la base lo impediría.
--
-- `precio` queda en NULL, que es el estado real: los precios los carga Ariel y nadie más
-- los sabe. `orden` se calcula como el último + 1 para que aparezca al final de la lista
-- del cliente, sin reordenar los que ya están.
-- ⚠️ `updated_at` va explícito. Es NOT NULL y **no tiene default en la base**: Prisma lo
-- llena desde el cliente por `@updatedAt`, así que cualquier INSERT en SQL crudo lo deja
-- en null y la fila se rechaza. Es el mismo tipo de trampa que ya había mordido a este
-- proyecto con el `updated_at` de `push_suscripciones` en `diagnostico_push`.
INSERT INTO "servicios" ("nombre", "duracion_minutos", "activo", "orden", "foto", "created_at", "updated_at")
SELECT
  'Corte de Pelo mujer',
  30,
  true,
  COALESCE((SELECT MAX("orden") FROM "servicios"), 0) + 1,
  '/imagenes/servicio-corte-mujer.jpg',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "servicios" WHERE "nombre" = 'Corte de Pelo mujer'
);
