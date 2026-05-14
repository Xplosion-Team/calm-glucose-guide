import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Activity,
  HelpCircle,
  TrendingUp,
  Users,
  Compass,
  Map,
  Heart,
  Sparkles,
  Apple,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { PostprandialForecast } from "@/components/twin/PostprandialForecast";
import { WhatIfExplorer } from "@/components/twin/WhatIfExplorer";
import { AppleHealthConnect } from "@/components/health/AppleHealthConnect";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { BottomNav, type TabId } from "@/components/BottomNav";
import { NowTab } from "@/components/tabs/NowTab";
import { TodayTab } from "@/components/tabs/TodayTab";
import { JourneyTab } from "@/components/tabs/JourneyTab";
import { CirclesTab } from "@/components/tabs/CirclesTab";
import { HealthTab } from "@/components/tabs/HealthTab";
import { useGlucoseData } from "@/hooks/useGlucoseData";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useI18n } from "@/i18n/I18nProvider";
import { getGreeting } from "@/lib/glucose-interpreter";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type JourneySub = "today" | "now" | "progress";
type ExploreSub = "whatif" | "twin" | "health";

interface SubNavProps<T extends string> {
  items: { id: T; label: string; icon: typeof Activity }[];
  active: T;
  onChange: (id: T) => void;
}

function SubNav<T extends string>({ items, active, onChange }: SubNavProps<T>) {
  return (
    <div
      role="tablist"
      className="flex gap-1 p-1 rounded-2xl bg-secondary/50 mb-4"
    >
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-sm font-medium rounded-xl transition-colors",
              isActive
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

const Index = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("journey");
  const [journeySub, setJourneySub] = useState<JourneySub>("today");
  const [exploreSub, setExploreSub] = useState<ExploreSub>("whatif");

  // Build translated tab arrays
  const bottomTabs = [
    { id: "journey" as TabId, label: t("nav.journey"), icon: Map },
    { id: "health" as TabId, label: t("nav.circles"), icon: Users },
    { id: "explore" as TabId, label: t("nav.explore"), icon: Compass },
  ];

  const journeySubs = [
    { id: "today" as JourneySub, label: t("journey.today"), icon: Apple },
    { id: "now" as JourneySub, label: t("journey.now"), icon: Activity },
    { id: "progress" as JourneySub, label: t("journey.progress"), icon: TrendingUp },
  ];

  const exploreSubs = [
    { id: "whatif" as ExploreSub, label: t("explore.whatif"), icon: HelpCircle },
    { id: "twin" as ExploreSub, label: t("explore.insights"), icon: Sparkles },
    { id: "health" as ExploreSub, label: t("explore.health"), icon: Heart },
  ];

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setAuthChecked(true);
      if (!session) navigate("/auth");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setAuthChecked(true);
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data, isLoading, refresh, isDexcom } = useGlucoseData();
  const {
    tourRunning,
    checklist,
    showChecklist,
    completeItem,
    finishTour,
    startTour,
    resetOnboarding,
  } = useOnboarding();

  useEffect(() => {
    if (activeTab === "journey" && journeySub === "now") completeItem("try_whatif");
    if (activeTab === "explore" && exploreSub === "twin") completeItem("explore_twin");
  }, [activeTab, journeySub, exploreSub, completeItem]);

  if (!authChecked || !hasSession || isLoading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-lg mx-auto px-4 py-8">
          <Skeleton className="h-20 w-full mb-8" />
          <div className="flex justify-center mb-8">
            <Skeleton className="h-56 w-56 rounded-full" />
          </div>
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const { currentGlucose, userProfile } = data;
  const greeting = getGreeting(userProfile.name);

  return (
    <div className="min-h-screen bg-background pb-24">
      <OnboardingTour
        run={tourRunning}
        onFinish={finishTour}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />

      {showChecklist && !tourRunning && (
        <OnboardingChecklist
          items={checklist}
          onStartTour={startTour}
          onResetChecklist={resetOnboarding}
        />
      )}

      <div className="container max-w-lg mx-auto px-4 py-6 sm:py-8" data-readable-page>
        <div className="animate-fade-in" data-tour="header">
          <Header greeting={greeting} />
        </div>

        <div
          className="flex items-center justify-between mt-2 mb-4 gap-2 animate-fade-in flex-wrap"
          data-tour="dexcom"
        >
          <AppleHealthConnect variant="compact" />
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/auth");
            }}
            className="gap-1 text-muted-foreground"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            {t("auth.signOut")}
          </Button>
        </div>

        <div className="mt-4">
          {activeTab === "journey" && (
            <>
              <SubNav<JourneySub>
                items={journeySubs}
                active={journeySub}
                onChange={setJourneySub}
              />
              {journeySub === "today" && <TodayTab />}
              {journeySub === "now" && (
                <NowTab data={data} isDexcom={isDexcom} onRefresh={refresh} />
              )}
              {journeySub === "progress" && (
                <JourneyTab currentGlucose={currentGlucose} />
              )}
            </>
          )}

          {activeTab === "health" && <CirclesTab />}

          {activeTab === "explore" && (
            <>
              <SubNav<ExploreSub>
                items={exploreSubs}
                active={exploreSub}
                onChange={setExploreSub}
              />
              {exploreSub === "whatif" && <WhatIfExplorer currentGlucose={currentGlucose} />}
              {exploreSub === "twin" && <PostprandialForecast currentGlucose={currentGlucose} />}
              {exploreSub === "health" && <HealthTab />}
            </>
          )}
        </div>

        <footer className="mt-12 text-center text-sm text-muted-foreground animate-fade-in-delay-3">
          <p className="max-w-xs mx-auto leading-relaxed">
            {t("safety.footer")}
          </p>
        </footer>
      </div>

      <BottomNav tabs={bottomTabs} activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
};

export default Index;
