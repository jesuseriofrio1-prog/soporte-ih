-- =============================================
-- Migración 013: estadísticas enriquecidas para dashboard
-- =============================================
-- Cambios:
--   1) get_dashboard_stats(): añade %confirmación, %entrega,
--      facturación en tránsito/novedad, conteo de novedades.
--   2) Nueva RPC get_pedidos_semana(): serie diaria últimos 7 días
--      con entrantes/confirmados/entregados.
-- =============================================

-- ================================================================
-- 1. get_dashboard_stats enriquecida (reemplaza la versión anterior)
-- ================================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_tienda_id uuid)
RETURNS JSON AS $$
DECLARE
  resultado JSON;
  v_entrantes_mes int;
  v_confirmados_mes int;
  v_entregados_mes int;
  v_cerrados_mes int;
  v_ventas_mes numeric;
BEGIN
  -- Conteos básicos para los porcentajes
  SELECT
    COUNT(*) FILTER (
      WHERE date_trunc('month', created_at) = date_trunc('month', now())
    ),
    COUNT(*) FILTER (
      WHERE date_trunc('month', created_at) = date_trunc('month', now())
      AND estado <> 'PENDIENTE'
    ),
    COUNT(*) FILTER (
      WHERE date_trunc('month', created_at) = date_trunc('month', now())
      AND estado = 'ENTREGADO'
    ),
    -- "Cerrados" = pedidos confirmados que ya no están en tránsito
    -- (entregados + no entregados + devueltos)
    COUNT(*) FILTER (
      WHERE date_trunc('month', created_at) = date_trunc('month', now())
      AND estado IN ('ENTREGADO', 'NO_ENTREGADO', 'DEVUELTO')
    ),
    COALESCE(SUM(monto) FILTER (
      WHERE date_trunc('month', created_at) = date_trunc('month', now())
    ), 0)
  INTO v_entrantes_mes, v_confirmados_mes, v_entregados_mes, v_cerrados_mes, v_ventas_mes
  FROM pedidos WHERE tienda_id = p_tienda_id;

  SELECT json_build_object(
    -- KPIs existentes (compatibilidad)
    'pedidos_mes', v_entrantes_mes,
    'ventas_mes', v_ventas_mes,
    'en_transito', COUNT(*) FILTER (
      WHERE estado IN ('ENVIADO', 'EN_RUTA', 'RETIRO_EN_AGENCIA')
    ),
    'riesgo_devolucion', COUNT(*) FILTER (
      WHERE estado = 'RETIRO_EN_AGENCIA' AND dias_en_agencia >= 6
    ),

    -- KPIs nuevos
    'confirmados_mes', v_confirmados_mes,
    'entregados_mes', v_entregados_mes,
    'porcentaje_confirmacion', CASE
      WHEN v_entrantes_mes > 0
        THEN ROUND((v_confirmados_mes::numeric / v_entrantes_mes) * 100, 1)
      ELSE 0
    END,
    'porcentaje_entrega', CASE
      WHEN v_cerrados_mes > 0
        THEN ROUND((v_entregados_mes::numeric / v_cerrados_mes) * 100, 1)
      ELSE 0
    END,
    'facturacion_en_transito', COALESCE(SUM(monto) FILTER (
      WHERE estado IN ('ENVIADO', 'EN_RUTA', 'RETIRO_EN_AGENCIA')
    ), 0),
    'facturacion_en_novedad', COALESCE(SUM(monto) FILTER (
      WHERE estado IN ('NOVEDAD', 'NO_ENTREGADO')
    ), 0),
    'novedades', COUNT(*) FILTER (
      WHERE estado IN ('NOVEDAD', 'NO_ENTREGADO')
    )
  ) INTO resultado
  FROM pedidos WHERE tienda_id = p_tienda_id;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 2. Serie diaria de pedidos (últimos 7 días)
-- ================================================================

CREATE OR REPLACE FUNCTION get_pedidos_semana(p_tienda_id uuid)
RETURNS JSON AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT json_agg(fila ORDER BY fila.fecha) INTO resultado
  FROM (
    SELECT
      d.fecha::date AS fecha,
      to_char(d.fecha, 'Dy') AS dia,
      COUNT(p.id) AS entrantes,
      COUNT(*) FILTER (
        WHERE p.estado IS NOT NULL AND p.estado <> 'PENDIENTE'
      ) AS confirmados,
      COUNT(*) FILTER (
        WHERE p.estado = 'ENTREGADO'
      ) AS entregados
    FROM generate_series(
      (now() - interval '6 days')::date,
      now()::date,
      '1 day'
    ) AS d(fecha)
    LEFT JOIN pedidos p
      ON p.created_at::date = d.fecha::date
      AND p.tienda_id = p_tienda_id
    GROUP BY d.fecha
  ) AS fila;

  RETURN COALESCE(resultado, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
