-- ============================================
-- Soporte IH - Migración a plataforma multi-tienda
-- 002_multi_tienda.sql
-- ============================================
-- Cambios:
--   1) Nueva tabla `tiendas`
--   2) Columna `tienda_id` en clientes, productos, pedidos
--   3) ENUM estado_pedido actualizado (nuevo flujo)
--   4) Nuevas columnas en pedidos: cliente_nombre, cliente_telefono, retencion_inicio
--   5) Índices y políticas RLS para tiendas
--   6) Vista dashboard_stats reescrita con los nuevos estados
--   7) RPCs descontar_stock / devolver_stock
-- ============================================

-- ===================
-- 1. Tabla tiendas
-- ===================

CREATE TABLE IF NOT EXISTS tiendas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            text NOT NULL,
  logo_url          text,
  color_primario    text,
  color_secundario  text,
  color_fondo       text,
  color_borde       text,
  activo            boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TRIGGER trg_tiendas_updated_at
  BEFORE UPDATE ON tiendas
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at();

-- Tienda por defecto (ex-SKINNA) para que los datos existentes queden asignados
INSERT INTO tiendas (id, nombre)
VALUES ('00000000-0000-0000-0000-000000000001', 'Tienda por defecto')
ON CONFLICT (id) DO NOTHING;

-- ===================
-- 2. Agregar tienda_id a tablas existentes
-- ===================

-- Productos
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tienda_id uuid REFERENCES tiendas(id) ON DELETE RESTRICT;

UPDATE productos
  SET tienda_id = '00000000-0000-0000-0000-000000000001'
  WHERE tienda_id IS NULL;

ALTER TABLE productos
  ALTER COLUMN tienda_id SET NOT NULL;

-- El slug único ahora es por tienda
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_tienda_slug
  ON productos(tienda_id, slug);

-- Clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tienda_id uuid REFERENCES tiendas(id) ON DELETE RESTRICT;

UPDATE clientes
  SET tienda_id = '00000000-0000-0000-0000-000000000001'
  WHERE tienda_id IS NULL;

ALTER TABLE clientes
  ALTER COLUMN tienda_id SET NOT NULL;

-- Teléfono único por tienda, no global
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_telefono_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_tienda_telefono
  ON clientes(tienda_id, telefono);

-- Pedidos
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tienda_id        uuid REFERENCES tiendas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cliente_nombre   text,
  ADD COLUMN IF NOT EXISTS cliente_telefono text,
  ADD COLUMN IF NOT EXISTS retencion_inicio timestamptz;

UPDATE pedidos
  SET tienda_id = '00000000-0000-0000-0000-000000000001'
  WHERE tienda_id IS NULL;

-- Rellenar snapshots de cliente para pedidos antiguos
UPDATE pedidos p
  SET cliente_nombre   = c.nombre,
      cliente_telefono = c.telefono
  FROM clientes c
  WHERE p.cliente_id = c.id
    AND (p.cliente_nombre IS NULL OR p.cliente_telefono IS NULL);

ALTER TABLE pedidos
  ALTER COLUMN tienda_id SET NOT NULL;

-- ===================
-- 3. Actualizar ENUM estado_pedido
-- ===================
-- No se pueden eliminar valores de un ENUM en PostgreSQL fácilmente.
-- Estrategia: convertir la columna a text, droppear el enum, crearlo nuevo,
-- migrar valores antiguos al nuevo flujo y reconvertir.

ALTER TABLE pedidos ALTER COLUMN estado TYPE text USING estado::text;
ALTER TABLE pedidos ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE historial_estados ALTER COLUMN estado_anterior TYPE text;
ALTER TABLE historial_estados ALTER COLUMN estado_nuevo TYPE text;

-- Mapeo de estados viejos → nuevos
UPDATE pedidos SET estado = CASE estado
  WHEN 'INGRESANDO'  THEN 'PENDIENTE'
  WHEN 'EN_TRANSITO' THEN 'ENVIADO'
  WHEN 'EN_AGENCIA'  THEN 'RETIRO_EN_AGENCIA'
  WHEN 'EN_REPARTO'  THEN 'EN_RUTA'
  ELSE estado
END
WHERE estado IN ('INGRESANDO', 'EN_TRANSITO', 'EN_AGENCIA', 'EN_REPARTO');

DROP TYPE IF EXISTS estado_pedido;

CREATE TYPE estado_pedido AS ENUM (
  'PENDIENTE',
  'CONFIRMADO',
  'EN_PREPARACION',
  'ENVIADO',
  'EN_RUTA',
  'NOVEDAD',
  'RETIRO_EN_AGENCIA',
  'ENTREGADO',
  'NO_ENTREGADO',
  'DEVUELTO'
);

ALTER TABLE pedidos
  ALTER COLUMN estado TYPE estado_pedido USING estado::estado_pedido,
  ALTER COLUMN estado SET DEFAULT 'PENDIENTE';

-- ===================
-- 4. Índices nuevos
-- ===================

CREATE INDEX IF NOT EXISTS idx_pedidos_tienda    ON pedidos(tienda_id);
CREATE INDEX IF NOT EXISTS idx_productos_tienda  ON productos(tienda_id);
CREATE INDEX IF NOT EXISTS idx_clientes_tienda   ON clientes(tienda_id);

-- ===================
-- 5. RLS para tiendas
-- ===================

ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_tiendas" ON tiendas;
CREATE POLICY "service_role_all_tiendas"
  ON tiendas FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ===================
-- 6. Vista dashboard_stats reescrita
-- ===================

DROP VIEW IF EXISTS dashboard_stats;

CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  p.tienda_id,
  COUNT(*) FILTER (
    WHERE date_trunc('month', p.created_at) = date_trunc('month', now())
  ) AS pedidos_mes,

  COALESCE(SUM(p.monto) FILTER (
    WHERE date_trunc('month', p.created_at) = date_trunc('month', now())
  ), 0) AS ventas_mes,

  COUNT(*) FILTER (
    WHERE p.estado IN ('ENVIADO', 'EN_RUTA', 'RETIRO_EN_AGENCIA')
  ) AS en_transito,

  COUNT(*) FILTER (
    WHERE p.estado = 'RETIRO_EN_AGENCIA' AND p.dias_en_agencia >= 6
  ) AS riesgo_devolucion
FROM pedidos p
GROUP BY p.tienda_id;

-- ===================
-- 7. RPCs de stock
-- ===================

CREATE OR REPLACE FUNCTION descontar_stock(p_producto_id uuid)
RETURNS boolean AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE productos
    SET stock = stock - 1
  WHERE id = p_producto_id
    AND stock > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION devolver_stock(p_producto_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE productos
    SET stock = stock + 1
  WHERE id = p_producto_id;
END;
$$ LANGUAGE plpgsql;
