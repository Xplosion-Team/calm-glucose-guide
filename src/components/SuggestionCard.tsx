import { Lightbulb, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SuggestionCardProps {
  suggestion: string;
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  return (
    <Card className="glass-card border-0 bg-accent/50">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lightbulb className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Gentle suggestion
            </h3>
            <p className="text-lg leading-relaxed text-foreground mb-4">
              {suggestion}
            </p>
            <Button 
              variant="ghost" 
              className="text-primary hover:text-primary hover:bg-primary/10 -ml-3 touch-target"
            >
              I'll try this
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
