import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { GlucoseDisplay } from "@/components/GlucoseDisplay";
import { MessageCard } from "@/components/MessageCard";
import { SuggestionCard } from "@/components/SuggestionCard";
import { TimeInfo } from "@/components/TimeInfo";
import { PredictionPreview } from "@/components/PredictionPreview";
import { WhatIfSimulator } from "@/components/simulation/WhatIfSimulator";
import { useGlucoseData } from "@/hooks/useGlucoseData";
import { getGreeting } from "@/lib/glucose-interpreter";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { data, isLoading, refresh } = useGlucoseData();
  
  if (isLoading || !data) {
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
  
  // Determine trend for simulation
  const trend: "rising" | "falling" | "stable" = 
    currentGlucose > data.previousGlucose + 5 ? "rising" :
    currentGlucose < data.previousGlucose - 5 ? "falling" : "stable";
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="animate-fade-in">
          <Header greeting={greeting} />
        </div>
        
        {/* Tabs */}
        <Tabs defaultValue="now" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 h-14 text-lg">
            <TabsTrigger value="now" className="text-lg py-3">Right Now</TabsTrigger>
            <TabsTrigger value="whatif" className="text-lg py-3">What If...?</TabsTrigger>
          </TabsList>
          
          {/* Current Status Tab */}
          <TabsContent value="now" className="mt-6">
            {/* Main glucose display */}
            <div className="flex flex-col items-center py-8 animate-fade-in-delay-1">
              <GlucoseDisplay
                value={currentGlucose}
                state={interpretation.state}
                urgency={interpretation.urgency}
              />
              
              {/* Predictions */}
              <div className="w-full mt-6">
                <PredictionPreview
                  current={currentGlucose}
                  predicted30={predictedGlucose30min}
                  predicted60={predictedGlucose60min}
                />
              </div>
              
              {/* Time info */}
              <div className="mt-4">
                <TimeInfo
                  timestamp={timestamp}
                  recentMeal={recentMeal}
                  recentActivity={recentActivity}
                />
              </div>
            </div>
            
            {/* Message card */}
            <div className="space-y-4 animate-fade-in-delay-2">
              <MessageCard message={interpretation.message} />
              
              {/* Suggestion card (only if there's a suggestion) */}
              {interpretation.suggestion && (
                <div className="animate-fade-in-delay-3">
                  <SuggestionCard suggestion={interpretation.suggestion} />
                </div>
              )}
            </div>
            
            {/* Refresh button */}
            <div className="flex justify-center mt-8 animate-fade-in-delay-3">
              <Button
                variant="outline"
                onClick={refresh}
                className="touch-target gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Check again
              </Button>
            </div>
          </TabsContent>
          
          {/* What-If Simulator Tab */}
          <TabsContent value="whatif" className="mt-6">
            <WhatIfSimulator
              currentGlucose={currentGlucose}
              trend={trend}
              predicted60min={predictedGlucose60min}
            />
          </TabsContent>
        </Tabs>
        
        {/* Safety footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground animate-fade-in-delay-3">
          <p className="max-w-xs mx-auto leading-relaxed">
            This is your health companion, not medical advice.
            Always talk to your care team about concerns.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
