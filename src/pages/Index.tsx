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
import { WhatIfSimulator } from "@/components/simulation/WhatIfSimulator";
import { DigitalTwinDashboard } from "@/components/twin/DigitalTwinDashboard";
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
import { getGreeting } from "@/lib/glucose-interpreter";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ── Sub-tab types ── */
type JourneySub = "today" | "now" | "progress";
type ExploreSub = "whatif" | "twin" | "health";

/* ── Bottom nav: 3 tabs ── */
const TOP_TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: "journey", label: "Journey", icon: Map },
  { id: "explore", label: "Explore", icon: Compass },
];

// We need "circles" in TabId – it already exists from the type union
const BOTTOM_TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: "journey", label: "Journey", icon: Map },
  { id: "health", label: "Circles", icon: Users },
  { id: "explore", label: "Explore", icon: Compass },
];

const JOURNEY_SUBS: { id: JourneySub; label: string; icon: typeof Activity }[] = [
  { id: "today", label: "Today", icon: Apple },
  { id: "now", label: "Now", icon: Activity },
  { id: "progress", label: "Progress", icon: TrendingUp },
];

const EXPLORE_SUBS: { id: ExploreSub; label: string; icon: typeof Activity }[] = [
  { id: "whatif", label: "What If", icon: HelpCircle },
  { id: "twin", label: "Insights", icon: Sparkles },
  { id: "health", label: "Health", icon: Heart },
];

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
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("journey");
  const [journeySub, setJourneySub] = useState<JourneySub>("today");
  const [exploreSub, setExploreSub] = useState<ExploreSub>("whatif");

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

  const { currentGlucose, predictedGlucose60min, userProfile } = data;
  const greeting = getGreeting(userProfile.name);

  const trend: "rising" | "falling" | "stable" =
    currentGlucose > data.previousGlucose + 5
      ? "rising"
      : currentGlucose < data.previousGlucose - 5
      ? "falling"
      : "stable";

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
            Sign out
          </Button>
        </div>

        <div className="mt-4">
          {activeTab === "journey" && (
            <>
              <SubNav<JourneySub>
                items={JOURNEY_SUBS}
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

          {/* Circles tab — reusing "health" TabId */}
          {activeTab === "health" && <CirclesTab />}

          {activeTab === "explore" && (
            <>
              <SubNav<ExploreSub>
                items={EXPLORE_SUBS}
                active={exploreSub}
                onChange={setExploreSub}
              />
              {exploreSub === "whatif" && (
                <WhatIfSimulator
                  currentGlucose={currentGlucose}
                  trend={trend}
                  predicted60min={predictedGlucose60min}
                />
              )}
              {exploreSub === "twin" && (
                <DigitalTwinDashboard currentGlucose={currentGlucose} />
              )}
              {exploreSub === "health" && <HealthTab />}
            </>
          )}
        </div>

        <footer className="mt-12 text-center text-sm text-muted-foreground animate-fade-in-delay-3">
          <p className="max-w-xs mx-auto leading-relaxed">
            This is your health companion, not medical advice.
            Always talk to your care team about concerns.
          </p>
        </footer>
      </div>

      <BottomNav tabs={BOTTOM_TABS} activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
};

export default Index;
