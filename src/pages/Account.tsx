import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChevronRight, Mail, Lock, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export default function Account() {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate("/auth");
        return;
      }
      setEmail(data.user.email ?? "");
      setLoading(false);
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-lg mx-auto px-4 py-6 sm:py-8">
        <Button asChild variant="ghost" className="mb-4 h-12">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            {t("account.back")}
          </Link>
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-6">{t("account.title")}</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card className="rounded-2xl p-5 space-y-5">
            <div>
              <p className="text-sm text-muted-foreground">{t("account.currentEmail")}</p>
              <p className="text-lg font-medium break-all">{email}</p>
            </div>

            <div className="space-y-3">
              <Button asChild variant="outline" className="w-full h-16 justify-between text-lg rounded-xl">
                <Link to="/account/email">
                  <span className="flex items-center gap-3">
                    <Mail className="w-5 h-5" aria-hidden="true" />
                    {t("account.changeEmail")}
                  </span>
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full h-16 justify-between text-lg rounded-xl">
                <Link to="/account/password">
                  <span className="flex items-center gap-3">
                    <Lock className="w-5 h-5" aria-hidden="true" />
                    {t("account.changePassword")}
                  </span>
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
