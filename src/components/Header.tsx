import { Leaf, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/i18n/I18nProvider";

interface HeaderProps {
  greeting: string;
}

export function Header({ greeting }: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className="flex items-center justify-between pb-6" data-no-read>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Leaf className="w-7 h-7 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{t("header.subtitle")}</p>
          <h1 className="text-2xl font-bold text-foreground truncate">{greeting}</h1>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <LanguageToggle />
        <ReadAloudButton />
        <Button
          variant="ghost"
          size="icon"
          className="w-12 h-12 rounded-full hover:bg-secondary"
          aria-label="Notifications"
        >
          <Bell className="w-6 h-6" />
        </Button>
      </div>
    </header>
  );
}
