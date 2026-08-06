-- AlterTable
ALTER TABLE "servicios" ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0;

-- Orden de exhibición pedido por Ariel: del servicio más pedido al menos pedido.
-- Se hace por nombre porque los ids son uuid distintos en cada entorno. Un servicio que
-- no matchee queda en 0 y, al desempatar por nombre, cae al principio de la lista sin
-- romper nada.
UPDATE "servicios" SET "orden" = 1 WHERE "nombre" = 'Corte clásico';
UPDATE "servicios" SET "orden" = 2 WHERE "nombre" = 'Corte + Barba';
UPDATE "servicios" SET "orden" = 3 WHERE "nombre" = 'Barba';
UPDATE "servicios" SET "orden" = 4 WHERE "nombre" = 'Color';
