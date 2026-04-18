-- Función: distribución de pedidos por canal de origen (mes actual)
CREATE OR REPLACE FUNCTION get_canales_stats()
RETURNS JSON AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT COALESCE(json_agg(fila), '[]'::json) INTO resultado
  FROM (
    SELECT
      COALESCE(canal_origen, 'Sin especificar') AS canal,
      COUNT(*) AS total
    FROM pedidos
    WHERE date_trunc('month', created_at) = date_trunc('month', now())
    GROUP BY canal_origen
    ORDER BY total DESC
  ) AS fila;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
