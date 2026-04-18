-- Agregar campo nombre directo al pedido (independiente del cliente)
ALTER TABLE pedidos ADD COLUMN cliente_nombre text;
ALTER TABLE pedidos ADD COLUMN cliente_telefono text;

-- Copiar datos actuales del cliente a cada pedido
UPDATE pedidos p SET
  cliente_nombre = c.nombre,
  cliente_telefono = c.telefono
FROM clientes c
WHERE p.cliente_id = c.id;
