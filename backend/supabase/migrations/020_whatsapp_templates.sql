-- =============================================
-- Migración 020: plantillas de WhatsApp por tienda
-- =============================================
-- Cada tienda mantiene su catálogo de mensajes pre-hechos. Variables:
--   {nombre} {producto} {guia} {tienda} {agencia}
--   {direccion} {monto} {link_tracking} {link_referido}
-- Categorías: envio / tracking / novedad / alerta / upsell / referido
--             / general / libre

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id   uuid NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  slug        text NOT NULL,
  nombre      text NOT NULL,
  mensaje     text NOT NULL,
  categoria   text NOT NULL DEFAULT 'general' CHECK (categoria IN (
    'envio', 'tracking', 'novedad', 'alerta', 'upsell', 'referido', 'general', 'libre'
  )),
  activo      bool NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (tienda_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_templates_tienda_activo
  ON whatsapp_templates(tienda_id, activo, categoria);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_templates" ON whatsapp_templates;
CREATE POLICY "service_role_all_templates"
  ON whatsapp_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION touch_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION touch_templates_updated_at();

-- Seed: 6 plantillas por defecto para cada tienda existente. Son las
-- mismas que estaban hardcodeadas en frontend/src/composables/useWhatsApp.ts.
INSERT INTO whatsapp_templates (tienda_id, slug, nombre, mensaje, categoria)
SELECT t.id, x.slug, x.nombre, x.mensaje, x.categoria FROM tiendas t
CROSS JOIN (VALUES
  ('envio-nuevo',       '📦 Pedido Enviado',  'envio',
   E'¡Hola {nombre}! ✨ Tu pedido está en camino. 📦 Te confirmamos que tu *{producto}* de {tienda} ya salió de nuestra bodega y viaja hacia ti.\n\nPuedes seguir su recorrido en la web de Servientrega con esta guía: *{guia}*.\n\n¡Nos emociona mucho que lo pruebes! Si tienes alguna duda, aquí estamos para ayudarte. 💖'),
  ('reparto-hoy',       '🛵 En Reparto Hoy',  'tracking',
   E'¡Hola {nombre}! 🛵 ¡El gran día llegó! Tu *{producto}* de {tienda} está en reparto con los chicos de Servientrega y llegará a tu domicilio HOY. 🎉\n\nPor favor, asegúrate de estar pendiente del teléfono o de que haya alguien en casa para recibirlo (tu guía es: *{guia}*). ¡Ya casi tienes tu pedido en tus manos! ✨'),
  ('llego-agencia',     '🌟 Llegó a Agencia', 'tracking',
   E'¡Hola {nombre}! Buenas noticias 🌟 Tu *{producto}* de {tienda} ya te está esperando en la agencia Servientrega de *{agencia}*.\n\nPuedes pasar a retirarlo desde hoy presentando tu cédula y este número de guía: *{guia}*.\n\n¡No dejes esperar tu pedido, ve por él! ✨'),
  ('novedad-direccion', '🛵 Novedad Dirección','novedad',
   E'¡Hola {nombre}! 🛵 Los chicos de Servientrega intentaron entregar tu pedido de {tienda}, pero nos reportan un problema para ubicar la dirección.\n\nPor favor, confírmanos una referencia por este medio para coordinar un nuevo intento rápido. Tu guía es: *{guia}*.\n\n¡Queremos que tengas tu pedido cuanto antes! ✨'),
  ('alerta-devolucion', '🚨 Alerta Devolución','alerta',
   E'¡Hola {nombre}! 🚨 Te escribimos del equipo de {tienda} porque notamos que tu *{producto}* sigue esperándote en Servientrega (*{agencia}*).\n\n¡Cuidado! El paquete lleva varios días allí y el sistema lo devolverá a nuestra bodega mañana. 😰 Por favor, ayúdanos retirándolo HOY con tu guía: *{guia}*.\n\n¿Tuviste algún inconveniente para ir? Avísanos de inmediato por aquí para intentar ayudarte. 🙏'),
  ('libre',             '✏️ Mensaje Libre',   'libre',
   E'¡Hola {nombre}! Te escribimos del equipo de {tienda} con respecto a tu pedido de *{producto}* (Guía: *{guia}*).\n\n...')
) AS x(slug, nombre, categoria, mensaje)
ON CONFLICT (tienda_id, slug) DO NOTHING;
