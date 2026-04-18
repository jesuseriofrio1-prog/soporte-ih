-- =============================================
-- Migración 021: código corto de tracking público
-- =============================================
-- Expone los pedidos en una URL pública /t/<code> sin revelar el UUID
-- interno ni la guía de Servientrega. 8 chars base32 (sin 0/o/1/l/i
-- para legibilidad).

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tracking_code text;

CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS text AS $$
DECLARE
  chars text := 'abcdefghijkmnpqrstuvwxyz23456789';
  result text := '';
  i int;
  tries int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, (floor(random() * length(chars))::int) + 1, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pedidos WHERE tracking_code = result) THEN
      EXIT;
    END IF;
    tries := tries + 1;
    IF tries > 10 THEN RAISE EXCEPTION 'No se pudo generar tracking_code único'; END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

UPDATE pedidos SET tracking_code = generate_tracking_code() WHERE tracking_code IS NULL;

CREATE OR REPLACE FUNCTION trg_set_tracking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := generate_tracking_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedidos_tracking_code ON pedidos;
CREATE TRIGGER trg_pedidos_tracking_code
  BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION trg_set_tracking_code();

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_tracking_code
  ON pedidos(tracking_code) WHERE tracking_code IS NOT NULL;

ALTER TABLE pedidos ALTER COLUMN tracking_code SET NOT NULL;
