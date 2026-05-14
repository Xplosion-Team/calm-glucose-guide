import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";
import small from "@/assets/portions/small.jpg";
import medium from "@/assets/portions/medium.jpg";
import large from "@/assets/portions/large.jpg";
import { useI18n } from "@/i18n/I18nProvider";

interface Props {
  trigger?: React.ReactNode;
}

export function PortionGuide({ trigger }: Props) {
  const { t } = useI18n();
  const items = [
    { img: small, key: "small" as const, label: t("today.portionSmall"), hint: t("portion.smallHint") },
    { img: medium, key: "medium" as const, label: t("today.portionMedium"), hint: t("portion.mediumHint") },
    { img: large, key: "large" as const, label: t("today.portionLarge"), hint: t("portion.largeHint") },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <HelpCircle className="w-4 h-4" />
            {t("portion.guideButton")}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("portion.guideTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 mt-2">
          {items.map((it) => (
            <div key={it.key} className="flex gap-3 items-center bg-muted/40 rounded-2xl p-3">
              <img
                src={it.img}
                alt={it.label}
                width={96}
                height={96}
                loading="lazy"
                className="w-24 h-24 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{it.label}</p>
                <p className="text-sm text-muted-foreground leading-snug">{it.hint}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t("today.carbsDisclaimer")}</p>
      </DialogContent>
    </Dialog>
  );
}
