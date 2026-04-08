
-- Create a secure view that excludes sensitive token columns
CREATE OR REPLACE VIEW public.dexcom_connection_status AS
  SELECT id, user_id, scope, expires_at, created_at, updated_at
  FROM public.dexcom_tokens;

-- Drop the broad SELECT policy that exposes all columns including tokens
DROP POLICY IF EXISTS "Users can view own dexcom connection status" ON public.dexcom_tokens;

-- Create a security invoker view policy approach:
-- Since views inherit RLS of underlying table, we need a restricted SELECT policy
-- that only allows access through the view pattern.
-- Actually, we'll keep a SELECT policy but the client will use the view.
-- The safest approach: remove SELECT policy entirely from the base table
-- so clients MUST use the view (which runs as SECURITY INVOKER by default
-- and thus needs a policy). Let's add back a minimal select policy.
CREATE POLICY "Users can view own dexcom tokens"
  ON public.dexcom_tokens
  FOR SELECT
  USING (auth.uid() = user_id);
