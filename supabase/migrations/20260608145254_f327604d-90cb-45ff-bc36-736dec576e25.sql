-- Additive tables for T1Pal insulin and meal ingestion. Existing tables untouched.

CREATE TABLE IF NOT EXISTS public.insulin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ts timestamptz NOT NULL,
  insulin_units numeric NOT NULL,
  insulin_type text,
  event_type text,
  source text NOT NULL DEFAULT 't1pal',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ts, insulin_units, source)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insulin_events TO authenticated;
GRANT ALL ON public.insulin_events TO service_role;

ALTER TABLE public.insulin_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insulin events"
  ON public.insulin_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insulin events"
  ON public.insulin_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own insulin events"
  ON public.insulin_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS insulin_events_user_ts_idx
  ON public.insulin_events (user_id, ts DESC);


CREATE TABLE IF NOT EXISTS public.meal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ts timestamptz NOT NULL,
  carbohydrates numeric NOT NULL,
  event_type text,
  source text NOT NULL DEFAULT 't1pal',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ts, carbohydrates, source)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_events TO authenticated;
GRANT ALL ON public.meal_events TO service_role;

ALTER TABLE public.meal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal events"
  ON public.meal_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal events"
  ON public.meal_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal events"
  ON public.meal_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS meal_events_user_ts_idx
  ON public.meal_events (user_id, ts DESC);


-- Track last insulin/meal sync separately on the existing connection table.
ALTER TABLE public.t1pal_connections
  ADD COLUMN IF NOT EXISTS last_insulin_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_meal_sync_at timestamptz;

-- Extend ingestion log with per-dataset counts (additive).
ALTER TABLE public.t1pal_ingestion_logs
  ADD COLUMN IF NOT EXISTS insulin_fetched integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insulin_inserted integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meals_fetched integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meals_inserted integer DEFAULT 0;
