-- La foto del servicio deja de estar atada a su nombre.
--
-- Hasta acá la landing resolvía la foto con un mapa `nombre → archivo` en el frontend
-- (`FOTO_POR_SERVICIO` en Landing.tsx). El nombre del servicio es un campo que Ariel edita
-- desde el panel (HU-13), así que renombrar "Corte clásico" le borraba la foto **en
-- silencio**: la pantalla no fallaba, simplemente pasaba a mostrar una foto de stock y
-- nada lo avisaba. Atada a la fila, el nombre puede cambiar todas las veces que quiera.

-- AlterTable
ALTER TABLE "servicios" ADD COLUMN     "foto" TEXT;

-- Traspaso del mapeo que vivía en el frontend. Es la **única** vez que la foto se decide
-- por el nombre; de acá en más el vínculo es la fila.
--
-- El UPDATE va dentro de la migración y no en un script aparte —al revés que el backfill
-- de clientes— porque acá no hay nada que interpretar: son cinco literales. Aquel
-- necesitaba `libphonenumber-js` para saber dónde termina la característica de un teléfono
-- argentino, y reimplementarlo en SQL habría sido repetir el error que la librería evita.
--
-- `WHERE foto IS NULL` lo hace idempotente y, sobre todo, garantiza que no pise una foto
-- ya elegida si esta migración se corre dos veces.
--
-- Un nombre que no matchee deja la fila en NULL, que es exactamente el comportamiento de
-- hoy (cae a la foto de stock). O sea: esto no puede empeorar nada, solo completar.
UPDATE "servicios" SET "foto" = '/imagenes/servicio-corte.jpg'        WHERE "nombre" = 'Corte clásico'       AND "foto" IS NULL;
UPDATE "servicios" SET "foto" = '/imagenes/servicio-barba.jpg'        WHERE "nombre" = 'Barba'               AND "foto" IS NULL;
UPDATE "servicios" SET "foto" = '/imagenes/servicio-corte-barba.webp' WHERE "nombre" = 'Corte + Barba'       AND "foto" IS NULL;
UPDATE "servicios" SET "foto" = '/imagenes/servicio-color.jpg'        WHERE "nombre" = 'Color'               AND "foto" IS NULL;
-- Pedido de Ariel. ⚠️ El archivo hay que subirlo a `frontend/public/imagenes/`; mientras
-- no esté, el `onError` del <img> cae a la foto de stock en vez de dejar la imagen rota.
UPDATE "servicios" SET "foto" = '/imagenes/servicio-corte-mujer.jpg'  WHERE "nombre" = 'Corte de Pelo mujer' AND "foto" IS NULL;
