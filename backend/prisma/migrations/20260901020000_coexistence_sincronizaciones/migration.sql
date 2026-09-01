-- CreateEnum
CREATE TYPE "EstadoSincronizacion" AS ENUM ('en_curso', 'ok', 'error');

-- CreateTable
CREATE TABLE "coexistence_sincronizaciones" (
    "id" UUID NOT NULL,
    "sync_type" TEXT NOT NULL,
    "estado" "EstadoSincronizacion" NOT NULL DEFAULT 'en_curso',
    "request_id" TEXT,
    "respuesta" TEXT,
    "iniciado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminado_en" TIMESTAMP(3),

    CONSTRAINT "coexistence_sincronizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coexistence_sincronizaciones_sync_type_key" ON "coexistence_sincronizaciones"("sync_type");

