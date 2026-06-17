import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import Admin from "./pages/Admin";
import QAPage from "./pages/QAPage";
import AdminCorpus from "./pages/AdminCorpus";
import AEOPage from "./pages/AEOPage";
import "./styles/brand.css";

const queryClient = new QueryClient();

const WhyNoResponsesPage = () => <AEOPage slug="why-no-responses-after-100-applications" />;
const GhostJobsAEOPage = () => <AEOPage slug="ghost-jobs" />;
const GlossaryPage = () => <AEOPage slug="glossary" />;
const MidCareerPage = () => <AEOPage slug="for/mid-career-professionals" />;
const SeniorEngineersPage = () => <AEOPage slug="for/senior-engineers" />;
const CareerChangersPage = () => <AEOPage slug="for/career-changers" />;
const VsAutoApplyPage = () => <AEOPage slug="job-genie-vs-auto-apply" />;

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/corpus" component={AdminCorpus} />
      <Route path="/qa/:slug" component={QAPage} />
      {/* AEO pillar pages — must be before /:slug wildcard */}
      <Route path="/why-no-responses-after-100-applications" component={WhyNoResponsesPage} />
      <Route path="/ghost-jobs" component={GhostJobsAEOPage} />
      <Route path="/glossary" component={GlossaryPage} />
      <Route path="/for/mid-career-professionals" component={MidCareerPage} />
      <Route path="/for/senior-engineers" component={SeniorEngineersPage} />
      <Route path="/for/career-changers" component={CareerChangersPage} />
      <Route path="/job-genie-vs-auto-apply" component={VsAutoApplyPage} />
      {/* Legacy landing page variants */}
      <Route path="/:slug" component={LandingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
