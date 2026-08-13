import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";

/**
 * User-configurable controls for the two proactive features:
 *  - post-meal spike reminders (on/off + sensitivity + quiet hours)
 *  - daily insight delivery hour
 */
export function NotificationPrefsCard() {
  const { prefs, save, loaded } = useNotificationPrefs();
  if (!loaded) return null;

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card>
      <CardContent className="p-4 space-y-5">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" aria-hidden />
          <h3 className="text-base font-semibold text-foreground">Coaching reminders</h3>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1 pr-3">
            <Label className="text-sm font-medium">Spike reminders</Label>
            <p className="text-xs text-muted-foreground">Nudge me if my glucose rises quickly and I haven't logged a meal.</p>
          </div>
          <Switch checked={prefs.spike_enabled} onCheckedChange={(v) => save({ spike_enabled: v })} />
        </div>

        {prefs.spike_enabled && (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Sensitivity</Label>
              <RadioGroup
                value={prefs.spike_sensitivity}
                onValueChange={(v) => save({ spike_sensitivity: v as "low" | "medium" | "high" })}
                className="grid grid-cols-3 gap-2"
              >
                {(["low", "medium", "high"] as const).map((v) => (
                  <Label key={v} className="border rounded-xl p-3 cursor-pointer flex items-center gap-2 capitalize [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                    <RadioGroupItem value={v} /> {v}
                  </Label>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Low = only large rises. High = catch more, but with more nudges.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Quiet from</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                  value={prefs.quiet_start_hour ?? ""}
                  onChange={(e) => save({ quiet_start_hour: e.target.value === "" ? null : Number(e.target.value) })}
                >
                  <option value="">Off</option>
                  {HOURS.map((h) => (<option key={h} value={h}>{h}:00</option>))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Quiet until</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                  value={prefs.quiet_end_hour ?? ""}
                  onChange={(e) => save({ quiet_end_hour: e.target.value === "" ? null : Number(e.target.value) })}
                >
                  <option value="">Off</option>
                  {HOURS.map((h) => (<option key={h} value={h}>{h}:00</option>))}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="pt-3 border-t space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-3">
              <Label className="text-sm font-medium">After-meal check-in</Label>
              <p className="text-xs text-muted-foreground">
                Ask how I'm doing a little while after I log a meal or drink.
              </p>
            </div>
            <Switch
              checked={prefs.post_meal_enabled}
              onCheckedChange={(v) => save({ post_meal_enabled: v })}
            />
          </div>

          {prefs.post_meal_enabled && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Remind me after</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                  value={prefs.post_meal_delay_min}
                  onChange={(e) => save({ post_meal_delay_min: Number(e.target.value) })}
                >
                  {[30, 60, 90, 120, 150, 180].map((m) => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1 pr-3">
                  <Label className="text-sm font-medium">Also text me</Label>
                  <p className="text-xs text-muted-foreground">
                    Send the check-in as a text message so it reaches you outside the app.
                  </p>
                </div>
                <Switch
                  checked={prefs.post_meal_sms_enabled}
                  onCheckedChange={(v) => save({ post_meal_sms_enabled: v })}
                />
              </div>

              {prefs.post_meal_sms_enabled && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Text message service</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                    value={prefs.sms_provider}
                    onChange={(e) =>
                      save({ sms_provider: e.target.value as "twilio" | "ringcentral" })
                    }
                  >
                    <option value="twilio">Twilio</option>
                    <option value="ringcentral">RingCentral</option>
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        <div className="pt-3 border-t space-y-3">

          <div className="flex items-center justify-between">
            <div className="flex-1 pr-3">
              <Label className="text-sm font-medium">Daily insight</Label>
              <p className="text-xs text-muted-foreground">A morning summary of yesterday's glucose, meals, and coaching.</p>
            </div>
            <Switch checked={prefs.daily_insight_enabled} onCheckedChange={(v) => save({ daily_insight_enabled: v })} />
          </div>
          {prefs.daily_insight_enabled && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Deliver at (your local hour)</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                value={prefs.daily_insight_hour}
                onChange={(e) => save({ daily_insight_hour: Number(e.target.value) })}
              >
                {HOURS.map((h) => (<option key={h} value={h}>{h}:00</option>))}
              </select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
