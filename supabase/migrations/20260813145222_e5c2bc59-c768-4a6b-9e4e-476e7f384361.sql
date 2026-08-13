ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS post_meal_trigger text NOT NULL DEFAULT 'auto';

ALTER TABLE public.notification_prefs
  DROP CONSTRAINT IF EXISTS notification_prefs_post_meal_trigger_check;

ALTER TABLE public.notification_prefs
  ADD CONSTRAINT notification_prefs_post_meal_trigger_check
  CHECK (post_meal_trigger IN ('auto','time','spike'));

ALTER TABLE public.meal_reminders
  ADD COLUMN IF NOT EXISTS trigger_reason text;