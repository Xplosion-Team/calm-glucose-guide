import { useState } from "react";
import {
  MessageSquare, Check, X, Clock, Apple, Coffee, Pill, RefreshCw, ArrowDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { useSmsTimeline, type TimelineItem } from "@/hooks/useSmsTimeline";

const typeIcon = (type: string) =>
  type === "drink" ? Coffee : type === "medication" || type === "med" ? Pill : Apple;

function fmtTime(iso: string, lang: string) {
  return new Date(iso).toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  if (status === "confirmed") {
    return (
      <Badge className="gap-1 bg-status-stable-bg text-status-stable border-0">
        <Check className="w-3.5 h-3.5" /> {lang === "es" ? "Guardado" : "Saved"}
      </Badge>
    );
  }
  if (status === "discarded") {
    return (
      <Badge variant="secondary" className="gap-1">
        <X className="w-3.5 h-3.5" /> {lang === "es" ? "Descartado" : "Discarded"}
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-status-rising-bg text-status-rising border-0">
      <Clock className="w-3.5 h-3.5" /> {lang === "es" ? "Esperando respuesta" : "Awaiting reply"}
    </Badge>
  );
}

function TimelineRow({ item, lang }: { item: TimelineItem; lang: string }) {
  const { message, log } = item;
  const Icon = typeIcon(message.type);

  const details = [
    message.carbs_grams ? `~${message.carbs_grams}g ${lang === "es" ? "carbohidratos" : "carbs"}` : null,
    message.portion_size,
  ].filter(Boolean).join(" · ");

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* What they texted in */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base text-muted-foreground">
                {fmtTime(message.created_at, lang)}
              </span>
              <StatusBadge status={message.status} lang={lang} />
            </div>
            <p className="text-lg text-foreground mt-1 break-words">"{message.original_text}"</p>
          </div>
        </div>

        {/* What it was understood as */}
        <div className="flex items-center gap-2 pl-3 text-muted-foreground">
          <ArrowDown className="w-4 h-4" />
          <span className="text-base">
            {lang === "es" ? "Entendido como" : "Read as"} <span className="text-foreground">{message.label}</span>
            {details ? ` (${details})` : ""}
          </span>
        </div>

        {/* The resulting journal entry */}
        {log ? (
          <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
            <div className="w-9 h-9 rounded-full bg-status-stable-bg text-status-stable flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg text-foreground break-words">{log.label}</p>
              <p className="text-base text-muted-foreground">
                {lang === "es" ? "Añadido a tu diario a las" : "Added to your journal at"}{" "}
                {fmtTime(log.logged_at, lang)}
                {log.carbs_grams ? ` · ~${log.carbs_grams}g` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className={cn("text-base pl-3", message.status === "pending" ? "text-status-rising" : "text-muted-foreground")}>
            {message.status === "pending"
              ? (lang === "es"
                ? "Todavía no se ha guardado — responde SÍ por mensaje para añadirlo."
                : "Not saved yet — reply YES by text to add it.")
              : message.status === "discarded"
                ? (lang === "es" ? "No se añadió nada a tu diario." : "Nothing was added to your journal.")
                : (lang === "es" ? "No se encontró la entrada." : "No matching journal entry found.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Day-by-day view of every food text received and the entry it became. */
export function SmsTimeline() {
  const { lang } = useI18n();
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const { items, loading, refresh } = useSmsTimeline(day);

  const today = new Date().toISOString().slice(0, 10);
  const shift = (days: number) => {
    const d = new Date(`${day}T00:00:00`);
    d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (next <= today) setDay(next);
  };

  const label = day === today
    ? (lang === "es" ? "Hoy" : "Today")
    : new Date(`${day}T00:00:00`).toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
        weekday: "long", month: "short", day: "numeric",
      });

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <div className="text-center py-2">
        <h2 className="text-2xl font-semibold text-foreground mb-1">
          {lang === "es" ? "Mensajes de texto" : "Text messages"}
        </h2>
        <p className="text-lg text-muted-foreground">
          {lang === "es"
            ? "Todo lo que nos enviaste por mensaje y lo que se guardó."
            : "Everything you texted in, and what got saved."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => shift(-1)}>
          {lang === "es" ? "Día anterior" : "Previous day"}
        </Button>
        <span className="text-lg font-medium text-foreground">{label}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => shift(1)}
          disabled={day >= today}
        >
          {lang === "es" ? "Siguiente" : "Next day"}
        </Button>
      </div>

      {loading ? (
        <p className="text-lg text-muted-foreground text-center py-8">
          {lang === "es" ? "Cargando…" : "Loading…"}
        </p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-lg text-foreground">
              {lang === "es" ? "No hay mensajes este día." : "No text messages on this day."}
            </p>
            <p className="text-base text-muted-foreground">
              {lang === "es"
                ? "Envíanos un mensaje con lo que comiste y aparecerá aquí."
                : "Text us what you ate and it will show up here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <TimelineRow key={item.message.id} item={item} lang={lang} />
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
