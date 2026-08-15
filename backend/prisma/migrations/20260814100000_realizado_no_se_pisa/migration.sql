-- Un turno REALIZADO no se puede pisar (decisión de Franco, 14/8/2026).
--
-- Hasta acá el anti doble-reserva solo miraba `reservado`, y estaba bien mientras nadie
-- pudiera cargar un turno en el pasado: un `realizado` siempre está atrás en el tiempo y
-- no había forma de reservar ahí. Con HU-08 ampliada (Ariel registra los clientes de
-- vidriera hasta 7 días para atrás) ese hueco se vuelve alcanzable de verdad.
--
-- ⚠️ `ausente` sigue AFUERA del predicado, y no es un olvido: marcar Ausente libera el
-- rato es el flujo que Ariel usa todos los días (el cliente no vino a los 10 minutos, lo
-- marca y mete a otro). Endurecer esto a los tres estados que la agenda dibuja rompería
-- justo eso. `cancelado` y `reprogramado` también quedan afuera, por el mismo motivo:
-- ese rato volvió a estar libre.
--
-- Escrita a mano y no diffeada: el EXCLUDE no vive en schema.prisma (no es
-- representable), así que Prisma no lo conoce y un diff automático solo podría borrarlo.
--
-- Verificado contra producción antes de escribir esto: no existía ningún par de turnos
-- solapados entre `reservado` y `realizado`, así que la restricción se puede crear.
ALTER TABLE "turnos" DROP CONSTRAINT "turnos_no_solapamiento";

ALTER TABLE "turnos" ADD CONSTRAINT "turnos_no_solapamiento" EXCLUDE USING gist (
    tsrange("fecha" + "hora_inicio", "fecha" + "hora_fin") WITH &&
) WHERE ("estado" IN ('reservado'::"EstadoTurno", 'realizado'::"EstadoTurno"));
