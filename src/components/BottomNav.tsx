import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "journey" | "twin" | "health" | "explore";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

interface BottomNavProps {
  tabs: TabDef[];
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

export function BottomNav({ tabs, activeTab, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t z-50"
      aria-label="Primary"
    >
      <div className="container max-w-3xl mx-auto px-1">
        <div
          className="flex sm:justify-between"
          role="tablist"
        >
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                data-tour={`tab-${id}`}
                onClick={() => onChange(id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "w-6 h-6 transition-transform",
                    isActive && "stroke-[2.5] scale-110"
                  )}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap">{label}</span>
                <span
                  className={cn(
                    "h-0.5 w-6 rounded-full transition-colors",
                    isActive ? "bg-primary" : "bg-transparent"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
