import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, LogOut, Activity, HelpCircle, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { GlucoseDisplay } from "@/components/GlucoseDisplay";
import { MessageCard } from "@/components/MessageCard";
import { SuggestionCard } from "@/components/SuggestionCard";
import { TimeInfo } from "@/components/TimeInfo";
import { PredictionPreview } from "@/components/PredictionPreview";
import { WhatIfSimulator } from "@/components/simulation/WhatIfSimulator";
import { DigitalTwinDashboard } from "@/components/twin/DigitalTwinDashboard";
import { DexcomConnect } from "@/components/DexcomConnect";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { useGlucoseData } from "@/hooks/useGlucoseData";
import { useOnboarding } from "@/hooks/useOnboarding";
import { getGreeting } from "@/lib/glucose-interpreter";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<"now" | "whatif" | "twin">("now");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate("/auth");
      setAuthChecked(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data, isLoading, refresh, isDexcom } = useGlucoseData();
  const {
    tourRunning, checklist, showChecklist,
    completeItem, finishTour, startTour, resetOnboarding,
  } = useOnboarding();

  // Track checklist progress based on tab visits
  useEffect(() => {
    if (activeTab === "whatif") completeItem("try_whatif");
    if (activeTab === "twin") completeItem("explore_twin");
  }, [activeTab, completeItem]);
  
  if (!authChecked || isLoading || !data) {
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
  
  const { 
    currentGlucose, 
    predictedGlucose30min, 
    predictedGlucose60min,
    recentMeal, 
    recentActivity, 
    timestamp,
    interpretation,
    userProfile 
  } = data;
  
  const greeting = getGreeting(userProfile.name);
  
  const trend: "rising" | "falling" | "stable" = 
    currentGlucose > data.previousGlucose + 5 ? "rising" :
    currentGlucose < data.previousGlucose - 5 ? "falling" : "stable";

  const tabs = [
    { id: "now" as const, label: "Now", icon: Activity },
    { id: "whatif" as const, label: "What If", icon: HelpCircle },
    { id: "twin" as const, label: "Twin", icon: Cpu },
  ];
  
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Product Tour */}
      <OnboardingTour
        run={tourRunning}
        onFinish={finishTour}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />

      {/* Onboarding Checklist — hidden while tour is active */}
      {showChecklist && !tourRunning && (
        <OnboardingChecklist
          items={checklist}
          onStartTour={startTour}
          onResetChecklist={resetOnboarding}
        />
      )}

      <div className="container max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="animate-fade-in" data-tour="header">
          <Header greeting={greeting} />
        </div>
        
        {/* Dexcom Connection & Sign Out */}
        <div className="flex items-center justify-between mt-2 mb-4 animate-fade-in" data-tour="dexcom">
          <DexcomConnect />
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/auth");
            }}
            className="gap-1 text-muted-foreground"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
        
        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === "now" && (
            <>
              <div className="flex flex-col items-center py-8 animate-fade-in-delay-1" data-tour="glucose-display">
                <GlucoseDisplay
                  value={currentGlucose}
                  state={interpretation.state}
                  urgency={interpretation.urgency}
                />
                <div className="w-full mt-6" data-tour="predictions">
                  <PredictionPreview
                    current={currentGlucose}
                    predicted30={predictedGlucose30min}
                    predicted60={predictedGlucose60min}
                  />
                </div>
                <div className="mt-4">
                  <TimeInfo
                    timestamp={timestamp}
                    recentMeal={recentMeal}
                    recentActivity={recentActivity}
                  />
                </div>
              </div>
              <div className="space-y-4 animate-fade-in-delay-2" data-tour="message-card">
                <MessageCard message={interpretation.message} />
                {interpretation.suggestion && (
                  <div className="animate-fade-in-delay-3">
                    <SuggestionCard suggestion={interpretation.suggestion} />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 mt-8 animate-fade-in-delay-3">
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${isDexcom ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {isDexcom ? '● Live Dexcom data' : '● Demo data'}
                </span>
                <Button
                  variant="outline"
                  onClick={refresh}
                  className="touch-target gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Check again
                </Button>
              </div>
            </>
          )}

          {activeTab === "whatif" && (
            <WhatIfSimulator
              currentGlucose={currentGlucose}
              trend={trend}
              predicted60min={predictedGlucose60min}
            />
          )}

          {activeTab === "twin" && (
            <DigitalTwinDashboard currentGlucose={currentGlucose} />
          )}
        </div>
        
        {/* Safety footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground animate-fade-in-delay-3">
          <p className="max-w-xs mx-auto leading-relaxed">
            This is your health companion, not medical advice.
            Always talk to your care team about concerns.
          </p>
        </footer>
      </div>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t z-50">
        <div className="container max-w-lg mx-auto flex">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-tour={`tab-${id}`}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                activeTab === id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", activeTab === id && "stroke-[2.5]")} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Index;
