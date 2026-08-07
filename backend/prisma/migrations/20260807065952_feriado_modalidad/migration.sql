-- `bloquea` (boolean) pasa a `modalidad` (tres estados). No hay conversión de datos
-- porque la tabla está vacía: los feriados nunca se llegaron a sincronizar con ninguna
-- fuente externa — se verificó con un `count()` antes de generar esto.
--
-- El default es `medio_dia` y no `cerrado` a propósito: es lo que Ariel hace de verdad en
-- un feriado, y cerrar sería inventarle una decisión que no tomó.

-- CreateEnum
CREATE TYPE "ModalidadFeriado" AS ENUM ('cerrado', 'medio_dia', 'dia_completo');

-- AlterTable
ALTER TABLE "feriados" DROP COLUMN "bloquea",
ADD COLUMN     "modalidad" "ModalidadFeriado" NOT NULL DEFAULT 'medio_dia';

-- BORRADO A MANO, no volver a agregarlo:
--   ALTER TABLE "push_suscripciones" ALTER COLUMN "updated_at" DROP DEFAULT;
--
-- Prisma lo emite en cada diff porque `@updatedAt` no genera un DEFAULT en la base, así
-- que ve el `DEFAULT CURRENT_TIMESTAMP` que le pusimos a mano en `diagnostico_push` como
-- algo que sobra. Pero ese default existe por un motivo: sin él, agregar la columna
-- `updated_at NOT NULL` sobre una tabla que ya tenía filas falla. Dejar pasar este DROP
-- desarma ese arreglo y rompe la próxima migración que toque la tabla.
