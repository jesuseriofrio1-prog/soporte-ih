-- Función: estadísticas del dashboard
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
      WHERE estado IN ('EN_TRANSITO', 'EN_AGENCIA', 'EN_REPARTO')
    ),
    'riesgo_devolucion', COUNT(*) FILTER (
      WHERE estado = 'EN_AGENCIA' AND dias_en_agencia >= 6
    )
  ) INTO resultado
  FROM pedidos;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función: ventas agrupadas por día (últimos 7 días)
CREATE OR REPLACE FUNCTION get_ventas_semana()
RETURNS JSON AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT json_agg(fila ORDER BY fila.fecha) INTO resultado
  FROM (
    SELECT
      d.fecha::date AS fecha,
      to_char(d.fecha, 'Dy') AS dia,
      COALESCE(SUM(p.monto), 0) AS total
    FROM generate_series(
      (now() - interval '6 days')::date,
      now()::date,
      '1 day'
    ) AS d(fecha)
    LEFT JOIN pedidos p
      ON p.created_at::date = d.fecha::date
    GROUP BY d.fecha
  ) AS fila;

  RETURN COALESCE(resultado, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
