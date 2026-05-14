
REVOKE EXECUTE ON FUNCTION public.handle_new_user_engagement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_user_engagement_on_log() FROM PUBLIC, anon, authenticated;
