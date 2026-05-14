
-- food_logs: persistent log entries
CREATE TABLE public.food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('food','drink','med')),
  label TEXT NOT NULL,
  carbs_grams INTEGER,
  portion_size TEXT CHECK (portion_size IN ('small','medium','large')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','photo','text','voice','sms')),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_food_logs_user_logged ON public.food_logs(user_id, logged_at DESC);

ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own logs" ON public.food_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own logs" ON public.food_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own logs" ON public.food_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own logs" ON public.food_logs FOR DELETE USING (auth.uid() = user_id);

-- user_engagement: trial tracking
CREATE TABLE public.user_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  trial_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_tier TEXT NOT NULL DEFAULT 'C' CHECK (trial_tier IN ('A','B','C')),
  phone TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  last_log_at TIMESTAMPTZ,
  total_meals_logged INTEGER NOT NULL DEFAULT 0,
  last_checkin_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own engagement" ON public.user_engagement FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own engagement" ON public.user_engagement FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own engagement" ON public.user_engagement FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_engagement_updated_at
BEFORE UPDATE ON public.user_engagement
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create engagement row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_engagement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_engagement (user_id, phone)
  VALUES (NEW.id, NEW.phone)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_engagement
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_engagement();

-- Trigger: keep user_engagement in sync when food_logs change
CREATE OR REPLACE FUNCTION public.bump_user_engagement_on_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_engagement (user_id, last_log_at, total_meals_logged)
  VALUES (NEW.user_id, NEW.logged_at, CASE WHEN NEW.type IN ('food','drink') THEN 1 ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE
    SET last_log_at = GREATEST(public.user_engagement.last_log_at, NEW.logged_at),
        total_meals_logged = public.user_engagement.total_meals_logged + CASE WHEN NEW.type IN ('food','drink') THEN 1 ELSE 0 END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bump_engagement_after_log
AFTER INSERT ON public.food_logs
FOR EACH ROW EXECUTE FUNCTION public.bump_user_engagement_on_log();
