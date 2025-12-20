import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Onboarding from "./pages/Onboarding";
import OnboardingSuccess from "./pages/OnboardingSuccess";
import AdminDashboard from "./pages/AdminDashboard";
import IntakeDetail from "./pages/IntakeDetail";
import DeploymentStatus from "./pages/DeploymentStatus";
import Clarify from "./pages/Clarify";
import AdminAnalytics from "./pages/AdminAnalytics";
import WhatsIncluded from "./pages/WhatsIncluded";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import CustomerPreview from "./pages/CustomerPreview";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/onboarding/success" component={OnboardingSuccess} />
      <Route path="/clarify/:token" component={Clarify} />
      <Route path="/whats-included" component={WhatsIncluded} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/cancel" component={PaymentCancel} />
      <Route path="/preview/:token" component={CustomerPreview} />
      
      {/* Admin routes (protected by DashboardLayout) */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/intake/:id" component={IntakeDetail} />
      <Route path="/admin/deploy/:id" component={DeploymentStatus} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      
      {/* Fallback routes */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// LaunchBase uses a dark theme with orange accent
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
