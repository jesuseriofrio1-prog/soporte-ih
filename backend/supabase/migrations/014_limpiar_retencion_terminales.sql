-- =============================================
-- Migración 014: limpiar retencion_inicio colgado en pedidos ya cerrados
-- =============================================
-- El campo `retencion_inicio` se usa como toggle manual "aplazar hasta
-- que el cliente retire". Si el pedido terminó su ciclo (ENTREGADO,
-- NO_ENTREGADO, DEVUELTO) ya no aplica la retención.
--
-- Antes de esta migración, `retencion_inicio` no se limpiaba al pasar
-- a estado terminal, lo que hacía aparecer pedidos ya entregados en
-- el chip "Aplazados". A partir de ahora el backend lo limpia en
-- pedidos.service.ts::cambiarEstado().
--
-- Esta migración limpia el legacy.
-- =============================================

UPDATE pedidos
SET retencion_inicio = NULL
WHERE retencion_inicio IS NOT NULL
  AND estado IN ('ENTREGADO', 'NO_ENTREGADO', 'DEVUELTO');
