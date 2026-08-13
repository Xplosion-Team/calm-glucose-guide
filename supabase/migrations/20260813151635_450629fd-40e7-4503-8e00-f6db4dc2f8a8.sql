CREATE TABLE public.sms_pending_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'food',
  label text NOT NULL,
  carbs_grams integer,
  portion_size text,
  original_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_pending_logs TO authenticated;
GRANT ALL ON public.sms_pending_logs TO service_role;

ALTER TABLE public.sms_pending_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pending sms logs"
ON public.sms_pending_logs FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_sms_pending_logs_user_status ON public.sms_pending_logs (user_id, status, created_at DESC);

CREATE TRIGGER update_sms_pending_logs_updated_at
BEFORE UPDATE ON public.sms_pending_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();