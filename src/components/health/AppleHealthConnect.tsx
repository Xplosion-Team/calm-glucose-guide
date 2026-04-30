import { Heart, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHealthKit } from "@/hooks/useHealthKit";

interface AppleHealthConnectProps {
  variant?: "compact" | "card";
}

export function AppleHealthConnect({ variant = "compact" }: AppleHealthConnectProps) {
  const { availability, isConnected, isLoading, connect, provider } = useHealthKit();

  const isNative = provider?.name === "AppleHealth";

  if (isLoading && !availability) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        <span>Checking Apple Health…</span>
      </div>
    );
  }

  // Web preview / non-iOS
  if (availability && !availability.available) {
    if (variant === "compact") {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
          <span>Apple Health: iPhone app only</span>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border-2 border-dashed border-muted p-5 text-center">
        <Heart className="w-8 h-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
        <p className="font-medium text-foreground mb-1">
          Apple Health is only available on iPhone
        </p>
        <p className="text-sm text-muted-foreground">
          Open the app on your iPhone to connect your Apple Health data.
          You're seeing demo numbers right now so you can explore.
        </p>
      </div>
    );
  }

  // Native + connected
  if (isConnected && isNative) {
    return (
      <div className="flex items-center gap-2 text-primary">
        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
        <span className="font-medium">Apple Health connected</span>
      </div>
    );
  }

  // Native + not yet connected
  return (
    <div className={variant === "card" ? "rounded-2xl border-2 border-primary/20 bg-primary/5 p-5" : ""}>
      {variant === "card" && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-6 h-6 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-lg text-foreground">Connect Apple Health</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            We'll read your blood glucose, steps, heart rate, weight, and sleep
            so your guide can stay up to date. Your data stays on your device
            unless you choose to share it.
          </p>
        </>
      )}
      <Button onClick={connect} className="gap-2 touch-target" disabled={isLoading}>
        <Heart className="w-5 h-5" aria-hidden="true" />
        {isLoading ? "Connecting…" : "Connect Apple Health"}
      </Button>
    </div>
  );
}
