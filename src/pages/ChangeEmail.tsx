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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmail() {
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return navigate("/auth");
      setCurrentEmail(data.user.email ?? "");
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nEmail = newEmail.trim();
    const cEmail = confirmEmail.trim();
    if (!EMAIL_REGEX.test(nEmail)) {
      toast({ title: t("auth.invalidEmail"), variant: "destructive" });
      return;
    }
    if (nEmail !== cEmail) {
      toast({ title: t("account.emailsDontMatch"), variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: t("account.currentPassword"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Reauthenticate with the current password
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      });
      if (authErr) {
        toast({ title: t("account.wrongPassword"), variant: "destructive" });
        return;
      }
      const { error } = await supabase.auth.updateUser({ email: nEmail });
      if (error) throw error;
      toast({ title: t("account.emailUpdateSent") });
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
        <h1 className="text-3xl font-bold text-foreground mb-6">{t("account.changeEmail")}</h1>

        <Card className="rounded-2xl p-5">
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label className="text-lg">{t("account.currentEmail")}</Label>
              <Input value={currentEmail} readOnly className="h-14 text-lg bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email" className="text-lg">{t("account.newEmail")}</Label>
              <Input id="new-email" type="email" inputMode="email" autoComplete="email"
                value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required
                className="h-14 text-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-email" className="text-lg">{t("account.confirmEmail")}</Label>
              <Input id="confirm-email" type="email" inputMode="email"
                value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} required
                className="h-14 text-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cur-pw" className="text-lg">{t("account.currentPassword")}</Label>
              <Input id="cur-pw" type="password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} required
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
