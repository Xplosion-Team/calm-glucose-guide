CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id uuid PRIMARY KEY,
  spike_enabled boolean NOT NULL DEFAULT true,
  spike_sensitivity text NOT NULL DEFAULT 'medium' CHECK (spike_sensitivity IN ('low','medium','high')),
  quiet_start_hour smallint,
  quiet_end_hour smallint,
  daily_insight_enabled boolean NOT NULL DEFAULT true,
  daily_insight_hour smallint NOT NULL DEFAULT 8,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs all" ON public.notification_prefs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.spike_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  baseline_mg_dl numeric NOT NULL,
  peak_mg_dl numeric NOT NULL,
  rise_mg_dl numeric NOT NULL,
  window_min integer NOT NULL,
  sensitivity text NOT NULL,
  associated_food_log_id uuid REFERENCES public.food_logs(id) ON DELETE SET NULL,
  user_response text NOT NULL DEFAULT 'pending' CHECK (user_response IN ('pending','log_meal','log_drink','not_food','dismissed','auto_matched')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spike_events_user_time ON public.spike_events(user_id, detected_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spike_events TO authenticated;
GRANT ALL ON public.spike_events TO service_role;
ALTER TABLE public.spike_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spikes all" ON public.spike_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.daily_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  insight_date date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  narrative text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  factors_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  missed_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_sufficiency text NOT NULL DEFAULT 'partial',
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, insight_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_insights_user_date ON public.daily_insights(user_id, insight_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_insights TO authenticated;
GRANT ALL ON public.daily_insights TO service_role;
ALTER TABLE public.daily_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insights select" ON public.daily_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insights write" ON public.daily_insights FOR INSERT WITH CHECK (auth.uid() = user_id);