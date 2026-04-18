-- =============================================
-- MIGRACIÓN MULTI-TIENDA "SOPORTE IH"
-- =============================================

-- 1. Crear tabla tiendas
CREATE TABLE tiendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  estado boolean DEFAULT true,
  logo_url text,
  color_primario text DEFAULT '#030363',
  color_secundario text DEFAULT '#C49BC2',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_tiendas" ON tiendas FOR ALL USING (true) WITH CHECK (true);

-- 2. Insertar tienda inicial con los datos existentes
INSERT INTO tiendas (id, nombre) VALUES ('00000000-0000-0000-0000-000000000001', 'Skinna');

-- 3. Agregar tienda_id a productos
ALTER TABLE productos ADD COLUMN tienda_id uuid REFERENCES tiendas(id) ON DELETE CASCADE;
UPDATE productos SET tienda_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE productos ALTER COLUMN tienda_id SET NOT NULL;

-- 4. Agregar tienda_id a clientes
ALTER TABLE clientes ADD COLUMN tienda_id uuid REFERENCES tiendas(id) ON DELETE CASCADE;
UPDATE clientes SET tienda_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE clientes ALTER COLUMN tienda_id SET NOT NULL;

-- 5. Agregar tienda_id a pedidos
ALTER TABLE pedidos ADD COLUMN tienda_id uuid REFERENCES tiendas(id) ON DELETE CASCADE;
UPDATE pedidos SET tienda_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE pedidos ALTER COLUMN tienda_id SET NOT NULL;

-- 6. Cambiar UNIQUE constraints para permitir slugs/teléfonos duplicados entre tiendas
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_slug_key;
CREATE UNIQUE INDEX idx_productos_slug_tienda ON productos(slug, tienda_id);

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_telefono_key;
CREATE UNIQUE INDEX idx_clientes_telefono_tienda ON clientes(telefono, tienda_id);

-- 7. Índices para filtrar por tienda
CREATE INDEX idx_productos_tienda ON productos(tienda_id);
CREATE INDEX idx_clientes_tienda ON clientes(tienda_id);
CREATE INDEX idx_pedidos_tienda ON pedidos(tienda_id);

-- 8. Actualizar vista clientes_con_stats
DROP VIEW IF EXISTS clientes_con_stats;
CREATE VIEW clientes_con_stats AS
SELECT
  c.*,
  COALESCE(COUNT(p.id), 0) AS pedidos_total,
  COALESCE(SUM(p.monto), 0) AS monto_total
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id
GROUP BY c.id;

-- 9. Actualizar funciones SQL con parámetro tienda_id
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_tienda_id uuid)
RETURNS JSON AS $$
DECLARE resultado JSON;
BEGIN
  SELECT json_build_object(
    'pedidos_mes', COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', now())),
    'ventas_mes', COALESCE(SUM(monto) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', now())), 0),
    'en_transito', COUNT(*) FILTER (WHERE estado IN ('ENVIADO', 'EN_RUTA', 'RETIRO_EN_AGENCIA')),
    'riesgo_devolucion', COUNT(*) FILTER (WHERE estado = 'RETIRO_EN_AGENCIA' AND dias_en_agencia >= 6)
  ) INTO resultado
  FROM pedidos WHERE tienda_id = p_tienda_id;
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_ventas_semana(p_tienda_id uuid)
RETURNS JSON AS $$
DECLARE resultado JSON;
BEGIN
  SELECT json_agg(fila ORDER BY fila.fecha) INTO resultado
  FROM (
    SELECT d.fecha::date AS fecha, to_char(d.fecha, 'Dy') AS dia,
      COALESCE(SUM(p.monto), 0) AS total
    FROM generate_series((now() - interval '6 days')::date, now()::date, '1 day') AS d(fecha)
    LEFT JOIN pedidos p ON p.created_at::date = d.fecha::date AND p.tienda_id = p_tienda_id
    GROUP BY d.fecha
  ) AS fila;
  RETURN COALESCE(resultado, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_canales_stats(p_tienda_id uuid)
RETURNS JSON AS $$
DECLARE resultado JSON;
BEGIN
  SELECT COALESCE(json_agg(fila), '[]'::json) INTO resultado
  FROM (
    SELECT COALESCE(canal_origen, 'Sin especificar') AS canal, COUNT(*) AS total
    FROM pedidos
    WHERE tienda_id = p_tienda_id AND date_trunc('month', created_at) = date_trunc('month', now())
    GROUP BY canal_origen ORDER BY total DESC
  ) AS fila;
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
