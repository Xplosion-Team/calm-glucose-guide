ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS post_meal_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS post_meal_delay_min integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS post_meal_sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_provider text NOT NULL DEFAULT 'twilio';

ALTER TABLE public.notification_prefs
  ADD CONSTRAINT notification_prefs_sms_provider_check
  CHECK (sms_provider IN ('twilio','ringcentral'));

CREATE TABLE IF NOT EXISTS public.meal_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  food_log_id uuid NOT NULL REFERENCES public.food_logs(id) ON DELETE CASCADE,
  meal_label text NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sms_sent_at timestamptz,
  sms_provider text,
  seen_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_reminders_due_idx ON public.meal_reminders (status, due_at);
CREATE INDEX IF NOT EXISTS meal_reminders_user_idx ON public.meal_reminders (user_id, due_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS meal_reminders_food_log_uidx ON public.meal_reminders (food_log_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_reminders TO authenticated;
GRANT ALL ON public.meal_reminders TO service_role;

ALTER TABLE public.meal_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own meal reminders"
  ON public.meal_reminders FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.schedule_meal_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled boolean;
  v_delay integer;
BEGIN
  IF NEW.type NOT IN ('food','drink') THEN
    RETURN NEW;
  END IF;

  SELECT post_meal_enabled, post_meal_delay_min
    INTO v_enabled, v_delay
  FROM public.notification_prefs
  WHERE user_id = NEW.user_id;

  v_enabled := COALESCE(v_enabled, true);
  v_delay := COALESCE(v_delay, 120);

  IF NOT v_enabled THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.meal_reminders (user_id, food_log_id, meal_label, due_at)
  VALUES (NEW.user_id, NEW.id, NEW.label, NEW.logged_at + make_interval(mins => v_delay))
  ON CONFLICT (food_log_id) DO UPDATE
    SET meal_label = EXCLUDED.meal_label,
        due_at = EXCLUDED.due_at,
        status = CASE WHEN public.meal_reminders.status = 'pending' THEN 'pending' ELSE public.meal_reminders.status END;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.schedule_meal_reminder() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_schedule_meal_reminder ON public.food_logs;
CREATE TRIGGER trg_schedule_meal_reminder
AFTER INSERT ON public.food_logs
FOR EACH ROW EXECUTE FUNCTION public.schedule_meal_reminder();

DROP TRIGGER IF EXISTS trg_reschedule_meal_reminder ON public.food_logs;
CREATE TRIGGER trg_reschedule_meal_reminder
AFTER UPDATE OF logged_at, label, type ON public.food_logs
FOR EACH ROW EXECUTE FUNCTION public.schedule_meal_reminder();