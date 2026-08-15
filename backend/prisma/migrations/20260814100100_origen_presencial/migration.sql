-- HU-08 — `origen` gana `presencial` y `telefono` pasa a llamarse `llamada`.
--
-- Dos motivos:
--
-- 1. El caso que HU-08 habilita ahora (el cliente de vidriera que Ariel registra cuando
--    tiene un rato) no es ninguno de los dos valores que había. Obligarlo a elegir entre
--    "telefono" y "whatsapp" garantizaba un dato falso en cada carga presencial.
-- 2. `telefono` se confundía con `cliente_telefono`, que es un dato de contacto y no un
--    canal de reserva. `llamada` dice lo que es.
--
-- ⚠️ Escrita a mano. El diff de Prisma para un cambio de enum tiende a recrear el tipo
-- (crear uno nuevo, castear la columna, borrar el viejo), que toca `turnos` entera y
-- pierde el default. `RENAME VALUE` conserva las filas existentes sin backfill: los
-- turnos que hoy dicen 'telefono' pasan a decir 'llamada' solos.
--
-- `ADD VALUE` dentro de una transacción es válido desde PostgreSQL 12 (acá corre 18)
-- mientras el valor nuevo no se USE en la misma transacción — y no se usa.
ALTER TYPE "OrigenTurno" RENAME VALUE 'telefono' TO 'llamada';

ALTER TYPE "OrigenTurno" ADD VALUE 'presencial' AFTER 'online';
