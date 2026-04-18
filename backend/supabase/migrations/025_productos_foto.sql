-- =============================================
-- Migración 025: foto de producto en Supabase Storage
-- =============================================
-- Permite al admin subir una foto por producto. Bucket público para
-- que la URL funcione en clientes sin auth (form público, tracking).

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS foto_url text;

COMMENT ON COLUMN productos.foto_url IS
  'URL pública de la foto del producto (Supabase Storage bucket producto-fotos). Null = usa placeholder.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'producto-fotos',
  'producto-fotos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
