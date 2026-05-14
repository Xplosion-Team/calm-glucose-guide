
-- =========================================================
-- Phase 0: T2D Clinical Trial schema
-- =========================================================

-- ---------- meal_logs ----------
CREATE TABLE public.meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL,
  carbs_g integer,
  fat_g integer,
  protein_g integer,
  fiber_g integer,
  portion_size text CHECK (portion_size IN ('small','medium','large')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','photo','text','voice','sms')),
  image_url text,
  raw_ai jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meal_logs_user_time ON public.meal_logs(user_id, logged_at DESC);
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_logs select own" ON public.meal_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meal_logs insert own" ON public.meal_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meal_logs update own" ON public.meal_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "meal_logs delete own" ON public.meal_logs
  FOR DELETE USING (auth.uid() = user_id);

-- ---------- cgm_readings ----------
CREATE TABLE public.cgm_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ts timestamptz NOT NULL,
  mg_dl numeric NOT NULL,
  trend text,
  source text NOT NULL DEFAULT 'dexcom',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ts, source)
);
CREATE INDEX idx_cgm_user_ts ON public.cgm_readings(user_id, ts DESC);
ALTER TABLE public.cgm_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cgm select own" ON public.cgm_readings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cgm insert own" ON public.cgm_readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------- predictions (append-only for patients) ----------
CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_log_id uuid NOT NULL REFERENCES public.meal_logs(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  model_version text NOT NULL,
  inputs_hash text NOT NULL,
  horizon_min integer NOT NULL DEFAULT 240,
  peak_mg_dl numeric,
  time_to_peak_min integer,
  tir_delta_pct numeric,
  confidence numeric,
  curve jsonb NOT NULL,
  insight_text text,
  inputs_snapshot jsonb NOT NULL
);
CREATE INDEX idx_predictions_user ON public.predictions(user_id, requested_at DESC);
CREATE INDEX idx_predictions_meal ON public.predictions(meal_log_id);
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "predictions select own" ON public.predictions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "predictions insert own" ON public.predictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- no UPDATE/DELETE policies → append-only

-- ---------- prediction_outcomes ----------
CREATE TABLE public.prediction_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  observed_curve jsonb NOT NULL,
  mard numeric,
  mae numeric,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outcomes_user ON public.prediction_outcomes(user_id, computed_at DESC);
ALTER TABLE public.prediction_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outcomes select own" ON public.prediction_outcomes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "outcomes insert own" ON public.prediction_outcomes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------- twin_states ----------
CREATE TABLE public.twin_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model_version text NOT NULL,
  params jsonb NOT NULL,
  fit_metrics jsonb,
  n_samples integer,
  calibrated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_twin_user ON public.twin_states(user_id, calibrated_at DESC);
ALTER TABLE public.twin_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "twin select own" ON public.twin_states
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "twin insert own" ON public.twin_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------- medications ----------
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  med_class text NOT NULL,
  name text NOT NULL,
  dose numeric,
  unit text,
  schedule_cron text,
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meds_user ON public.medications(user_id);
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meds select own" ON public.medications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meds insert own" ON public.medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meds update own" ON public.medications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "meds delete own" ON public.medications
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.medication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  dose numeric,
  source text NOT NULL DEFAULT 'manual'
);
CREATE INDEX idx_medevents_user ON public.medication_events(user_id, taken_at DESC);
ALTER TABLE public.medication_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medev select own" ON public.medication_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "medev insert own" ON public.medication_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------- trial enrollment + consent ----------
CREATE TABLE public.trial_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  trial_id text NOT NULL DEFAULT 'cg-t2d-pilot-1',
  arm text,
  status text NOT NULL DEFAULT 'screening'
    CHECK (status IN ('screening','active','withdrawn','completed')),
  consented_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trial_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enroll select own" ON public.trial_enrollments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "enroll insert own" ON public.trial_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  version text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  pdf_url text,
  signature_hash text NOT NULL
);
CREATE INDEX idx_consents_user ON public.consents(user_id, signed_at DESC);
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consents select own" ON public.consents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "consents insert own" ON public.consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- updated_at on meal_logs / medications
CREATE TRIGGER trg_meal_logs_updated
  BEFORE UPDATE ON public.meal_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
