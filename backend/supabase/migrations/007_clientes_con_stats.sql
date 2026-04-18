CREATE OR REPLACE VIEW clientes_con_stats AS
SELECT
  c.*,
  COALESCE(COUNT(p.id), 0) AS pedidos_total,
  COALESCE(SUM(p.monto), 0) AS monto_total
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id
GROUP BY c.id;
