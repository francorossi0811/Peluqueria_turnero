-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('reservado', 'cancelado', 'reprogramado', 'realizado', 'ausente');

-- CreateEnum
CREATE TYPE "OrigenTurno" AS ENUM ('online', 'telefono', 'whatsapp');

-- CreateTable
CREATE TABLE "servicios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "duracion_minutos" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_laboral" (
    "id" SERIAL NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fin" TIME NOT NULL,

    CONSTRAINT "horario_laboral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueos_horario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fecha_inicio" DATE NOT NULL,
    "hora_inicio" TIME,
    "fecha_fin" DATE NOT NULL,
    "hora_fin" TIME,
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueos_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriados" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" TEXT,
    "fuente" TEXT,
    "bloquea" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "administradores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_nombre" TEXT NOT NULL,
    "cliente_telefono" TEXT NOT NULL,
    "servicio_id" UUID NOT NULL,
    "servicio_nombre_snapshot" TEXT NOT NULL,
    "servicio_duracion_snapshot" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fin" TIME NOT NULL,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'reservado',
    "origen" "OrigenTurno" NOT NULL DEFAULT 'online',
    "motivo_cancelacion" TEXT,
    "turno_origen_id" UUID,
    "bloqueo_cancelacion_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feriados_fecha_key" ON "feriados"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "administradores_usuario_key" ON "administradores"("usuario");

-- CreateIndex
CREATE INDEX "turnos_fecha_hora_inicio_idx" ON "turnos"("fecha", "hora_inicio");

-- CreateIndex
CREATE INDEX "turnos_estado_idx" ON "turnos"("estado");

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_turno_origen_id_fkey" FOREIGN KEY ("turno_origen_id") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_bloqueo_cancelacion_id_fkey" FOREIGN KEY ("bloqueo_cancelacion_id") REFERENCES "bloqueos_horario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Anti doble-reserva (Docs/modelo-datos.md, "Reglas de integridad clave"): a nivel de
-- base de datos, no solo de aplicación. No representable en schema.prisma.
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_no_solapamiento" EXCLUDE USING gist (
    tsrange("fecha" + "hora_inicio", "fecha" + "hora_fin") WITH &&
) WHERE ("estado" = 'reservado'::"EstadoTurno");
