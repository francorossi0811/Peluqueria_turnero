-- AlterTable
ALTER TABLE "turnos" ADD COLUMN     "visto_por_admin" BOOLEAN NOT NULL DEFAULT false;

-- Los turnos que ya existían son anteriores a esta funcionalidad: Ariel ya los vio.
-- Sin este backfill, al desplegar le aparecerían todos marcados como nuevos de golpe.
UPDATE "turnos" SET "visto_por_admin" = true;

-- CreateTable
CREATE TABLE "push_suscripciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_suscripciones_endpoint_key" ON "push_suscripciones"("endpoint");
