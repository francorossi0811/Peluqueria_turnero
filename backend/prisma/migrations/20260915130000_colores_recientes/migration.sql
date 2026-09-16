-- HU-34 — La paleta de Ariel: los colores que usó alguna vez para pintar un turno.
--
-- Tabla propia y no una consulta sobre `turnos.color`: deducir la paleta de los turnos hacía
-- que tocar "Sin color" en el único turno con ese color lo borrara también de la lista.
--
-- El color es la PK y se guarda en minúscula, así que `#C0392B` y `#c0392b` no pueden
-- convivir. `usado_en` lo escribe la aplicación en cada uso, para que volver a elegir un
-- color que ya estaba lo suba en la lista.
--
-- ⚠️ El diff salió con este solo CREATE TABLE: no toca `turnos` ni, por lo tanto,
-- `turnos_no_solapamiento`. Verificado contra `pg_constraint` después de aplicar.
-- CreateTable
CREATE TABLE "colores_recientes" (
    "color" VARCHAR(7) NOT NULL,
    "usado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colores_recientes_pkey" PRIMARY KEY ("color")
);
