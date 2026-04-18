-- =============================================
-- Migración 018: tienda_id en webhook_logs
-- =============================================
-- Antes: los logs se guardaban sin asociar tienda; al listar, cualquier
-- admin veía eventos de todas las tiendas mezclados. Ahora capturamos
-- la tienda cuando el webhook matchea un pedido, para filtrar en la UI.

ALTER TABLE webhook_logs
  ADD COLUMN IF NOT EXISTS tienda_id uuid REFERENCES tiendas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_tienda_created
  ON webhook_logs(tienda_id, created_at DESC);
