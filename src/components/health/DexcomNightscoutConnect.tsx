import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t1palProvider } from "@/providers/t1pal/provider";
import { T1PAL_SETTINGS_PATH } from "@/integrations/t1pal/featureFlag";

export function DexcomNightscoutConnect() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void t1palProvider
      .getConnection()
      .then((c) => mounted && setConnected(!!c))
      .catch(() => mounted && setConnected(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (connected) {
    return (
      <Link
        to={T1PAL_SETTINGS_PATH}
        className="flex items-center gap-2 text-primary font-medium"
      >
        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
        <span>T1Pal connected</span>
      </Link>
    );
  }

  return (
    <Button asChild className="gap-2 touch-target">
      <Link to={T1PAL_SETTINGS_PATH}>
        <Activity className="w-5 h-5" aria-hidden="true" />
        Connect T1Pal
      </Link>
    </Button>
  );
}
