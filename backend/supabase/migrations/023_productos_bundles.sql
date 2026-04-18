-- =============================================
-- Migración 023: bundles cosméticos
-- =============================================
-- Un bundle es un producto normal del catálogo con un flag y un
-- "producto base". Cuando el cliente elige el producto base en el
-- formulario público, se le ofrece el bundle como upgrade.
--
-- No cambia el modelo de pedido: el bundle se vende como un producto
-- más (con su propio SKU, precio y stock). El admin gestiona el stock
-- manualmente (si el bundle "contiene" 2 productos, al vender uno
-- descuenta 2 del inventario físico — hoy fuera del scope).

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS es_bundle bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundle_upgrade_desde uuid
    REFERENCES productos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_productos_bundle_upgrade
  ON productos(bundle_upgrade_desde)
  WHERE bundle_upgrade_desde IS NOT NULL AND es_bundle = true AND activo = true;
