-- Campo para el inicio del conteo de retención (null = no activado)
ALTER TABLE pedidos ADD COLUMN retencion_inicio timestamptz DEFAULT NULL;
