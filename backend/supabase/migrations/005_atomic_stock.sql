-- Descontar stock atómicamente, retorna false si no hay stock
CREATE OR REPLACE FUNCTION descontar_stock(p_producto_id uuid)
RETURNS boolean AS $$
DECLARE
  filas integer;
BEGIN
  UPDATE productos
  SET stock = stock - 1, updated_at = now()
  WHERE id = p_producto_id AND stock > 0 AND activo = true;

  GET DIAGNOSTICS filas = ROW_COUNT;
  RETURN filas > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Devolver stock atómicamente
CREATE OR REPLACE FUNCTION devolver_stock(p_producto_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE productos
  SET stock = stock + 1, updated_at = now()
  WHERE id = p_producto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
