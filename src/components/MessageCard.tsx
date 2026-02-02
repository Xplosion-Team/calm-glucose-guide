import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MessageCardProps {
  message: string;
}

export function MessageCard({ message }: MessageCardProps) {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 pt-1">
            <p className="text-xl leading-relaxed text-foreground">
              {message}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
