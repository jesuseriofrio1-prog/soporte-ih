-- =============================================
-- Migración 024: programa de referidos (tracking puro)
-- =============================================
-- El admin genera un código único por cliente y comparte el link
-- /p/<slug>/<producto>?ref=<codigo>. Cuando un nuevo cliente llena
-- el form público con ese ref, lo guardamos en la solicitud y
-- sumamos al contador del referente. Sin descuentos dinámicos en
-- el form público — los aplica el admin manualmente en Rocket.

CREATE TABLE IF NOT EXISTS referidos (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id                 uuid NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  codigo                    text NOT NULL,
  cliente_referente_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_referente_nombre  text NOT NULL,
  cliente_referente_tel     text,
  usos_count                int NOT NULL DEFAULT 0,
  ultimo_uso_en             timestamptz,
  notas                     text,
  activo                    bool NOT NULL DEFAULT true,
  created_at                timestamptz DEFAULT now(),
  UNIQUE (tienda_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_referidos_tienda_activo
  ON referidos(tienda_id, activo);
CREATE INDEX IF NOT EXISTS idx_referidos_cliente
  ON referidos(cliente_referente_id) WHERE cliente_referente_id IS NOT NULL;

ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS referido_codigo text;
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS referido_codigo text;

ALTER TABLE referidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_referidos" ON referidos;
CREATE POLICY "service_role_all_referidos"
  ON referidos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
