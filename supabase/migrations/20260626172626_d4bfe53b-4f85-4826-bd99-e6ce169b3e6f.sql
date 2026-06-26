
CREATE TABLE public.circle_people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT,
  role TEXT,
  organization TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_greens_health BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_people TO authenticated;
GRANT ALL ON public.circle_people TO service_role;

ALTER TABLE public.circle_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own circle people"
  ON public.circle_people FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_circle_people_user ON public.circle_people(user_id, created_at DESC);

CREATE TRIGGER update_circle_people_updated_at
  BEFORE UPDATE ON public.circle_people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
