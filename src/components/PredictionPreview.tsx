import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PredictionPreviewProps {
  current: number;
  predicted30: number;
  predicted60: number;
}

export function PredictionPreview({ current, predicted30, predicted60 }: PredictionPreviewProps) {
  const trend30 = predicted30 - current;
  const trend60 = predicted60 - current;
  
  const getTrendIcon = (change: number) => {
    if (change > 10) return <TrendingUp className="w-4 h-4" />;
    if (change < -10) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };
  
  const getTrendColor = (change: number) => {
    if (change > 20) return "text-status-rising";
    if (change < -20) return "text-status-low";
    return "text-status-stable";
  };
  
  return (
    <div className="flex justify-center gap-8 py-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">In 30 min</p>
        <div className={cn("flex items-center justify-center gap-1 text-xl font-semibold", getTrendColor(trend30))}>
          {getTrendIcon(trend30)}
          <span>{predicted30}</span>
        </div>
      </div>
      
      <div className="w-px bg-border" />
      
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">In 1 hour</p>
        <div className={cn("flex items-center justify-center gap-1 text-xl font-semibold", getTrendColor(trend60))}>
          {getTrendIcon(trend60)}
          <span>{predicted60}</span>
        </div>
      </div>
    </div>
  );
}
