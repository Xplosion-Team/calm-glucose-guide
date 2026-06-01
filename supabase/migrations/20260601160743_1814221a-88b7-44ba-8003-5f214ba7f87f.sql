
CREATE TABLE public.t1pal_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  t1pal_url text NOT NULL,
  access_token_encrypted text,
  status text NOT NULL DEFAULT 'pending',
  last_sync_at timestamptz,
  last_successful_reading_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_t1pal_connections_user_id ON public.t1pal_connections(user_id);
CREATE INDEX idx_t1pal_connections_status ON public.t1pal_connections(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.t1pal_connections TO authenticated;
GRANT ALL ON public.t1pal_connections TO service_role;

ALTER TABLE public.t1pal_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "t1pal_conn select own" ON public.t1pal_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "t1pal_conn insert own" ON public.t1pal_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "t1pal_conn update own" ON public.t1pal_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "t1pal_conn delete own" ON public.t1pal_connections FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER t1pal_connections_set_updated_at
BEFORE UPDATE ON public.t1pal_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.t1pal_ingestion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  readings_fetched integer NOT NULL DEFAULT 0,
  readings_inserted integer NOT NULL DEFAULT 0,
  latency_ms integer,
  error_message text
);
CREATE INDEX idx_t1pal_logs_user_id ON public.t1pal_ingestion_logs(user_id);
CREATE INDEX idx_t1pal_logs_started_at ON public.t1pal_ingestion_logs(started_at DESC);

GRANT SELECT ON public.t1pal_ingestion_logs TO authenticated;
GRANT ALL ON public.t1pal_ingestion_logs TO service_role;

ALTER TABLE public.t1pal_ingestion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "t1pal_logs select own" ON public.t1pal_ingestion_logs FOR SELECT USING (auth.uid() = user_id);
