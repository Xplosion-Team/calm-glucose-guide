CREATE OR REPLACE FUNCTION public.handle_new_user_engagement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_engagement (user_id, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NULLIF(NEW.raw_user_meta_data->>'phone', ''))
  )
  ON CONFLICT (user_id) DO UPDATE
    SET phone = COALESCE(public.user_engagement.phone, EXCLUDED.phone);
  RETURN NEW;
END;
$function$;