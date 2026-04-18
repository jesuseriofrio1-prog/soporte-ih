-- =============================================
-- Migración 019: tienda_id en fcm_tokens
-- =============================================
-- Antes: los tokens se guardaban sin asociar tienda. Al disparar alertas
-- de una tienda se notificaba a TODOS los tokens registrados (aunque el
-- admin estuviera mirando otra tienda). Ahora cada token se asocia a la
-- tienda que lo registró, y las alertas filtran por tienda.

ALTER TABLE fcm_tokens
  ADD COLUMN IF NOT EXISTS tienda_id uuid REFERENCES tiendas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_tienda ON fcm_tokens(tienda_id);
