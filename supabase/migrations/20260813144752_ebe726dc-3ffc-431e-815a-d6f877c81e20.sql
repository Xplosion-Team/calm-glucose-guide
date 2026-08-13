UPDATE public.user_engagement ue
SET phone = u.phone
FROM auth.users u
WHERE u.id = ue.user_id AND ue.phone IS NULL AND u.phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.find_user_by_phone(_variants text[])
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT ue.user_id
  FROM public.user_engagement ue
  WHERE ue.phone = ANY(_variants)
  UNION
  SELECT u.id
  FROM auth.users u
  WHERE u.phone = ANY(_variants)
     OR regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') = ANY(_variants)
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.find_user_by_phone(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_phone(text[]) TO service_role;