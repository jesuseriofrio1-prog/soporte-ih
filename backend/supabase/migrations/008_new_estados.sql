-- Eliminar vista que depende del tipo enum
DROP VIEW IF EXISTS dashboard_stats;

-- Cambiar columna estado a text
ALTER TABLE pedidos ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE pedidos ALTER COLUMN estado TYPE text USING estado::text;
ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'PENDIENTE';

-- Migrar estados existentes
UPDATE pedidos SET estado = 'PENDIENTE' WHERE estado = 'INGRESANDO';
UPDATE pedidos SET estado = 'ENVIADO' WHERE estado = 'EN_TRANSITO';
UPDATE pedidos SET estado = 'RETIRO_EN_AGENCIA' WHERE estado = 'EN_AGENCIA';
UPDATE pedidos SET estado = 'EN_RUTA' WHERE estado = 'EN_REPARTO';
UPDATE pedidos SET estado = 'NO_ENTREGADO' WHERE estado = 'NOVEDAD';

-- Eliminar el tipo ENUM viejo
DROP TYPE IF EXISTS estado_pedido;

-- Recrear vista dashboard_stats
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
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
FROM pedidos p;

-- Actualizar función dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT json_build_object(
    'pedidos_mes', COUNT(*) FILTER (
      WHERE date_trunc('month', created_at) = date_trunc('month', now())
    ),
    'ventas_mes', COALESCE(SUM(monto) FILTER (
      WHERE date_trunc('month', created_at) = date_trunc('month', now())
    ), 0),
    'en_transito', COUNT(*) FILTER (
      WHERE estado IN ('ENVIADO', 'EN_RUTA', 'RETIRO_EN_AGENCIA')
    ),
    'riesgo_devolucion', COUNT(*) FILTER (
      WHERE estado = 'RETIRO_EN_AGENCIA' AND dias_en_agencia >= 6
    )
  ) INTO resultado
  FROM pedidos;
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
