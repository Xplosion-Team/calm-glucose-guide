import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Leaf, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash automatically
    // and emits a PASSWORD_RECOVERY event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: t("account.passwordTooShort"), variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: t("account.passwordsDontMatch"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: t("account.passwordUpdated") });
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (err: any) {
      toast({ title: err.message || t("auth.serverError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Leaf className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Greens Health</h1>
          </div>
          <p className="text-muted-foreground text-lg">{t("account.setNewPassword")}</p>
        </div>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <p className="text-muted-foreground">{t("account.setNewPasswordSubtitle")}</p>
          <div className="space-y-2">
            <Label htmlFor="new" className="text-lg">{t("account.newPassword")}</Label>
            <Input id="new" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="h-14 text-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-lg">{t("account.confirmPassword")}</Label>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required minLength={6}
              className="h-14 text-lg" />
          </div>
          <Button type="submit" className="w-full h-14 text-lg" disabled={loading || !ready}>
            {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />}
            {t("account.save")}
          </Button>
        </form>
      </div>
    </div>
  );
}
