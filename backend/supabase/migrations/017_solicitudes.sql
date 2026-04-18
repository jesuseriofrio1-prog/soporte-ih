-- =============================================
-- Migración 017: tiendas.slug + tabla solicitudes
-- =============================================
-- "Solicitud" = formulario que llena el cliente final por link público.
-- NO es un pedido todavía: el usuario copia los datos a Rocket y cuando
-- Rocket asigna un ID pedido lo pega aquí; entonces cuando el webhook
-- o el import de Rocket trae ese external_order_id, se enlaza con el
-- pedido creado. Así nunca se duplica.

-- 1. Slug legible para tiendas (URLs públicas del formulario).
ALTER TABLE tiendas ADD COLUMN IF NOT EXISTS slug text;
UPDATE tiendas SET slug = 'skinna' WHERE id = '00000000-0000-0000-0000-000000000001' AND slug IS NULL;
UPDATE tiendas SET slug = 'maxihogar' WHERE id = 'ef5b5af1-1b44-44c6-831d-dacc31e6f358' AND slug IS NULL;
ALTER TABLE tiendas ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tiendas_slug ON tiendas(slug);

-- 2. Tabla de solicitudes
CREATE TABLE IF NOT EXISTS solicitudes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id         uuid NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  producto_id       uuid REFERENCES productos(id) ON DELETE SET NULL,

  -- Datos del cliente final (capturados por el form público)
  cliente_nombre    text NOT NULL,
  cliente_telefono  text NOT NULL,
  cliente_email     text,
  provincia         text,
  ciudad            text,
  direccion         text NOT NULL,
  cantidad          int NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  notas             text,

  -- Estado del flujo Rocket
  estado            text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN (
    'PENDIENTE',        -- recién recibida, falta copiar a Rocket
    'ENVIADA_A_ROCKET', -- usuario pegó rocket_order_id, esperando webhook
    'ENLAZADA',         -- pedido creado por webhook/import vinculado
    'CANCELADA'
  )),
  rocket_order_id   text,      -- lo pega el admin tras crear en Rocket
  pedido_id         uuid REFERENCES pedidos(id) ON DELETE SET NULL,

  -- Trazabilidad
  ip_origen         text,
  user_agent        text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_tienda_created
  ON solicitudes(tienda_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado
  ON solicitudes(tienda_id, estado);

-- Para el auto-link: cuando llega pedido con external_order_id, busca la
-- solicitud por rocket_order_id.
CREATE INDEX IF NOT EXISTS idx_solicitudes_rocket_order
  ON solicitudes(tienda_id, rocket_order_id) WHERE rocket_order_id IS NOT NULL;

ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;

-- Service role ve todo (el frontend siempre pasa por el backend con service key).
DROP POLICY IF EXISTS "service_role_all_solicitudes" ON solicitudes;
CREATE POLICY "service_role_all_solicitudes"
  ON solicitudes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION touch_solicitudes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_solicitudes_updated_at ON solicitudes;
CREATE TRIGGER trg_solicitudes_updated_at
  BEFORE UPDATE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION touch_solicitudes_updated_at();
