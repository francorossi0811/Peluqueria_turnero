-- HU-32 — La nota rápida de un día en la agenda semanal. Solo crea una tabla: no toca
-- `turnos`, así que el EXCLUDE `turnos_no_solapamiento` queda fuera de alcance.
CREATE TABLE "notas_del_dia" (
    "fecha" DATE NOT NULL,
    "texto" VARCHAR(200) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notas_del_dia_pkey" PRIMARY KEY ("fecha")
);
