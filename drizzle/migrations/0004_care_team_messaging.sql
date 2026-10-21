ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','clinician'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

CREATE TABLE public.care_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('member','staff')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_messages_member_idx ON public.care_messages(member_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.care_messages TO authenticated;
GRANT ALL ON public.care_messages TO service_role;
ALTER TABLE public.care_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own thread" ON public.care_messages FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Members write own thread" ON public.care_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND (
    (sender_role = 'member' AND member_id = auth.uid())
    OR (sender_role = 'staff' AND public.is_staff(auth.uid()))
  ));
CREATE POLICY "Mark messages read" ON public.care_messages FOR UPDATE TO authenticated
  USING (member_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (member_id = auth.uid() OR public.is_staff(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.care_messages;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_seen_at = now() WHERE user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_members_overview()
RETURNS TABLE(user_id uuid, name text, email text, phone text, last_seen_at timestamptz,
  last_meal_at timestamptz, last_reading_at timestamptz, last_message_at timestamptz, unread bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT u.id,
    COALESCE(p.display_name, u.raw_user_meta_data->>'full_name', u.email, u.phone)::text,
    u.email::text,
    COALESCE(e.phone, u.phone)::text,
    GREATEST(p.last_seen_at, u.last_sign_in_at),
    (SELECT max(f.logged_at) FROM public.food_logs f WHERE f.user_id = u.id),
    (SELECT max(c.ts) FROM public.cgm_readings c WHERE c.user_id = u.id),
    (SELECT max(m.created_at) FROM public.care_messages m WHERE m.member_id = u.id),
    (SELECT count(*) FROM public.care_messages m WHERE m.member_id = u.id AND m.sender_role = 'member' AND m.read_at IS NULL)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_engagement e ON e.user_id = u.id
  ORDER BY GREATEST(p.last_seen_at, u.last_sign_in_at) DESC NULLS LAST;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_members_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_members_overview() TO authenticated;