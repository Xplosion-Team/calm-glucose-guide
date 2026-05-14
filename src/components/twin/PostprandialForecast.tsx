import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, TrendingUp, Clock, Gauge, Info } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useScreenContext } from "@/hooks/useScreenContext";

interface CurvePt { t_min: number; mg_dl: number; lo: number; hi: number }
interface PredictResult {
  prediction_id: string;
  model_version: string;
  horizon_min: number;
  peak_mg_dl: number;
  time_to_peak_min: number;
  tir_delta_pct: number;
  confidence: number;
  curve: CurvePt[];
  insight_text: string;
}

interface Props { currentGlucose: number }

export function PostprandialForecast({ currentGlucose }: Props) {
  const [label, setLabel] = useState("Lunch");
  const [carbs, setCarbs] = useState("60");
  const [fat, setFat] = useState("");
  const [protein, setProtein] = useState("");
  const [fiber, setFiber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErr(null); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("predict-meal", {
        body: {
          meal: {
            label: label.trim() || "Meal",
            carbs_g: Number(carbs) || 0,
            fat_g: fat ? Number(fat) : undefined,
            protein_g: protein ? Number(protein) : undefined,
            fiber_g: fiber ? Number(fiber) : undefined,
            source: "manual",
          },
          current_glucose_mg_dl: currentGlucose,
          horizon_min: 240,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setResult(data as PredictResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  useScreenContext(
    useMemo(
      () => ({
        screen: "Postprandial Forecast",
        status: result
          ? `Predicted peak around ${Math.round(result.peak_mg_dl)} mg/dL near ${result.time_to_peak_min} minutes.`
          : "Enter a meal and tap Predict to see the next few hours.",
        highlights: [
          "This shows the likely glucose response 2 to 4 hours after a meal.",
          "The shaded band is the uncertainty around the predicted line.",
          "Estimates only — your care team's guidance always comes first.",
        ],
        data: result ? { peak: result.peak_mg_dl, ttp: result.time_to_peak_min, confidence: result.confidence } : { currentGlucose },
        fallback: "You're on the Forecast screen. Log a meal to see the predicted glucose response for the next few hours.",
      }),
      [result, currentGlucose],
    ),
  );

  return (
    <div className="space-y-6">
      <div className="text-center py-3">
        <div className="inline-flex items-center gap-2 mb-1">
          <Sparkles className="w-6 h-6 text-primary" aria-hidden />
          <h2 className="text-2xl font-semibold text-foreground">After-meal forecast</h2>
        </div>
        <p className="text-base text-muted-foreground max-w-md mx-auto">
          A gentle look at the next 2 to 4 hours — based on your meal, recent glucose, and your personal pattern.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="meal-label">What are you eating?</Label>
            <Input id="meal-label" value={label} onChange={(e) => setLabel(e.target.value)} className="h-12 text-base" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="carbs">Carbs (g)</Label>
              <Input id="carbs" type="number" inputMode="numeric" value={carbs} onChange={(e) => setCarbs(e.target.value)} className="h-12 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fiber">Fiber (g) — optional</Label>
              <Input id="fiber" type="number" inputMode="numeric" value={fiber} onChange={(e) => setFiber(e.target.value)} className="h-12 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="protein">Protein (g) — optional</Label>
              <Input id="protein" type="number" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} className="h-12 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fat">Fat (g) — optional</Label>
              <Input id="fat" type="number" inputMode="numeric" value={fat} onChange={(e) => setFat(e.target.value)} className="h-12 text-base" />
            </div>
          </div>

          <Button onClick={run} disabled={loading} className="w-full h-12 rounded-xl text-base">
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <TrendingUp className="w-5 h-5 mr-2" />}
            {loading ? "Looking ahead…" : "Show my forecast"}
          </Button>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card className="animate-fade-in">
          <CardContent className="pt-4 space-y-4">
            <p className="text-base text-foreground leading-relaxed">{result.insight_text}</p>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-secondary/40 p-3">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><TrendingUp className="w-3.5 h-3.5" /> Peak</div>
                <div className="text-lg font-semibold text-foreground">{Math.round(result.peak_mg_dl)}</div>
                <div className="text-xs text-muted-foreground">mg/dL</div>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5" /> When</div>
                <div className="text-lg font-semibold text-foreground">~{result.time_to_peak_min}m</div>
                <div className="text-xs text-muted-foreground">after meal</div>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Gauge className="w-3.5 h-3.5" /> How sure</div>
                <div className="text-lg font-semibold text-foreground">{Math.round(result.confidence * 100)}%</div>
                <div className="text-xs text-muted-foreground">confidence</div>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={result.curve}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="t_min" tickFormatter={(v) => `${v}m`} className="text-xs" />
                  <YAxis domain={["auto", "auto"]} className="text-xs" />
                  <Tooltip
                    formatter={(v: number, name: string) => [`${Math.round(Number(v))} mg/dL`, name]}
                    labelFormatter={(l) => `${l} min after meal`}
                  />
                  <ReferenceLine y={180} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                  <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="hi"
                    stroke="none"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.12}
                    name="Upper bound"
                  />
                  <Area
                    type="monotone"
                    dataKey="lo"
                    stroke="none"
                    fill="hsl(var(--background))"
                    fillOpacity={1}
                    name="Lower bound"
                  />
                  <Line type="monotone" dataKey="mg_dl" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name="Predicted" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Estimate only, not medical advice. Always follow your care team's guidance. Model {result.model_version}.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
