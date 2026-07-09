import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";

export default function ChangePassword() {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return navigate("/auth");
      setEmail(data.user.email ?? "");
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) {
      toast({ title: t("account.passwordTooShort"), variant: "destructive" });
      return;
    }
    if (next !== confirm) {
      toast({ title: t("account.passwordsDontMatch"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (authErr) {
        toast({ title: t("account.wrongPassword"), variant: "destructive" });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast({ title: t("account.passwordUpdated") });
      navigate("/account");
    } catch (err: any) {
      toast({ title: err.message || t("auth.serverError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-lg mx-auto px-4 py-6 sm:py-8">
        <Button asChild variant="ghost" className="mb-4 h-12">
          <Link to="/account">
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            {t("account.back")}
          </Link>
        </Button>
        <h1 className="text-3xl font-bold text-foreground mb-6">{t("account.changePassword")}</h1>

        <Card className="rounded-2xl p-5">
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="cur" className="text-lg">{t("account.currentPassword")}</Label>
              <Input id="cur" type="password" autoComplete="current-password" value={current}
                onChange={(e) => setCurrent(e.target.value)} required className="h-14 text-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new" className="text-lg">{t("account.newPassword")}</Label>
              <Input id="new" type="password" autoComplete="new-password" value={next}
                onChange={(e) => setNext(e.target.value)} required minLength={6}
                className="h-14 text-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-lg">{t("account.confirmPassword")}</Label>
              <Input id="confirm" type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required minLength={6}
                className="h-14 text-lg" />
            </div>
            <Button type="submit" className="w-full h-14 text-lg" disabled={loading}>
              {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />}
              {t("account.save")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
