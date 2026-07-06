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
    <header className="flex items-center justify-between gap-2 pb-6" data-no-read>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Leaf className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{t("header.subtitle")}</p>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{greeting}</h1>
        </div>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <LanguageToggle />
        <ReadAloudButton />
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full hover:bg-secondary"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
        </Button>
      </div>

    </header>
  );
}
