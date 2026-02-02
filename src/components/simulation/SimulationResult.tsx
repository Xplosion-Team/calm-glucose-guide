import { TrendingUp, TrendingDown, Minus, Lightbulb, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SimulationResult as SimulationResultType } from "@/types/simulation";

interface SimulationResultProps {
  result: SimulationResultType;
  currentGlucose: number;
}

function TrendGraphic({ trend }: { trend: SimulationResultType["projectedTrend"] }) {
  const getConfig = () => {
    switch (trend) {
      case "comes down":
        return { 
          icon: TrendingDown, 
          color: "text-green-600", 
          bg: "bg-green-100",
          label: "Coming down"
        };
      case "levels off":
        return { 
          icon: Minus, 
          color: "text-blue-600", 
          bg: "bg-blue-100",
          label: "Leveling off"
        };
      case "stays steady":
        return { 
          icon: Minus, 
          color: "text-sage-600", 
          bg: "bg-sage-100",
          label: "Staying steady"
        };
      case "gentler rise":
        return { 
          icon: TrendingUp, 
          color: "text-amber-600", 
          bg: "bg-amber-100",
          label: "Gentle rise"
        };
      case "steeper rise":
        return { 
          icon: TrendingUp, 
          color: "text-orange-600", 
          bg: "bg-orange-100",
          label: "Rising"
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className={`w-20 h-20 rounded-full ${config.bg} flex items-center justify-center`}>
        <Icon className={`w-10 h-10 ${config.color}`} />
      </div>
      <span className={`text-xl font-semibold ${config.color}`}>{config.label}</span>
    </div>
  );
}

function StabilityBadge({ effect }: { effect: SimulationResultType["stabilityEffect"] }) {
  const getConfig = () => {
    switch (effect) {
      case "more stable":
        return { bg: "bg-green-100", text: "text-green-700", label: "More stable" };
      case "less stable":
        return { bg: "bg-amber-100", text: "text-amber-700", label: "Less steady" };
      case "unchanged":
        return { bg: "bg-muted", text: "text-muted-foreground", label: "About the same" };
    }
  };

  const config = getConfig();

  return (
    <span className={`inline-flex px-4 py-2 rounded-full text-lg font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

export function SimulationResultDisplay({ result, currentGlucose }: SimulationResultProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main prediction card */}
      <Card className="bg-gradient-to-br from-card to-muted/30 border-2">
        <CardContent className="p-8">
          <h3 className="text-xl font-semibold text-center text-muted-foreground mb-4">
            What might happen
          </h3>
          
          <TrendGraphic trend={result.projectedTrend} />
          
          <p className="text-xl text-center leading-relaxed text-foreground mb-6">
            {result.simulationSummary}
          </p>
          
          <div className="flex justify-center">
            <StabilityBadge effect={result.stabilityEffect} />
          </div>
        </CardContent>
      </Card>

      {/* Baseline comparison */}
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-lg text-foreground mb-1">For comparison</h4>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {result.baselineComparison}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gentle tip (if available) */}
      {result.gentleTip && (
        <Card className="bg-accent/50 border-0">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-lg text-foreground mb-1">A thought</h4>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {result.gentleTip}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confidence note */}
      <p className="text-center text-muted-foreground italic px-4">
        {result.confidenceNote}
      </p>
    </div>
  );
}
