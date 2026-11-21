-- Trigger functions are never called directly; keep them off the public API surface.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
