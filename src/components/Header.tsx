import { Leaf, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  greeting: string;
}

export function Header({ greeting }: HeaderProps) {
  return (
    <header className="flex items-center justify-between pb-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
          <Leaf className="w-7 h-7 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Greens Health</p>
          <h1 className="text-2xl font-bold text-foreground truncate max-w-[calc(100vw-120px)]">{greeting}</h1>
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-12 h-12 rounded-full hover:bg-secondary"
      >
        <Bell className="w-6 h-6" />
        <span className="sr-only">Notifications</span>
      </Button>
    </header>
  );
}
