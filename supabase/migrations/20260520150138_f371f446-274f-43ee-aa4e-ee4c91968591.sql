-- Nightscout: isolated, additive integration tables.

CREATE TABLE public.nightscout_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  base_url text NOT NULL,
  api_secret_hash text,
  access_token text,
  enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nightscout_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nightscout_conn select own"
  ON public.nightscout_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "nightscout_conn insert own"
  ON public.nightscout_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nightscout_conn update own"
  ON public.nightscout_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "nightscout_conn delete own"
  ON public.nightscout_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_nightscout_connections_updated_at
  BEFORE UPDATE ON public.nightscout_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nightscout_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  entries_fetched integer NOT NULL DEFAULT 0,
  entries_inserted integer NOT NULL DEFAULT 0,
  error_message text
);

ALTER TABLE public.nightscout_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nightscout_log select own"
  ON public.nightscout_sync_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_nightscout_sync_log_user_started
  ON public.nightscout_sync_log(user_id, started_at DESC);
