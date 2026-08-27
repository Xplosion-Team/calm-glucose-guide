import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle2, Clock, XCircle, MessageSquare } from "lucide-react";
import { useSmsApprovalStats } from "@/hooks/useSmsApprovalStats";
import { cn } from "@/lib/utils";

const RANGES = [7, 14, 30, 90];

function Stat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof CheckCircle2;
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-secondary/50 p-4 text-center">
      <Icon className={cn("w-5 h-5 mx-auto mb-1", tone ?? "text-muted-foreground")} aria-hidden="true" />
      <p className="text-2xl font-semibold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export function AdminTab() {
  const [days, setDays] = useState(30);
  const { rows, loading, error, refresh } = useSmsApprovalStats(days);

  const totals = rows.reduce(
    (acc, r) => ({
      approved: acc.approved + Number(r.approved),
      pending: acc.pending + Number(r.pending),
      discarded: acc.discarded + Number(r.discarded),
      inbound: acc.inbound + Number(r.inbound_messages),
    }),
    { approved: 0, pending: 0, discarded: 0, inbound: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Administrator</h2>
          <p className="text-sm text-muted-foreground">Text message approvals across the trial</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} className="gap-1">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-1 p-1 rounded-2xl bg-secondary/50" role="tablist">
        {RANGES.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={days === d}
            onClick={() => setDays(d)}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-xl transition-colors",
              days === d ? "bg-background text-primary shadow-sm" : "text-muted-foreground",
            )}
          >
            {d} days
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <Card className="p-5 text-sm text-muted-foreground">
          This section is only available to administrators.
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex gap-2">
              <Stat icon={CheckCircle2} value={totals.approved} label="Approved" tone="text-primary" />
              <Stat icon={Clock} value={totals.pending} label="Awaiting reply" />
              <Stat icon={XCircle} value={totals.discarded} label="Discarded" />
              <Stat icon={MessageSquare} value={totals.inbound} label="Texts in" />
            </div>
          </Card>

          <Card className="divide-y">
            {rows.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">
                No text activity in the last {days} days.
              </p>
            )}
            {rows.map((r) => (
              <div key={r.user_id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.last_activity).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm shrink-0">
                  <span className="text-primary font-semibold">{r.approved} approved</span>
                  <span className="text-muted-foreground">{r.pending} waiting</span>
                  <span className="text-muted-foreground">{r.inbound_messages} in</span>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
