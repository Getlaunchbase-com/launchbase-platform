import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/Header";
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
import Terms from "./pages/Terms";
import Referrals from "./pages/Referrals";
import Privacy from "./pages/Privacy";
import AdminReferrals from "./pages/AdminReferrals";
import ExpandLaunchBase from "./pages/ExpandLaunchBase";
import PostQueue from "./pages/PostQueue";
import ModuleSetup from "./pages/ModuleSetup";
import Apply from "./pages/Apply";
import ApplySuccess from "./pages/ApplySuccess";
import HowItWorks from "./pages/HowItWorks";
import Why from "./pages/Why";
import Trust from "./pages/Trust";
import AdminSuiteApplications from "./pages/AdminSuiteApplications";
import AdminDeployments from "./pages/AdminDeployments";
import ReferralAnalytics from "./pages/ReferralAnalytics";
import Integrations from "./pages/Integrations";
import FacebookConnect from "./pages/FacebookConnect";
import AdminDrafts from "./pages/AdminDrafts";
import SettingsFacebook from "./pages/SettingsFacebook";
import AdminStripeWebhooks from "./pages/AdminStripeWebhooks";

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
      <Route path="/terms" component={Terms} />
      <Route path="/referrals" component={Referrals} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/apply" component={Apply} />
      <Route path="/apply/success" component={ApplySuccess} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/why" component={Why} />
      <Route path="/trust" component={Trust} />
      
      {/* Admin routes (protected by DashboardLayout) */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/intake/:id" component={IntakeDetail} />
      <Route path="/admin/deploy/:id" component={DeploymentStatus} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      <Route path="/admin/referrals" component={AdminReferrals} />
      <Route path="/admin/suite-applications" component={AdminSuiteApplications} />
      <Route path="/admin/deployments" component={AdminDeployments} />
      <Route path="/admin/referral-analytics" component={ReferralAnalytics} />
      <Route path="/admin/expand" component={ExpandLaunchBase} />
      <Route path="/expand" component={ExpandLaunchBase} />
      <Route path="/dashboard/social/queue" component={PostQueue} />
      <Route path="/dashboard/modules" component={ModuleSetup} />
      <Route path="/expand/integrations" component={Integrations} />
      <Route path="/settings/facebook/connect" component={FacebookConnect} />
      <Route path="/admin/drafts" component={AdminDrafts} />
      <Route path="/settings/facebook" component={SettingsFacebook} />
      <Route path="/admin/stripe-webhooks" component={AdminStripeWebhooks} />
      
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
          <Header />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
