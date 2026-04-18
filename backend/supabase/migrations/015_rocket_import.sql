-- =============================================
-- Migración 015: soporte de importación desde Rocket Ecuador
-- =============================================
-- - Añade columnas external_source / external_order_id / cantidad a pedidos.
-- - Crea tabla producto_aliases para mapear nombres de productos entre
--   sistemas externos (Rocket) y nuestros productos internos.
-- =============================================

-- 1. Campos nuevos en pedidos
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS external_source    text,
  ADD COLUMN IF NOT EXISTS external_order_id  text,
  ADD COLUMN IF NOT EXISTS cantidad           int DEFAULT 1;

-- Un mismo pedido externo no puede importarse dos veces para la misma tienda
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_external
  ON pedidos(tienda_id, external_source, external_order_id)
  WHERE external_source IS NOT NULL;

-- 2. Tabla de alias de productos
CREATE TABLE IF NOT EXISTS producto_aliases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id       uuid NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  producto_id     uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  external_source text NOT NULL,
  alias_externo   text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- Búsqueda case-insensitive y evita duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_producto_aliases_unique
  ON producto_aliases(tienda_id, external_source, lower(alias_externo));

ALTER TABLE producto_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_producto_aliases" ON producto_aliases;
CREATE POLICY "service_role_all_producto_aliases"
  ON producto_aliases FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
