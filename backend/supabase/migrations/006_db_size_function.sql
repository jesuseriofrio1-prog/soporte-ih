CREATE OR REPLACE FUNCTION get_db_size()
RETURNS JSON AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT json_build_object(
    'size_bytes', pg_database_size(current_database()),
    'size_mb', round(pg_database_size(current_database()) / 1048576.0, 2),
    'limit_mb', 500,
    'usage_percent', round((pg_database_size(current_database()) / 1048576.0) / 500.0 * 100, 1)
  ) INTO resultado;
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
