import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const DexcomCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const exchangeCode = async () => {
      const code = searchParams.get("code");
      if (!code) {
        setStatus("error");
        setErrorMsg("No authorization code received from Dexcom.");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus("error");
          setErrorMsg("You need to be logged in to connect Dexcom.");
          return;
        }

        const redirectUri = `${window.location.origin}/dexcom/callback`;

        const { data, error } = await supabase.functions.invoke("dexcom-auth", {
          body: { code, redirect_uri: redirectUri },
          headers: { "Content-Type": "application/json" },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setStatus("success");
        setTimeout(() => navigate("/"), 2000);
      } catch (err: any) {
        console.error("Dexcom callback error:", err);
        setStatus("error");
        setErrorMsg(err.message || "Something went wrong connecting to Dexcom.");
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
            <p className="text-xl text-foreground">Connecting your Dexcom account…</p>
            <p className="text-muted-foreground">This will only take a moment.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-16 h-16 mx-auto text-primary" />
            <p className="text-xl text-foreground">Dexcom connected!</p>
            <p className="text-muted-foreground">Taking you back to your dashboard…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-destructive" />
            <p className="text-xl text-foreground">Connection failed</p>
            <p className="text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => navigate("/")}
              className="mt-4 text-primary underline text-lg"
            >
              Go back home
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DexcomCallback;
