import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Leaf, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      toast({ title: t("auth.invalidEmail"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Do not reveal whether an account exists; only show generic errors for network/server issues.
      if (error && /network|fetch/i.test(error.message)) {
        toast({ title: t("auth.networkError"), variant: "destructive" });
        return;
      }
      setSent(true);
    } catch {
      toast({ title: t("auth.networkError"), variant: "destructive" });
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
          <p className="text-muted-foreground text-lg">{t("auth.resetTitle")}</p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-5 text-lg leading-relaxed text-foreground">
              {t("auth.resetConfirmation")}
            </div>
            <Button asChild className="w-full h-14 text-lg">
              <Link to="/auth">
                <ArrowLeft className="w-5 h-5 mr-2" aria-hidden="true" />
                {t("auth.backToLogin")}
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5" noValidate>
            <p className="text-muted-foreground">{t("auth.resetSubtitle")}</p>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-lg">
                {t("account.email")}
              </Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-14 text-lg"
              />
            </div>
            <Button type="submit" className="w-full h-14 text-lg" disabled={loading}>
              {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />}
              {t("auth.sendResetLink")}
            </Button>
            <Button asChild variant="ghost" className="w-full h-12">
              <Link to="/auth">
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                {t("auth.backToLogin")}
              </Link>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
