-- ============================================
-- SKINNA - Schema inicial
-- 001_initial_schema.sql
-- ============================================

-- ===================
-- 1. Tipos ENUM
-- ===================

CREATE TYPE estado_pedido AS ENUM (
  'INGRESANDO',
  'EN_TRANSITO',
  'EN_AGENCIA',
  'EN_REPARTO',
  'NOVEDAD',
  'ENTREGADO',
  'DEVUELTO'
);

CREATE TYPE tipo_entrega AS ENUM (
  'DOMICILIO',
  'AGENCIA'
);

-- ===================
-- 2. Tablas
-- ===================

-- Productos
CREATE TABLE productos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  nombre     text NOT NULL,
  precio     numeric(10,2) NOT NULL,
  stock      integer NOT NULL DEFAULT 0,
  icono      text,
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Clientes
CREATE TABLE clientes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  telefono   text UNIQUE NOT NULL,
  ciudad     text,
  notas      text,
  created_at timestamptz DEFAULT now()
);

-- Pedidos
CREATE TABLE pedidos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  producto_id      uuid NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  guia             text NOT NULL,
  tipo_entrega     tipo_entrega NOT NULL,
  direccion        text NOT NULL,
  estado           estado_pedido DEFAULT 'INGRESANDO',
  fecha_despacho   date DEFAULT CURRENT_DATE,
  dias_en_agencia  integer DEFAULT 0,
  monto            numeric(10,2) NOT NULL,
  canal_origen     text,
  notas            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Historial de estados
CREATE TABLE historial_estados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado_anterior text,
  estado_nuevo    text NOT NULL,
  nota            text,
  created_at      timestamptz DEFAULT now()
);

-- ===================
-- 3. Índices
-- ===================

CREATE INDEX idx_pedidos_cliente    ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_producto   ON pedidos(producto_id);
CREATE INDEX idx_pedidos_estado     ON pedidos(estado);
CREATE INDEX idx_historial_pedido   ON historial_estados(pedido_id);

-- ===================
-- 4. Trigger updated_at
-- ===================

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at();

-- ===================
-- 5. Vista dashboard_stats
-- ===================

CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  COUNT(*) FILTER (
    WHERE date_trunc('month', p.created_at) = date_trunc('month', now())
  ) AS pedidos_mes,

  COALESCE(SUM(p.monto) FILTER (
    WHERE date_trunc('month', p.created_at) = date_trunc('month', now())
  ), 0) AS ventas_mes,

  COUNT(*) FILTER (
    WHERE p.estado IN ('EN_TRANSITO', 'EN_AGENCIA', 'EN_REPARTO')
  ) AS en_transito,

  COUNT(*) FILTER (
    WHERE p.estado = 'EN_AGENCIA' AND p.dias_en_agencia >= 6
  ) AS riesgo_devolucion
FROM pedidos p;

-- ===================
-- 6. RLS (Row Level Security)
-- ===================

-- Habilitar RLS en todas las tablas
ALTER TABLE productos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estados  ENABLE ROW LEVEL SECURITY;

-- Policies permisivas para service_role (el backend es el único que accede)
CREATE POLICY "service_role_all_productos"
  ON productos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_all_clientes"
  ON clientes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_all_pedidos"
  ON pedidos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_all_historial"
  ON historial_estados FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
