ALTER TABLE public.food_logs
  ADD COLUMN IF NOT EXISTS protein_g numeric,
  ADD COLUMN IF NOT EXISTS fat_g numeric,
  ADD COLUMN IF NOT EXISTS fiber_g numeric,
  ADD COLUMN IF NOT EXISTS sugar_g numeric,
  ADD COLUMN IF NOT EXISTS calories numeric;