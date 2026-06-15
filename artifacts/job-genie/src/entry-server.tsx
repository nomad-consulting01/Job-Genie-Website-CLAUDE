/**
 * SSR entry point for static pre-rendering.
 * Renders each route to an HTML string that is injected into the index.html template.
 * Used by prerender.mjs at build time — NOT loaded during normal Vite dev or client build.
 */
import { renderToString } from 'react-dom/server';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';

export function render(url: string): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  // Provide a static wouter hook so route matching works on the server
  const staticHook = (): [string, (to: string) => void] => [url, () => {}];

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter hook={staticHook}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/:slug" component={LandingPage} />
          </Switch>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
