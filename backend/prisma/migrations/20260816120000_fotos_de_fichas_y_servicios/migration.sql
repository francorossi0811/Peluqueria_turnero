-- HU-29 — Las fotos que sube Ariel: la galería de una ficha y la foto de un servicio.
--
-- El archivo va en Postgres (`bytea`) y no en un bucket: no había ningún lugar donde un
-- archivo subido sobreviviera, porque `frontend/public` se hornea en el build de Vercel y el
-- disco de Render es efímero. Ver el comentario del modelo en `schema.prisma`.

-- CreateTable
CREATE TABLE "imagenes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "datos" BYTEA NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "cliente_id" UUID,
    "servicio_id" UUID,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imagenes_servicio_id_key" ON "imagenes"("servicio_id");

-- CreateIndex
CREATE INDEX "imagenes_cliente_id_orden_idx" ON "imagenes"("cliente_id", "orden");

-- AddForeignKey
ALTER TABLE "imagenes" ADD CONSTRAINT "imagenes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagenes" ADD CONSTRAINT "imagenes_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Escrito a mano: Prisma no sabe emitir CHECKs, igual que con el EXCLUDE de `turnos`.
--
-- Una imagen tiene exactamente UN dueño. Sin esto la tabla admite dos estados imposibles de
-- interpretar: una fila sin dueño, que nadie puede alcanzar ni borrar y ocupa lugar para
-- siempre, y una con los dos, que no se sabe si es la foto de una ficha o la de un servicio.
ALTER TABLE "imagenes" ADD CONSTRAINT "imagenes_un_solo_dueno"
    CHECK (("cliente_id" IS NULL) <> ("servicio_id" IS NULL));
