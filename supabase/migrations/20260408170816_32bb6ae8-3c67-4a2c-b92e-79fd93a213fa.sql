-- Remove the SELECT policy that exposes raw OAuth tokens to clients
DROP POLICY IF EXISTS "Users can view own dexcom tokens" ON public.dexcom_tokens;

-- Remove the DELETE policy - disconnection should use the view or edge functions
DROP POLICY IF EXISTS "Users can delete own dexcom tokens" ON public.dexcom_tokens;
