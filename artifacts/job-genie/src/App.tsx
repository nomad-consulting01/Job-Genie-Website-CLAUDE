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
import AdminRedditAEO from "./pages/AdminRedditAEO";
import AdminLoopControl from "./pages/AdminLoopControl";
import AEOPage from "./pages/AEOPage";
import BlogIndex from "./pages/BlogIndex";
import BlogPost from "./pages/BlogPost";
import AnswerIndex from "./pages/AnswerIndex";
import AnswerPage from "./pages/AnswerPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DataDeletion from "./pages/DataDeletion";
import AutopsyPage from "./pages/AutopsyPage";
import FreeAutopsy2Page from "./pages/FreeAutopsy2Page";
import FreeAutopsy3Page from "./pages/FreeAutopsy3Page";
import FreeAutopsy4Page from "./pages/FreeAutopsy4Page";
import FreeAutopsy5Page from "./pages/FreeAutopsy5Page";
import FreeAutopsy6Page from "./pages/FreeAutopsy6Page";
import ResourcesPage from "./pages/ResourcesPage";
import MethodologyPage from "./pages/MethodologyPage";
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
      <Route path="/admin/reddit-aeo" component={AdminRedditAEO} />
      <Route path="/admin/loop-control" component={AdminLoopControl} />
      <Route path="/qa/:slug" component={QAPage} />
      {/* AEO pillar pages — must be before /:slug wildcard */}
      <Route path="/why-no-responses-after-100-applications" component={WhyNoResponsesPage} />
      <Route path="/ghost-jobs" component={GhostJobsAEOPage} />
      <Route path="/glossary" component={GlossaryPage} />
      <Route path="/for/mid-career-professionals" component={MidCareerPage} />
      <Route path="/for/senior-engineers" component={SeniorEngineersPage} />
      <Route path="/for/career-changers" component={CareerChangersPage} />
      <Route path="/job-genie-vs-auto-apply" component={VsAutoApplyPage} />
      {/* Blog — must be before /:slug wildcard */}
      <Route path="/blog" component={BlogIndex} />
      <Route path="/blog/:slug" component={BlogPost} />
      {/* GEO answer pages */}
      <Route path="/answers" component={AnswerIndex} />
      <Route path="/answers/:slug" component={AnswerPage} />
      {/* Resources hub — must be before /:slug wildcard */}
      <Route path="/resources" component={ResourcesPage} />
      <Route path="/methodology" component={MethodologyPage} />
      {/* Standalone landing pages — must be before /:slug wildcard */}
      <Route path="/free-autopsy" component={AutopsyPage} />
      <Route path="/free-autopsy2" component={FreeAutopsy2Page} />
      <Route path="/free-autopsy3" component={FreeAutopsy3Page} />
      <Route path="/free-autopsy4" component={FreeAutopsy4Page} />
      <Route path="/free-autopsy5" component={FreeAutopsy5Page} />
      <Route path="/free-autopsy6" component={FreeAutopsy6Page} />
      {/* Legal pages */}
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/data-deletion" component={DataDeletion} />
      {/* Legacy landing page variants */}
      <Route path="/:slug" component={LandingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

const CANONICAL_HOST = "www.job-genie.ai";
if (
  typeof window !== "undefined" &&
  window.location.hostname !== CANONICAL_HOST &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1" &&
  !window.location.hostname.endsWith(".replit.app") &&
  !window.location.hostname.endsWith(".replit.dev") &&
  !window.location.hostname.endsWith(".replit.co") &&
  !window.location.hostname.endsWith(".kirk.replit.dev")
) {
  window.location.replace(`https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`);
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
