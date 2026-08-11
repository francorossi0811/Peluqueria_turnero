-- HU-27 — Cobros.
--
-- Todo nullable y sin default: no hay nada que backfillear. Los turnos ya realizados
-- quedan sin cobro registrado, que es la verdad — inventarles un medio de pago sería
-- escribir un dato falso, el mismo criterio con el que el seed no le pisa la contraseña
-- a una cuenta que ya existe.

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('efectivo', 'transferencia', 'mercado_pago', 'tarjeta');

-- AlterTable
ALTER TABLE "servicios" ADD COLUMN     "precio" INTEGER;

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN     "cobrado_en" TIMESTAMP(3),
ADD COLUMN     "medio_pago" "MedioPago",
ADD COLUMN     "monto_cobrado" INTEGER;
