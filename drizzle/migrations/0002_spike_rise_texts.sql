ALTER TABLE public.spike_events
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'in_app' CHECK (kind IN ('in_app','post_meal','unlogged')),
  ADD COLUMN IF NOT EXISTS rise_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('queued','sent','answered','no_meal','cancelled','expired','digest')),
  ADD COLUMN IF NOT EXISTS sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS digest_date date,
  ADD COLUMN IF NOT EXISTS pending_log_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS spike_events_user_rise_uniq ON public.spike_events (user_id, rise_start_at) WHERE rise_start_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS spike_events_status_idx ON public.spike_events (status, user_id) WHERE status IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_rise_text_stats(_days integer DEFAULT 30)
RETURNS TABLE(user_id uuid, texted bigint, answered bigint, no_meal bigint, meals_saved bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select s.user_id,
    count(*) filter (where s.sms_sent_at is not null),
    count(*) filter (where s.status in ('answered','no_meal')),
    count(*) filter (where s.status = 'no_meal'),
    count(*) filter (where p.status = 'confirmed')
  from public.spike_events s
  left join public.sms_pending_logs p on p.id = s.pending_log_id
  where s.kind = 'unlogged' and s.created_at >= now() - make_interval(days => greatest(_days,1))
    and public.has_role(auth.uid(), 'admin')
  group by s.user_id
$$;
REVOKE EXECUTE ON FUNCTION public.admin_rise_text_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rise_text_stats(integer) TO authenticated;