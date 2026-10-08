ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS persona_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS persona_name text,
  ADD COLUMN IF NOT EXISTS voice_style text NOT NULL DEFAULT 'calm';

ALTER TABLE public.notification_prefs
  ADD CONSTRAINT notification_prefs_persona_type_check
    CHECK (persona_type IN ('standard', 'comedian', 'celebrity', 'custom')),
  ADD CONSTRAINT notification_prefs_persona_name_check
    CHECK (persona_name IS NULL OR char_length(btrim(persona_name)) BETWEEN 1 AND 80),
  ADD CONSTRAINT notification_prefs_voice_style_check
    CHECK (voice_style IN ('encouraging', 'witty', 'direct', 'calm'));

COMMENT ON COLUMN public.notification_prefs.persona_type IS 'Member-selected nudge persona category.';
COMMENT ON COLUMN public.notification_prefs.persona_name IS 'Optional named inspiration for reminder style; never represented as the sender.';
COMMENT ON COLUMN public.notification_prefs.voice_style IS 'Member-selected delivery tone for reminders.';