-- Prisma emitió acá un `ALTER TABLE "push_suscripciones" ALTER COLUMN "updated_at"
-- DROP DEFAULT`, y se borró a mano. Ese default está escrito a propósito en la migración
-- `diagnostico_push`: Prisma genera `updatedAt` sin default y la migración fallaba al
-- agregar una columna NOT NULL sobre una tabla que ya tenía filas. Como el default no
-- vive en `schema.prisma`, cada diff posterior lo va a querer sacar de nuevo. Es la misma
-- deriva que la del EXCLUDE de `turnos_no_solapamiento`, y se trata igual: leer el SQL
-- antes de aplicar y borrar la línea.

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN     "cliente_id" UUID;

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "telefono_e164" TEXT NOT NULL,
    "apodo" TEXT,
    "nombre" TEXT NOT NULL,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etiquetas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etiquetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_etiquetas" (
    "cliente_id" UUID NOT NULL,
    "etiqueta_id" UUID NOT NULL,

    CONSTRAINT "cliente_etiquetas_pkey" PRIMARY KEY ("cliente_id","etiqueta_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_telefono_e164_key" ON "clientes"("telefono_e164");

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_nombre_key" ON "etiquetas"("nombre");

-- AddForeignKey
ALTER TABLE "cliente_etiquetas" ADD CONSTRAINT "cliente_etiquetas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_etiquetas" ADD CONSTRAINT "cliente_etiquetas_etiqueta_id_fkey" FOREIGN KEY ("etiqueta_id") REFERENCES "etiquetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
