import { useEffect, useState } from "react";
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus, ChevronRight, PlusCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

interface DailyInsight {
  id: string;
  insight_date: string;
  metrics: {
    n?: number;
    avg?: number;
    tir_pct?: number;
    tar_pct?: number;
    tbr_pct?: number;
    highest?: number;
    lowest?: number;
    cv_pct?: number | null;
    estimated_a1c_gmi?: number;
  };
  narrative: string | null;
  recommendations: {
    title?: string;
    why?: string;
    expected_change_mg_dl?: number | null;
    confidence_pct?: number;
    difficulty?: string;
  }[];
  factors_used: string[];
  missed_events: { at: string; baseline: number; peak: number; rise: number }[];
  data_sufficiency: "full" | "partial" | "sparse";
}

function yesterdayStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

interface Props {
  onLogMissed?: (at: string) => void;
}

export function DailyInsightCard({ onLogMissed }: Props) {
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data } = await supabase
        .from("daily_insights")
        .select("*")
        .eq("user_id", u.user.id)
        .eq("insight_date", yesterdayStr())
        .maybeSingle();
      if (data) setInsight(data as unknown as DailyInsight);
      setLoading(false);
    })();
  }, []);

  const generate = async () => {
    setGenerating(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-daily-insights", {
        body: { mode: "mine" },
      });
      if (error) throw error;
      const ins = (data as { insight?: DailyInsight })?.insight ?? null;
      if (ins) setInsight(ins);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate yet.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading yesterday's insight…
        </CardContent>
      </Card>
    );
  }

  if (!insight) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" aria-hidden />
            <p className="font-semibold text-foreground">Your daily insight</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Generate a personalized summary of yesterday from your CGM, meals, and medications.
          </p>
          <Button onClick={generate} disabled={generating} className="w-full touch-target">
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : "Generate yesterday's insight"}
          </Button>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </CardContent>
      </Card>
    );
  }

  const m = insight.metrics ?? {};
  const trend = m.tir_pct != null ? (m.tir_pct >= 70 ? "up" : m.tir_pct >= 50 ? "flat" : "down") : "flat";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <>
      <Card className="border-primary/20 cursor-pointer hover:bg-accent/20" onClick={() => setOpen(true)}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" aria-hidden />
            <p className="font-semibold text-foreground flex-1">Yesterday's insight</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <TrendIcon className="w-4 h-4 text-primary" aria-hidden />
            <span className="text-foreground font-medium">{m.tir_pct ?? "–"}% in range</span>
            <span className="text-muted-foreground">avg {m.avg ?? "–"} mg/dL</span>
          </div>
          {insight.narrative && (
            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{insight.narrative}</p>
          )}
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Yesterday's insight
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 pt-4">
            {/* Metric grid */}
            <div className="grid grid-cols-3 gap-2">
              <Metric label="In range" value={m.tir_pct != null ? `${m.tir_pct}%` : "–"} />
              <Metric label="Above" value={m.tar_pct != null ? `${m.tar_pct}%` : "–"} />
              <Metric label="Below" value={m.tbr_pct != null ? `${m.tbr_pct}%` : "–"} />
              <Metric label="Average" value={m.avg != null ? `${m.avg}` : "–"} unit="mg/dL" />
              <Metric label="Highest" value={m.highest != null ? `${m.highest}` : "–"} unit="mg/dL" />
              <Metric label="Lowest" value={m.lowest != null ? `${m.lowest}` : "–"} unit="mg/dL" />
            </div>
            {m.estimated_a1c_gmi != null && (
              <p className="text-xs text-muted-foreground">
                Estimated A1C (GMI): <span className="text-foreground font-medium">{m.estimated_a1c_gmi}%</span>
              </p>
            )}

            {insight.narrative && (
              <div className="rounded-xl bg-accent/40 p-4 text-base leading-relaxed text-foreground">
                {insight.narrative}
              </div>
            )}

            {insight.recommendations?.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-base font-semibold">What might help today</h3>
                <ol className="space-y-2">
                  {insight.recommendations.map((r, i) => (
                    <li key={i} className="rounded-xl border p-3">
                      <p className="font-medium text-foreground">
                        {i + 1}. {r.title ?? "Try this"}
                        {typeof r.expected_change_mg_dl === "number" && (
                          <span className="text-sm text-muted-foreground font-normal">
                            {"  "}(~{r.expected_change_mg_dl > 0 ? "-" : "+"}
                            {Math.abs(r.expected_change_mg_dl)} mg/dL
                            {r.confidence_pct != null ? `, ${r.confidence_pct}% confidence` : ""})
                          </span>
                        )}
                      </p>
                      {r.why && <p className="text-sm text-muted-foreground leading-relaxed">{r.why}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {insight.missed_events?.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Possibly missed meals</h3>
                <ul className="space-y-2">
                  {insight.missed_events.slice(0, 5).map((e) => (
                    <li key={e.at} className="rounded-xl border p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          Around {new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} — glucose rose {e.rise} mg/dL (from {e.baseline} to {e.peak}).
                        </p>
                      </div>
                      {onLogMissed && (
                        <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => { onLogMissed(e.at); setOpen(false); }}>
                          <PlusCircle className="w-4 h-4" /> Add meal
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {insight.factors_used?.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold text-muted-foreground">Generated using</h3>
                <ul className="text-xs text-muted-foreground list-disc pl-5">
                  {insight.factors_used.map((f, i) => (<li key={i}>{f}</li>))}
                </ul>
              </section>
            )}

            {insight.data_sufficiency === "sparse" && (
              <p className="text-xs text-muted-foreground italic">
                We had limited data yesterday. Insights will get sharper as more CGM and food logs come in.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Estimate only — always follow your care team's guidance.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      {unit && <p className="text-xs text-muted-foreground">{unit}</p>}
    </div>
  );
}
