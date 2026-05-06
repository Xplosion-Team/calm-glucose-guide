import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "en" ? "es" : "en")}
      className="gap-1.5 text-muted-foreground hover:text-foreground rounded-full px-3"
      aria-label={t("lang.switch")}
    >
      <Globe className="w-5 h-5" aria-hidden="true" />
      <span className="text-sm font-medium">{t("lang.switch")}</span>
    </Button>
  );
}
