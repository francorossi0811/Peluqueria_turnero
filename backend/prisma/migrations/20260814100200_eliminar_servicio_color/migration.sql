-- Ariel no ofrece más el servicio "Color" (pedido de Franco, 14/8/2026).
--
-- Se borra la fila en vez de desactivarla porque desactivar no alcanza: `seed.ts` busca
-- los servicios POR NOMBRE y crea el que falta, así que el próximo `npm run seed` lo
-- resucitaría — y lo resucitaría `activo` y sin foto, o sea peor que ahora. El borrado
-- de verdad es este DELETE **más** sacarlo del array de `seed.ts`; sin las dos cosas,
-- vuelve.
--
-- La guarda del NOT EXISTS no es decorativa: `turnos.servicio_id` es
-- ON DELETE RESTRICT, así que con un solo turno histórico esto reventaría la migración.
-- Con la guarda, en esa situación no borra nada y sigue de largo — que es la respuesta
-- correcta, porque un turno viejo de Color necesita su fila (el snapshot guarda el
-- nombre y la duración, pero la FK sigue apuntando).
--
-- Verificado contra producción antes de escribir esto: 0 turnos referencian a Color.
DELETE FROM "servicios" s
WHERE s."nombre" = 'Color'
  AND NOT EXISTS (
    SELECT 1 FROM "turnos" t WHERE t."servicio_id" = s."id"
  );
