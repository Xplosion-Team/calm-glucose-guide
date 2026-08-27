import { useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, AlertTriangle, Check, RefreshCw, MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { useSmsEvents, type SmsEvent } from "@/hooks/useSmsEvents";

type Filter = "all" | "inbound" | "outbound" | "problems";

function fmtTime(iso: string, lang: string) {
  return new Date(iso).toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLabel(iso: string, lang: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return lang === "es" ? "Hoy" : "Today";
  return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function statusText(event: SmsEvent, lang: string) {
  const es = lang === "es";
  switch (event.status) {
    case "sent":
      return es ? "Enviado" : "Sent";
    case "failed":
      return es ? "No se pudo enviar" : "Didn't send";
    case "received":
      return es ? "Recibido" : "Received";
    case "unmatched":
      return es ? "Número no reconocido" : "Number not recognized";
    case "ignored":
      return es ? "No se pudo leer" : "Couldn't be read";
    default:
      return event.status;
  }
}

function EventRow({ event, lang }: { event: SmsEvent; lang: string }) {
  const inbound = event.direction === "inbound";
  const problem = ["failed", "unmatched", "ignored"].includes(event.status);
  const Icon = problem ? AlertTriangle : inbound ? ArrowDownLeft : ArrowUpRight;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              problem
                ? "bg-destructive/10 text-destructive"
                : inbound
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-medium text-foreground">
                {inbound
                  ? (lang === "es" ? "De ti" : "From you")
                  : (lang === "es" ? "Para ti" : "To you")}
              </span>
              <span className="text-base text-muted-foreground">
                {fmtTime(event.occurred_at, lang)}
              </span>
              <Badge
                variant={problem ? "destructive" : "secondary"}
                className="gap-1"
              >
                {!problem && <Check className="w-3.5 h-3.5" />}
                {statusText(event, lang)}
              </Badge>
            </div>

            <p className="text-lg text-foreground break-words">"{event.body}"</p>

            {event.purpose && (
              <p className="text-base text-muted-foreground">{event.purpose}</p>
            )}
            {event.outcome && (
              <p className="text-base text-foreground/80">→ {event.outcome}</p>
            )}
            {event.error_message && (
              <p className="text-base text-destructive break-words">{event.error_message}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Plain record of every text sent, received, and what it turned into. */
export function SmsActivityLog() {
  const { lang } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const { events, loading, refresh } = useSmsEvents(14);

  const filtered = useMemo(() => {
    if (filter === "problems") {
      return events.filter((e) => ["failed", "unmatched", "ignored"].includes(e.status));
    }
    if (filter === "all") return events;
    return events.filter((e) => e.direction === filter);
  }, [events, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, SmsEvent[]>();
    for (const e of filtered) {
      const key = new Date(e.occurred_at).toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: lang === "es" ? "Todo" : "All" },
    { id: "inbound", label: lang === "es" ? "Recibidos" : "Received" },
    { id: "outbound", label: lang === "es" ? "Enviados" : "Sent" },
    { id: "problems", label: lang === "es" ? "Problemas" : "Problems" },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <div className="text-center py-2">
        <h2 className="text-2xl font-semibold text-foreground mb-1">
          {lang === "es" ? "Registro de mensajes" : "Message log"}
        </h2>
        <p className="text-lg text-muted-foreground">
          {lang === "es"
            ? "Cada mensaje enviado y recibido en los últimos 14 días."
            : "Every text sent and received over the last 14 days."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {filters.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-lg text-muted-foreground text-center py-8">
          {lang === "es" ? "Cargando…" : "Loading…"}
        </p>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-lg text-foreground">
              {lang === "es" ? "No hay mensajes todavía." : "No messages yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, items]) => (
            <div key={day} className="space-y-3">
              <p className="text-lg font-medium text-foreground">
                {dayLabel(items[0].occurred_at, lang)}
              </p>
              {items.map((e) => (
                <EventRow key={e.id} event={e} lang={lang} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={refresh}>
          <RefreshCw className="w-4 h-4" /> {lang === "es" ? "Actualizar" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
