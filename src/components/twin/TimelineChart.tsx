import { useState } from "react";
import { LineChart, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { predictTimeline, type TimelinePoint } from "@/lib/digital-twin-api";

interface TimelineChartProps {
  currentGlucose: number;
}

export function TimelineChart({ currentGlucose }: TimelineChartProps) {
  const [carbs, setCarbs] = useState("50");
  const [offset, setOffset] = useState("30");
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelinePoint[] | null>(null);
  const [summary, setSummary] = useState<{ peak_glucose: number; peak_at_minute: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await predictTimeline({
        current_glucose: currentGlucose,
        carbs: Number(carbs),
        meal_time_offset: Number(offset),
        digital_twin_id: 1,
      });
      setTimeline(res.timeline);
      setSummary(res.summary);
    } catch (e: any) {
      setError(e.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <TrendingUp className="w-5 h-5" />
        <h3 className="font-semibold text-lg">Predict Meal Impact</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        See how a meal might affect your glucose over the next 2 hours.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="carbs">Carbs (g)</Label>
          <Input id="carbs" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="offset">Meal in (min)</Label>
          <Input id="offset" type="number" value={offset} onChange={(e) => setOffset(e.target.value)} />
        </div>
      </div>

      <Button onClick={handlePredict} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LineChart className="w-4 h-4" />}
        Predict Timeline
      </Button>

      {timeline && (
        <Card>
          <CardContent className="pt-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLine data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="minute"
                    label={{ value: "Minutes", position: "insideBottom", offset: -5 }}
                    className="text-xs"
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    label={{ value: "mg/dL", angle: -90, position: "insideLeft" }}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)} mg/dL`, "Glucose"]}
                    labelFormatter={(label) => `${label} min`}
                  />
                  <ReferenceLine y={180} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label="High" />
                  <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label="Low" />
                  <Line
                    type="monotone"
                    dataKey="glucose"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </RechartsLine>
              </ResponsiveContainer>
            </div>

            {summary && (
              <div className="mt-3 flex justify-center gap-6 text-sm text-muted-foreground">
                <span>
                  Peak: <strong className="text-foreground">{summary.peak_glucose.toFixed(0)} mg/dL</strong>
                </span>
                <span>
                  At: <strong className="text-foreground">{summary.peak_at_minute} min</strong>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
