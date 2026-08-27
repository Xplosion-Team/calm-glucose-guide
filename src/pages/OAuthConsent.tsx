import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

// Supabase's OAuth namespace is still beta and isn't in the generated types.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("This link is missing its authorization details.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Keep the full consent URL so signing in brings them right back here.
        const next = window.location.pathname + window.location.search;
        window.location.href = `/auth?next=${encodeURIComponent(next)}`;
        return;
      }
      const { data, error: detailsError } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error: decisionError } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("We couldn't complete the connection. Please try again.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "that app";

  return (
    <main className="min-h-dvh flex items-center justify-center p-5 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>

          {error ? (
            <>
              <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
              <p className="text-lg text-muted-foreground">{error}</p>
              <p className="text-base text-muted-foreground">
                You can close this window and try connecting again.
              </p>
            </>
          ) : !details ? (
            <p className="text-lg text-muted-foreground">Loading…</p>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-foreground">
                Connect {clientName} to your account
              </h1>
              <p className="text-lg text-muted-foreground">
                This lets {clientName} read and add to your Calm Glucose journal, glucose summaries,
                medications, and insights — acting as you. You can disconnect it at any time.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button size="lg" className="text-lg" disabled={busy} onClick={() => decide(true)}>
                  Approve
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  Deny
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
