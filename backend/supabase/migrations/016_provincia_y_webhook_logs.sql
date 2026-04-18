-- =============================================
-- Migración 016: provincia en clientes/pedidos + webhook_logs
-- =============================================

-- 1. Provincia (texto libre, opcional). Se llena en imports/webhooks;
--    manualmente también se puede setear en el futuro.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS provincia text;
ALTER TABLE pedidos  ADD COLUMN IF NOT EXISTS provincia text;

-- 2. Tabla de log de webhooks recibidos (para debug y UI)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_source text NOT NULL,           -- 'rocket'
  event_type      text,                    -- e.g. 'order_status_update'
  external_order_id text,
  status          text NOT NULL,           -- 'ok' | 'pedido_no_encontrado' | 'invalid_signature' | 'error'
  payload         jsonb NOT NULL,
  pedido_id       uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  error_mensaje   text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_source_created
  ON webhook_logs(external_source, created_at DESC);

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_webhook_logs" ON webhook_logs;
CREATE POLICY "service_role_all_webhook_logs"
  ON webhook_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
