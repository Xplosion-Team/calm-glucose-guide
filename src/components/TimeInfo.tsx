import { Clock, Utensils, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeInfoProps {
  timestamp: Date;
  recentMeal: boolean;
  recentActivity: boolean;
}

export function TimeInfo({ timestamp, recentMeal, recentActivity }: TimeInfoProps) {
  const timeString = timestamp.toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  return (
    <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5" />
        <span className="text-base">Updated {timeString}</span>
      </div>
      
      {recentMeal && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          "bg-status-rising-bg text-status-rising"
        )}>
          <Utensils className="w-4 h-4" />
          <span className="text-sm font-medium">After meal</span>
        </div>
      )}
      
      {recentActivity && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          "bg-status-stable-bg text-status-stable"
        )}>
          <Activity className="w-4 h-4" />
          <span className="text-sm font-medium">Active</span>
        </div>
      )}
    </div>
  );
}
