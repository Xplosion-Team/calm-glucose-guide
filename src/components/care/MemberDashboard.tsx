import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Dashboard {
  latest_reading: { ts: string; mg_dl: number; trend: string | null } | null;
  readings_24h: { ts: string; mg_dl: number }[];
  today_carbs: number;
  today_meals: number;
  recent_meals: { label: string; carbs: number | null; type: string; logged_at: string }[];
  recent_rises: { detected_at: string; rise: number; response: string | null; status: string | null }[];
  recent_texts: { direction: string; body: string; status: string; purpose: string | null; occurred_at: string }[];
  medications: { name: string; dose: number | null; unit: string | null }[];
}

function when(ts: string) {
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Staff-only snapshot of one member: readings, meals, rises, texts, meds. */
export function MemberDashboard({ memberId }: { memberId: string }) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc("admin_member_dashboard", { _member: memberId }).then(({ data, error: err }) => {
      if (!active) return;
      if (err) setError("Couldn't load this member's dashboard.");
      else setD(data as Dashboard);
    });
    return () => { active = false; };
  }, [memberId]);

  if (error) return <p className="p-4 text-muted-foreground">{error}</p>;
  if (!d) return <Skeleton className="h-64 w-full" />;

  const pts = d.readings_24h;
  const min = Math.min(...pts.map((p) => p.mg_dl), 60);
  const max = Math.max(...pts.map((p) => p.mg_dl), 180);
  const W = 600; const H = 160; const PAD = 8;
  const line = pts.length > 1
    ? pts.map((p, i) => {
        const x = PAD + (i / (pts.length - 1)) * (W - 2 * PAD);
        const y = H - PAD - ((p.mg_dl - min) / (max - min || 1)) * (H - 2 * PAD);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ")
    : null;

  return (
    <div className="space-y-4 overflow-y-auto p-1">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-2xl font-semibold">{d.latest_reading ? Math.round(d.latest_reading.mg_dl) : "—"}</p>
          <p className="text-sm text-muted-foreground">Latest reading{d.latest_reading ? ` · ${when(d.latest_reading.ts)}` : ""}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-semibold">{d.today_meals}</p>
          <p className="text-sm text-muted-foreground">Meals today</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-semibold">~{Math.round(d.today_carbs)}g</p>
          <p className="text-sm text-muted-foreground">Carbs today</p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="font-medium mb-2">Last 24 hours</p>
        {line ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Glucose readings, last 24 hours">
            <path d={line} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" />
          </svg>
        ) : (
          <p className="text-muted-foreground">No readings in the last 24 hours.</p>
        )}
      </Card>

      <Card className="p-4">
        <p className="font-medium mb-2">Recent meals</p>
        {d.recent_meals.length === 0 && <p className="text-muted-foreground">No meals logged yet.</p>}
        <ul className="space-y-1">
          {d.recent_meals.map((m, i) => (
            <li key={i} className="text-base flex justify-between gap-2">
              <span className="truncate">{m.label}</span>
              <span className="text-muted-foreground shrink-0">{m.carbs != null ? `~${m.carbs}g · ` : ""}{when(m.logged_at)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <p className="font-medium mb-2">Recent rises</p>
        {d.recent_rises.length === 0 && <p className="text-muted-foreground">No rises recorded.</p>}
        <ul className="space-y-1">
          {d.recent_rises.map((r, i) => (
            <li key={i} className="text-base flex justify-between gap-2">
              <span>+{Math.round(r.rise)} {r.response === "no" ? "· member said no meal" : ""}</span>
              <span className="text-muted-foreground shrink-0">{when(r.detected_at)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <p className="font-medium mb-2">Recent texts</p>
        {d.recent_texts.length === 0 && <p className="text-muted-foreground">No texts yet.</p>}
        <ul className="space-y-2">
          {d.recent_texts.map((t, i) => (
            <li key={i} className="text-base">
              <span className="text-muted-foreground">{t.direction === "inbound" ? "From member" : "To member"} · {when(t.occurred_at)}{t.status === "failed" ? " · failed" : ""}</span>
              <p className="truncate">{t.body}</p>
            </li>
          ))}
        </ul>
      </Card>

      {d.medications.length > 0 && (
        <Card className="p-4">
          <p className="font-medium mb-2">Medications</p>
          <ul className="space-y-1">
            {d.medications.map((m, i) => (
              <li key={i} className="text-base">{m.name}{m.dose != null ? ` · ${m.dose}${m.unit ?? ""}` : ""}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
