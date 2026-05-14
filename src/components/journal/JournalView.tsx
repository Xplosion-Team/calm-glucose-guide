import { useMemo, useState } from "react";
import { Apple, Coffee, Pill, Camera, Type as TypeIcon, Mic, MessageSquare, Pencil, Trash2, Search, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFoodLogs, type FoodLog, type Source, type EntryType } from "@/hooks/useFoodLogs";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const entryIcon = (type: EntryType) =>
  type === "food" ? Apple : type === "drink" ? Coffee : Pill;

const sourceIcon = (s: Source) => {
  switch (s) {
    case "photo": return Camera;
    case "text": return TypeIcon;
    case "voice": return Mic;
    case "sms": return MessageSquare;
    default: return Pencil;
  }
};

const colorFor = (type: EntryType) => {
  switch (type) {
    case "food": return "text-status-rising bg-status-rising-bg";
    case "drink": return "text-primary bg-primary/10";
    case "med": return "text-status-stable bg-status-stable-bg";
  }
};

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function fmtDay(d: string, lang: string) {
  const date = new Date(d + "T00:00:00");
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d === today.toISOString().slice(0, 10)) return lang === "es" ? "Hoy" : "Today";
  if (d === yest.toISOString().slice(0, 10)) return lang === "es" ? "Ayer" : "Yesterday";
  return date.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function JournalView() {
  const { t, lang } = useI18n();
  const { logs, loading, deleteLog } = useFoodLogs();
  const [query, setQuery] = useState("");
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const filtered = useMemo(
    () => logs.filter((l) => !query.trim() || l.label.toLowerCase().includes(query.toLowerCase())),
    [logs, query],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, FoodLog[]>();
    for (const l of filtered) {
      const k = dayKey(l.logged_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return Array.from(m.entries()); // already sorted desc by logged_at
  }, [filtered]);

  // Last 7 day chips
  const dayChips = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, []);

  const visible = activeDay
    ? grouped.filter(([d]) => d === activeDay)
    : grouped;

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <div className="text-center py-2">
        <h2 className="text-2xl font-semibold text-foreground mb-1">{t("journal.title")}</h2>
        <p className="text-base text-muted-foreground">{t("journal.subtitle")}</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("journal.searchPlaceholder")}
          className="pl-9 h-12 rounded-xl text-base"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveDay(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border",
            activeDay === null ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
          )}
        >
          {t("journal.allDays")}
        </button>
        {dayChips.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDay(d)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border",
              activeDay === d ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
            )}
          >
            {fmtDay(d, lang)}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground text-center py-4">{t("journal.loading")}</p>}

      {!loading && visible.length === 0 && (
        <div className="text-center py-10">
          <CalendarIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">{t("journal.empty")}</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map(([day, items]) => {
          const totalCarbs = items.reduce((s, i) => s + (i.carbs_grams ?? 0), 0);
          return (
            <div key={day} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-base font-semibold text-foreground">{fmtDay(day, lang)}</p>
                <p className="text-sm text-muted-foreground">
                  {items.length} {items.length === 1 ? t("journal.entry") : t("journal.entries")}
                  {totalCarbs > 0 && <> · ~{totalCarbs}g</>}
                </p>
              </div>
              {items.map((entry) => {
                const Icon = entryIcon(entry.type);
                const SrcIcon = sourceIcon(entry.source);
                return (
                  <Card key={entry.id} className="glass-card border-0">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", colorFor(entry.type))}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{entry.label}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <SrcIcon className="w-3.5 h-3.5" />
                          <span>{new Date(entry.logged_at).toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour: "numeric", minute: "2-digit" })}</span>
                          {entry.carbs_grams != null && <span className="text-primary font-medium">~{entry.carbs_grams}g</span>}
                          {entry.portion_size && <span className="capitalize">{entry.portion_size}</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground"
                        onClick={() => deleteLog(entry.id)}
                        aria-label={t("journal.delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
