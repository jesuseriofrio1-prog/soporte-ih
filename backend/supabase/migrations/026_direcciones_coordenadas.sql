-- =============================================
-- Migración 026: coordenadas + referencia de dirección
-- =============================================
-- Cuando el cliente usa el map picker (Google Maps) en el formulario público
-- guardamos lat/lng exactas + un campo libre de referencia ("casa blanca,
-- reja verde"). Sirve para que el mensajero/Rocket llegue directo y reducir
-- novedades por "dirección no ubicable".
--
-- Todos los campos son NULL-friendly: el cliente que solo escribe dirección
-- sin tocar el mapa sigue funcionando como siempre.

ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS lat numeric(9, 6),
  ADD COLUMN IF NOT EXISTS lng numeric(9, 6),
  ADD COLUMN IF NOT EXISTS direccion_referencia text;

COMMENT ON COLUMN solicitudes.lat IS
  'Latitud (WGS84) elegida por el cliente en el map picker. Null si solo escribió dirección.';
COMMENT ON COLUMN solicitudes.lng IS
  'Longitud (WGS84) elegida por el cliente en el map picker. Null si solo escribió dirección.';
COMMENT ON COLUMN solicitudes.direccion_referencia IS
  'Texto libre con pistas para el mensajero (ej. "portón azul, timbre del medio").';

-- Pedidos también: cuando la solicitud se enlaza con un pedido, el auto-enlace
-- copia las coordenadas. Así el admin puede abrir Maps directo desde el drawer.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS lat numeric(9, 6),
  ADD COLUMN IF NOT EXISTS lng numeric(9, 6),
  ADD COLUMN IF NOT EXISTS direccion_referencia text;

COMMENT ON COLUMN pedidos.lat IS
  'Latitud del punto de entrega. Heredada de la solicitud o del admin.';
COMMENT ON COLUMN pedidos.lng IS
  'Longitud del punto de entrega. Heredada de la solicitud o del admin.';
COMMENT ON COLUMN pedidos.direccion_referencia IS
  'Pistas libres para el mensajero, heredadas de la solicitud.';
