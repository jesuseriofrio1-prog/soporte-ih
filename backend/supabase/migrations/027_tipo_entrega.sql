-- =============================================
-- Migración 027: tipo de entrega (domicilio vs agencia Servientrega)
-- =============================================
-- El formulario público ahora pregunta al cliente si quiere envío a domicilio
-- o retiro en una agencia Servientrega. Cuando es agencia, no se usan
-- direccion/lat/lng/referencia — se guarda el nombre y dirección de la
-- agencia que el cliente eligió del dropdown.

ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS tipo_entrega text NOT NULL DEFAULT 'DOMICILIO',
  ADD COLUMN IF NOT EXISTS agencia_nombre text,
  ADD COLUMN IF NOT EXISTS agencia_direccion text;

ALTER TABLE solicitudes
  ADD CONSTRAINT solicitudes_tipo_entrega_chk
    CHECK (tipo_entrega IN ('DOMICILIO', 'AGENCIA'));

COMMENT ON COLUMN solicitudes.tipo_entrega IS
  'DOMICILIO (default): cliente recibe en su dirección. AGENCIA: retira en Servientrega.';
COMMENT ON COLUMN solicitudes.agencia_nombre IS
  'Nombre corto de la agencia elegida (ej. "Matriz Quito"). Null si DOMICILIO.';
COMMENT ON COLUMN solicitudes.agencia_direccion IS
  'Dirección completa de la agencia Servientrega. Null si DOMICILIO.';

-- Pedidos también heredan el tipo de entrega cuando se enlaza la solicitud.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tipo_entrega text NOT NULL DEFAULT 'DOMICILIO',
  ADD COLUMN IF NOT EXISTS agencia_nombre text,
  ADD COLUMN IF NOT EXISTS agencia_direccion text;

ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_tipo_entrega_chk
    CHECK (tipo_entrega IN ('DOMICILIO', 'AGENCIA'));

COMMENT ON COLUMN pedidos.tipo_entrega IS
  'DOMICILIO o AGENCIA — heredado de la solicitud cuando se enlaza.';
