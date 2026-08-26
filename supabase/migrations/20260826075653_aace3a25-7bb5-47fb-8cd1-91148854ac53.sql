DROP FUNCTION IF EXISTS public.get_public_block_context(uuid);

CREATE FUNCTION public.get_public_block_context(_block_id uuid)
RETURNS TABLE (
  block_type text,
  chart_id integer,
  row_limit integer,
  dataset_id integer,
  adhoc_metrics jsonb,
  adhoc_groupby jsonb,
  adhoc_filters jsonb,
  adhoc_order_desc boolean,
  base_url text,
  service_username text,
  auth_provider text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.block_type, b.chart_id, b.row_limit,
         b.dataset_id, b.adhoc_metrics, b.adhoc_groupby, b.adhoc_filters, b.adhoc_order_desc,
         c.base_url, c.service_username, c.auth_provider
  FROM public.report_blocks b
  JOIN public.reports r ON r.id = b.report_id
  JOIN public.superset_connections c ON c.id = r.connection_id
  WHERE b.id = _block_id
    AND r.is_published = true
    AND (b.chart_id IS NOT NULL OR b.dataset_id IS NOT NULL)
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_block_context(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_block_context(uuid) TO service_role;