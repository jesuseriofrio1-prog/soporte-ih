-- =============================================
-- Migración 022: unit economics por producto
-- =============================================
-- Costo unitario (lo que te cuesta) + fee Rocket promedio (varía por
-- tamaño/peso). Ambos opcionales hasta que el admin los llene manualmente.

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS costo_unitario numeric(10,2),
  ADD COLUMN IF NOT EXISTS fee_envio      numeric(10,2);

COMMENT ON COLUMN productos.costo_unitario IS
  'Costo unitario total del producto (incluye flete a bodega). Nullable hasta que el admin lo configura.';
COMMENT ON COLUMN productos.fee_envio IS
  'Fee promedio de Rocket por unidad de este producto (depende de tamaño/peso). Nullable.';
