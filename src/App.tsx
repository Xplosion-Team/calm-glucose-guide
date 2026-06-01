import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/I18nProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DexcomCallback from "./pages/DexcomCallback";
import NotFound from "./pages/NotFound";
import { NIGHTSCOUT_ENABLED, NIGHTSCOUT_SETTINGS_PATH } from "./integrations/nightscout/featureFlag";
import NightscoutSettingsPage from "./components/settings/nightscout/NightscoutSettingsPage";
import { T1PAL_ENABLED, T1PAL_SETTINGS_PATH } from "./integrations/t1pal/featureFlag";
import T1PalSettingsPage from "./components/settings/t1pal/T1PalSettingsPage";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dexcom/callback" element={<DexcomCallback />} />
            {NIGHTSCOUT_ENABLED && (
              <Route path={NIGHTSCOUT_SETTINGS_PATH} element={<NightscoutSettingsPage />} />
            )}
            {T1PAL_ENABLED && (
              <Route path={T1PAL_SETTINGS_PATH} element={<T1PalSettingsPage />} />
            )}

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
