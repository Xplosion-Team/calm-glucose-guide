import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Link2, Loader2, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const DexcomConnect = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { data } = await supabase
        .from("dexcom_connection_status" as any)
        .select("id, expires_at")
        .maybeSingle();
      setIsConnected(!!data);
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/dexcom/callback`;
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dexcom-auth?action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const result = await res.json();

      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result.error || "Could not start Dexcom authorization");
      }
    } catch (err: any) {
      toast({ title: "Connection error", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { data: tokens } = await supabase.from("dexcom_tokens").select("id");
      if (tokens && tokens.length > 0) {
        const { error } = await supabase.from("dexcom_tokens").delete().eq("id", tokens[0].id);
        if (error) throw error;
      }
      
      setIsConnected(false);
      toast({ title: "Dexcom disconnected" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Checking Dexcom…</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">Dexcom connected</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDisconnect}>
          <Unlink className="w-4 h-4 mr-1" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnect} className="gap-2 touch-target">
      <Link2 className="w-5 h-5" />
      Connect Dexcom
    </Button>
  );
};
