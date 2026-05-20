import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Activity, CheckCircle2, AlertCircle, RefreshCcw, Unplug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  NightscoutConnection,
  disconnectNightscout,
  getNightscoutConnection,
  saveNightscoutConnection,
  syncNightscoutNow,
  testNightscout,
} from "@/integrations/nightscout/client";

export function NightscoutConnectSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [conn, setConn] = useState<NightscoutConnection | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const refresh = async () => {
    setLoading(true);
    const c = await getNightscoutConnection();
    setConn(c);
    if (c) setBaseUrl(c.base_url);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleTest = async () => {
    setBusy(true);
    const r = await testNightscout({
      base_url: baseUrl,
      api_secret: apiSecret || undefined,
      access_token: accessToken || undefined,
    });
    setBusy(false);
    if (r.ok) {
      toast({
        title: "Connection looks good",
        description: r.latest_mg_dl
          ? `Latest reading: ${r.latest_mg_dl} mg/dL`
          : "We reached your Nightscout site.",
      });
    } else {
      toast({
        title: "Couldn't reach Nightscout",
        description: r.error ?? "Please check your URL and credentials.",
        variant: "destructive",
      });
    }
  };

  const handleConnect = async () => {
    setBusy(true);
    const test = await testNightscout({
      base_url: baseUrl,
      api_secret: apiSecret || undefined,
      access_token: accessToken || undefined,
    });
    if (!test.ok) {
      setBusy(false);
      toast({
        title: "Couldn't connect",
        description: test.error ?? "Please double-check your details.",
        variant: "destructive",
      });
      return;
    }
    const saved = await saveNightscoutConnection({
      base_url: baseUrl,
      api_secret: apiSecret || undefined,
      access_token: accessToken || undefined,
    });
    if (!saved.ok) {
      setBusy(false);
      toast({ title: "Couldn't save", description: saved.error, variant: "destructive" });
      return;
    }
    await syncNightscoutNow();
    setApiSecret("");
    setAccessToken("");
    await refresh();
    setBusy(false);
    toast({ title: "Nightscout connected", description: "We'll keep your readings in sync." });
  };

  const handleSync = async () => {
    setBusy(true);
    const r = await syncNightscoutNow();
    setBusy(false);
    if (r.ok) {
      toast({
        title: "Synced",
        description: `Brought in ${r.inserted ?? 0} new reading${r.inserted === 1 ? "" : "s"}.`,
      });
      await refresh();
    } else {
      toast({
        title: "Sync failed",
        description: r.error ?? "We couldn't reach Nightscout this time.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    const r = await disconnectNightscout();
    setBusy(false);
    if (r.ok) {
      setConn(null);
      setBaseUrl("");
      toast({ title: "Disconnected", description: "Nightscout is no longer linked." });
    } else {
      toast({ title: "Couldn't disconnect", description: r.error, variant: "destructive" });
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-xl">Connect Nightscout</CardTitle>
        </div>
        <CardDescription className="text-base leading-relaxed">
          If you already use a Nightscout site, we can gently pull your CGM readings into
          Calm Glucose. This is optional — your current setup will keep working either way.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {conn ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-accent/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="w-5 h-5 text-primary" aria-hidden="true" />
                <span className="font-semibold">Connected</span>
              </div>
              <p className="text-sm text-muted-foreground break-all">{conn.base_url}</p>
              {conn.last_sync_at ? (
                <p className="text-sm text-muted-foreground">
                  Last sync: {new Date(conn.last_sync_at).toLocaleString()} ·{" "}
                  {conn.last_sync_count} new
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No syncs yet.</p>
              )}
              {conn.last_error && (
                <p className="text-sm text-destructive flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{conn.last_error}</span>
                </p>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSync} disabled={busy} className="touch-target">
                <RefreshCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Sync now
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={busy}
                className="touch-target"
              >
                <Unplug className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ns-url" className="text-base">
                Nightscout site URL
              </Label>
              <Input
                id="ns-url"
                placeholder="https://yoursite.herokuapp.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="h-12 text-base"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ns-secret" className="text-base">
                API secret <span className="text-muted-foreground font-normal">(or token)</span>
              </Label>
              <Input
                id="ns-secret"
                type="password"
                placeholder="Your Nightscout API secret"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="h-12 text-base"
                autoComplete="off"
              />
              <p className="text-sm text-muted-foreground">
                Prefer a token? Paste it below instead.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ns-token" className="text-base">
                Access token (optional)
              </Label>
              <Input
                id="ns-token"
                placeholder="e.g. calmglucose-1a2b3c"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="h-12 text-base"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={busy || !baseUrl}
                className="touch-target"
              >
                Test connection
              </Button>
              <Button
                onClick={handleConnect}
                disabled={busy || !baseUrl || (!apiSecret && !accessToken)}
                className="touch-target"
              >
                Connect
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground border-t pt-3 leading-relaxed">
          Calm Glucose stores your credentials privately and only uses them to read your
          Nightscout entries. You can disconnect at any time.
        </p>
      </CardContent>
    </Card>
  );
}

export function NightscoutSettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-lg mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild className="gap-1.5 -ml-3">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-1">Settings</h1>
        <p className="text-base text-muted-foreground mb-6">
          Optional integrations for Calm Glucose.
        </p>
        <NightscoutConnectSection />
      </div>
    </div>
  );
}

export default NightscoutSettingsPage;
