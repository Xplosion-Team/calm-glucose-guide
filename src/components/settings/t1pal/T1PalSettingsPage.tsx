import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Activity, CheckCircle2, AlertCircle, RefreshCcw, Unplug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { t1palProvider } from "@/providers/t1pal/provider";
import type { T1PalConnection } from "@/integrations/t1pal/client";

export function T1PalConnectSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [conn, setConn] = useState<T1PalConnection | null>(null);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");

  const refresh = async () => {
    setLoading(true);
    const c = await t1palProvider.getConnection();
    setConn(c);
    if (c) setUrl(c.t1pal_url);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleTest = async () => {
    setBusy(true);
    const r = await t1palProvider.validate({ t1pal_url: url, access_token: token || undefined });
    setBusy(false);
    if (r.ok) {
      toast({ title: "Connection looks good", description: "We reached your T1Pal site." });
    } else {
      toast({ title: "Couldn't reach T1Pal", description: r.error, variant: "destructive" });
    }
  };

  const handleConnect = async () => {
    setBusy(true);
    const test = await t1palProvider.validate({ t1pal_url: url, access_token: token || undefined });
    if (!test.ok) {
      setBusy(false);
      toast({ title: "Couldn't connect", description: test.error, variant: "destructive" });
      return;
    }
    const saved = await t1palProvider.connect({ t1pal_url: url, access_token: token || undefined });
    if (!saved.ok) {
      setBusy(false);
      toast({ title: "Couldn't save", description: saved.error, variant: "destructive" });
      return;
    }
    await t1palProvider.sync();
    setToken("");
    await refresh();
    setBusy(false);
    toast({ title: "T1Pal connected", description: "Readings will sync automatically." });
  };

  const handleSync = async () => {
    setBusy(true);
    const r = await t1palProvider.sync();
    setBusy(false);
    if (r.ok) {
      toast({ title: "Synced", description: `Brought in ${r.inserted ?? 0} new reading${r.inserted === 1 ? "" : "s"}.` });
      await refresh();
    } else {
      toast({ title: "Sync failed", description: r.error, variant: "destructive" });
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    const r = await t1palProvider.disconnect();
    setBusy(false);
    if (r.ok) {
      setConn(null);
      setUrl("");
      toast({ title: "Disconnected", description: "T1Pal is no longer linked." });
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
          <CardTitle className="text-xl">Connect T1Pal</CardTitle>
        </div>
        <CardDescription className="text-base leading-relaxed">
          Sync glucose readings from your T1Pal account.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {conn ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-accent/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="w-5 h-5 text-primary" aria-hidden="true" />
                <span className="font-semibold capitalize">{conn.status}</span>
              </div>
              <p className="text-sm text-muted-foreground break-all">{conn.t1pal_url}</p>
              {conn.last_sync_at ? (
                <p className="text-sm text-muted-foreground">
                  Last sync: {new Date(conn.last_sync_at).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No syncs yet.</p>
              )}
              {conn.last_successful_reading_at && (
                <p className="text-sm text-muted-foreground">
                  Last CGM sync: {new Date(conn.last_successful_reading_at).toLocaleString()}
                </p>
              )}
              {conn.last_insulin_sync_at && (
                <p className="text-sm text-muted-foreground">
                  Last insulin sync: {new Date(conn.last_insulin_sync_at).toLocaleString()}
                </p>
              )}
              {conn.last_meal_sync_at && (
                <p className="text-sm text-muted-foreground">
                  Last meal sync: {new Date(conn.last_meal_sync_at).toLocaleString()}
                </p>
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
              <Button variant="outline" onClick={handleDisconnect} disabled={busy} className="touch-target">
                <Unplug className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t1pal-url" className="text-base">T1Pal site URL</Label>
              <Input
                id="t1pal-url"
                placeholder="https://yourname.t1pal.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-12 text-base"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t1pal-token" className="text-base">
                Access token <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="t1pal-token"
                placeholder="If your T1Pal site requires one"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="h-12 text-base"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
              <Button variant="outline" onClick={handleTest} disabled={busy || !url} className="touch-target">
                Test connection
              </Button>
              <Button onClick={handleConnect} disabled={busy || !url} className="touch-target">
                Connect
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground border-t pt-3 leading-relaxed">
          Calm Glucose stores your T1Pal details privately and only uses them to read your glucose entries.
          You can disconnect at any time.
        </p>
      </CardContent>
    </Card>
  );
}

export default function T1PalSettingsPage() {
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
        <h1 className="text-2xl font-semibold text-foreground mb-1">Connect CGM</h1>
        <p className="text-base text-muted-foreground mb-6">
          Link a T1Pal-hosted Nightscout site to sync your readings.
        </p>
        <T1PalConnectSection />
      </div>
    </div>
  );
}
