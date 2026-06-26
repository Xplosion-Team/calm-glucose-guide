
CREATE TABLE public.circle_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.circle_people(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'progress_readonly',
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT circle_share_links_status_chk CHECK (status IN ('active','revoked','expired'))
);

CREATE INDEX idx_circle_share_links_person ON public.circle_share_links(person_id);
CREATE INDEX idx_circle_share_links_user ON public.circle_share_links(user_id, created_at DESC);
CREATE INDEX idx_circle_share_links_token ON public.circle_share_links(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_share_links TO authenticated;
GRANT ALL ON public.circle_share_links TO service_role;

ALTER TABLE public.circle_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own share links"
  ON public.circle_share_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_circle_share_links_updated_at
  BEFORE UPDATE ON public.circle_share_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
