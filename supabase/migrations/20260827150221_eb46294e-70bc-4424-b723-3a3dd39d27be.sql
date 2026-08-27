CREATE TABLE public.sms_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  phone text NOT NULL,
  body text NOT NULL DEFAULT '',
  provider text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  purpose text,
  outcome text,
  related_table text,
  related_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_events_user_time ON public.sms_events (user_id, occurred_at DESC);
CREATE INDEX idx_sms_events_phone_time ON public.sms_events (phone, occurred_at DESC);

GRANT SELECT ON public.sms_events TO authenticated;
GRANT ALL ON public.sms_events TO service_role;

ALTER TABLE public.sms_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own SMS events"
ON public.sms_events FOR SELECT TO authenticated
USING (auth.uid() = user_id);