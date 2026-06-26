import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, Activity, Calendar, TrendingUp } from "lucide-react";

interface SharedProgressResponse {
  scope: string;
  sharedFor: string | null;
  ownerName: string | null;
  windowDays: number;
  stats: {
    avgGlucose: number | null;
    timeInRangePct: number | null;
    daysTracked: number;
    totalReadings: number;
    totalLogs: number;
  };
  t1pal: { status: string; lastSyncAt: string | null } | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function SharedProgressPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/shared-progress?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load");
        setData(json);
      } catch (e: any) {
        setError(e?.message ?? "Unable to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-background p-6 flex items-start justify-center">
      <div className="w-full max-w-xl space-y-5 mt-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            Read-only access
          </div>
          <h1 className="text-2xl font-semibold">Calm Glucose progress</h1>
          {data?.ownerName && (
            <p className="text-muted-foreground">
              Shared by {data.ownerName}
              {data.sharedFor ? ` with ${data.sharedFor}` : ""}
            </p>
          )}
        </div>

        {loading && (
          <Card className="border-0">
            <CardContent className="p-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading progress…
            </CardContent>
          </Card>
        )}

        {error && !loading && (
          <Card className="border-destructive/30">
            <CardContent className="p-6 text-center space-y-2">
              <p className="font-medium text-destructive">{error}</p>
              <p className="text-sm text-muted-foreground">
                This link may be revoked or expired. Please ask the person who shared it for a new one.
              </p>
            </CardContent>
          </Card>
        )}

        {data && !loading && !error && (
          <>
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="text-base">Last {data.windowDays} days</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Stat
                  icon={<Activity className="w-4 h-4" />}
                  label="Avg glucose"
                  value={data.stats.avgGlucose != null ? `${data.stats.avgGlucose} mg/dL` : "—"}
                />
                <Stat
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Time in range"
                  value={data.stats.timeInRangePct != null ? `${data.stats.timeInRangePct}%` : "—"}
                />
                <Stat
                  icon={<Calendar className="w-4 h-4" />}
                  label="Days tracked"
                  value={`${data.stats.daysTracked}`}
                />
                <Stat
                  icon={<Activity className="w-4 h-4" />}
                  label="Entries logged"
                  value={`${data.stats.totalLogs}`}
                />
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground px-4">
              You are viewing progress only. You cannot make changes, log entries, or see other parts of this account.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card/60 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
