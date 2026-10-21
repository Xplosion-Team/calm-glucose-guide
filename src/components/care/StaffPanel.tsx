import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RefreshCw, Search } from "lucide-react";
import { CareChat } from "./CareChat";
import { MemberDashboard } from "./MemberDashboard";
import { cn } from "@/lib/utils";

interface Member {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  last_seen_at: string | null;
  last_meal_at: string | null;
  last_reading_at: string | null;
  last_message_at: string | null;
  unread: number;
}

function ago(ts: string | null) {
  if (!ts) return "never";
  const min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 2) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} days ago`;
}

type Filter = "all" | "online" | "unread" | "quiet";

/** Care team view: every member, their activity, and chat. */
export function StaffPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Member | null>(null);
  const [view, setView] = useState<"chat" | "dashboard">("chat");

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_members_overview");
    setMembers((data as Member[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 60000);
    const ch = supabase.channel("care-staff")
      .on("postgres_changes", { event: "*", schema: "public", table: "care_messages" }, () => void load())
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [load]);

  const isOnline = (m: Member) => !!m.last_seen_at && Date.now() - new Date(m.last_seen_at).getTime() < 15 * 60000;

  const shown = useMemo(() => members.filter((m) => {
    const s = `${m.name ?? ""} ${m.email ?? ""} ${m.phone ?? ""}`.toLowerCase();
    if (q && !s.includes(q.toLowerCase())) return false;
    if (filter === "online") return isOnline(m);
    if (filter === "unread") return Number(m.unread) > 0;
    if (filter === "quiet") return !m.last_meal_at || Date.now() - new Date(m.last_meal_at).getTime() > 3 * 86400000;
    return true;
  }), [members, q, filter]);

  const counts = {
    all: members.length,
    online: members.filter(isOnline).length,
    unread: members.filter((m) => Number(m.unread) > 0).length,
    quiet: members.filter((m) => !m.last_meal_at || Date.now() - new Date(m.last_meal_at).getTime() > 3 * 86400000).length,
  };
  const labels: Record<Filter, string> = { all: "All", online: "Online now", unread: "New messages", quiet: "No meals 3+ days" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">Activity and messages from your members</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="gap-1">
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone" className="pl-9 h-12 text-base" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(labels) as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-2xl p-3 text-left transition-colors border",
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/50 border-transparent")}>
            <p className="text-2xl font-semibold leading-tight">{counts[f]}</p>
            <p className="text-sm opacity-80">{labels[f]}</p>
          </button>
        ))}
      </div>

      {loading ? <Skeleton className="h-48 w-full" /> : (
        <Card className="divide-y">
          {shown.length === 0 && <p className="p-5 text-muted-foreground">No members match.</p>}
          {shown.map((m) => (
            <button key={m.user_id} onClick={() => setOpen(m)} className="w-full p-4 text-left flex items-center gap-3 hover:bg-secondary/40">
              <span className={cn("w-3 h-3 rounded-full shrink-0", isOnline(m) ? "bg-primary" : "bg-muted")} aria-label={isOnline(m) ? "Online" : "Offline"} />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{m.name ?? "Unnamed member"}</p>
                <p className="text-sm text-muted-foreground">
                  Seen {ago(m.last_seen_at)} · Meal {ago(m.last_meal_at)} · Reading {ago(m.last_reading_at)}
                </p>
              </div>
              {Number(m.unread) > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-sm px-2 py-0.5">{m.unread}</span>
              )}
            </button>
          ))}
        </Card>
      )}

      <Sheet open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); void load(); } }}>
        <SheetContent side="bottom" className="h-[85dvh] flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="text-2xl">{open?.name ?? "Member"}</SheetTitle>
            <p className="text-sm text-muted-foreground text-left">
              {[open?.email, open?.phone].filter(Boolean).join(" · ")} · Seen {ago(open?.last_seen_at ?? null)}
            </p>
          </SheetHeader>
          {open && (
            <div className="flex-1 min-h-0 mt-2 flex flex-col">
              <div className="grid grid-cols-2 gap-2 pb-2">
                {(["chat", "dashboard"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={cn("rounded-xl py-2.5 text-lg font-medium border",
                      view === v ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/50 border-transparent")}>
                    {v === "chat" ? "Chat" : "Dashboard"}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0">
                {view === "chat" ? <CareChat memberId={open.user_id} asStaff /> : <MemberDashboard memberId={open.user_id} />}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
