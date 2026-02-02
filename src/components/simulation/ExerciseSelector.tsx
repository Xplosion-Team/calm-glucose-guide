import { Footprints } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ExerciseInput } from "@/types/simulation";

interface ExerciseSelectorProps {
  value: ExerciseInput | null;
  onChange: (exercise: ExerciseInput | null) => void;
}

const exercisePresets = [
  { id: "rest", label: "Rest or sit", description: "Taking it easy", type: "resting" as const, duration: 0 },
  { id: "stand", label: "Stand up a bit", description: "Light movement around the house", type: "standing" as const, duration: 10 },
  { id: "short-walk", label: "Short walk", description: "5-10 minutes of gentle walking", type: "walking" as const, duration: 10 },
  { id: "long-walk", label: "Longer walk", description: "15-30 minutes of walking", type: "walking" as const, duration: 25 },
];

export function ExerciseSelector({ value, onChange }: ExerciseSelectorProps) {
  const selectedId = value 
    ? exercisePresets.find(p => p.type === value.type && Math.abs(p.duration - value.durationMinutes) < 10)?.id || ""
    : "";

  return (
    <Card className="border-2 border-muted">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <Footprints className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">Any movement planned?</h3>
            <p className="text-muted-foreground">Every little bit helps</p>
          </div>
        </div>

        <RadioGroup
          value={selectedId}
          onValueChange={(id) => {
            if (id === selectedId) {
              onChange(null);
            } else {
              const preset = exercisePresets.find(p => p.id === id);
              if (preset) {
                onChange({
                  type: preset.type,
                  durationMinutes: preset.duration
                });
              }
            }
          }}
          className="space-y-3"
        >
          {exercisePresets.map((preset) => (
            <div key={preset.id} className="flex items-center">
              <RadioGroupItem 
                value={preset.id} 
                id={`exercise-${preset.id}`}
                className="w-6 h-6"
              />
              <Label 
                htmlFor={`exercise-${preset.id}`} 
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
