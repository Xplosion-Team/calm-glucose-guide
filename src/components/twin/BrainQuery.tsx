import { useState } from "react";
import { Send, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { queryBrain } from "@/lib/digital-twin-api";

interface BrainQueryProps {
  currentGlucose: number;
}

export function BrainQuery({ currentGlucose }: BrainQueryProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await queryBrain({
        text: question,
        current_glucose: currentGlucose,
        digital_twin_id: 1,
      });
      setAnswer(res.explanation || JSON.stringify(res));
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Brain className="w-5 h-5" />
        <h3 className="font-semibold text-lg">Ask Your Digital Twin</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Ask a question about food, activity, or your glucose — your twin will reason about it.
      </p>

      <div className="flex gap-2">
        <Input
          placeholder="e.g. What if I eat 50g of carbs?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={handleAsk} disabled={loading || !question.trim()} size="icon">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {answer && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{answer}</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
