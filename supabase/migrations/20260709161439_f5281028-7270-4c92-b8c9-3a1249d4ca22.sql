
-- Add favorite + research columns to food_logs (backward compatible)
ALTER TABLE public.food_logs
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_food_logs_user_favorite ON public.food_logs(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_food_logs_user_label ON public.food_logs(user_id, label);

-- meal_responses table: automatic CGM analysis per food log
CREATE TABLE IF NOT EXISTS public.meal_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  food_log_id uuid NOT NULL REFERENCES public.food_logs(id) ON DELETE CASCADE,
  baseline_mg_dl numeric,
  peak_mg_dl numeric,
  glucose_rise numeric,
  time_to_peak_min integer,
  recovery_time_min integer,
  avg_mg_dl numeric,
  auc numeric,
  time_above_range_min integer,
  meal_score integer,
  readings_count integer,
  status text NOT NULL DEFAULT 'pending',
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_responses_food_log_unique UNIQUE (food_log_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_responses TO authenticated;
GRANT ALL ON public.meal_responses TO service_role;

ALTER TABLE public.meal_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_responses_owner_all" ON public.meal_responses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_meal_responses_user_time ON public.meal_responses(user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_responses_food_log ON public.meal_responses(food_log_id);

CREATE TRIGGER trg_meal_responses_updated
  BEFORE UPDATE ON public.meal_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
