import { UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { MealInput } from "@/types/simulation";

interface MealSelectorProps {
  value: MealInput | null;
  onChange: (meal: MealInput | null) => void;
}

const mealPresets = [
  { id: "light", label: "Light meal", description: "Salad, soup, or small snack", portionSize: "small" as const, carbLevel: "low" as const },
  { id: "balanced", label: "Balanced meal", description: "Protein, veggies, small portion of carbs", portionSize: "medium" as const, carbLevel: "moderate" as const },
  { id: "hearty", label: "Hearty meal", description: "Rice, pasta, bread, or comfort food", portionSize: "large" as const, carbLevel: "high" as const },
];

export function MealSelector({ value, onChange }: MealSelectorProps) {
  const selectedId = value 
    ? mealPresets.find(p => p.carbLevel === value.carbLevel && p.portionSize === value.portionSize)?.id || ""
    : "";

  return (
    <Card className="border-2 border-muted">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">What are you eating?</h3>
            <p className="text-muted-foreground">Choose the closest match</p>
          </div>
        </div>

        <RadioGroup
          value={selectedId}
          onValueChange={(id) => {
            if (id === selectedId) {
              onChange(null);
            } else {
              const preset = mealPresets.find(p => p.id === id);
              if (preset) {
                onChange({
                  description: preset.label,
                  portionSize: preset.portionSize,
                  carbLevel: preset.carbLevel
                });
              }
            }
          }}
          className="space-y-3"
        >
          {mealPresets.map((preset) => (
            <div key={preset.id} className="flex items-center">
              <RadioGroupItem 
                value={preset.id} 
                id={preset.id}
                className="w-6 h-6"
              />
              <Label 
                htmlFor={preset.id} 
                className="flex-1 ml-4 cursor-pointer p-4 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className="text-lg font-medium block">{preset.label}</span>
                <span className="text-muted-foreground">{preset.description}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
