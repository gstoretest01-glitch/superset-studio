CREATE OR REPLACE FUNCTION public.get_public_block_context(_block_id uuid)
RETURNS TABLE (
  chart_id integer,
  row_limit integer,
  base_url text,
  service_username text,
  auth_provider text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.chart_id, b.row_limit, c.base_url, c.service_username, c.auth_provider
  FROM public.report_blocks b
  JOIN public.reports r ON r.id = b.report_id
  JOIN public.superset_connections c ON c.id = r.connection_id
  WHERE b.id = _block_id
    AND r.is_published = true
    AND b.chart_id IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_block_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_block_context(uuid) TO anon, authenticated, service_role;