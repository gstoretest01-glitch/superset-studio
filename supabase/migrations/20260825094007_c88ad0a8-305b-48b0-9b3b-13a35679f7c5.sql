REVOKE EXECUTE ON FUNCTION public.get_public_block_context(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_block_context(uuid) TO service_role;