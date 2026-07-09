
-- Revoke default PUBLIC/anon/authenticated EXECUTE on SECURITY DEFINER trigger
-- functions. Triggers run as the table owner regardless of EXECUTE grants,
-- so these functions keep working for their intended purpose.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_engagement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_user_engagement_on_log() FROM PUBLIC, anon, authenticated;
