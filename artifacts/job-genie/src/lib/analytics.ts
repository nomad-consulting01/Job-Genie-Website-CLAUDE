import { useEffect } from 'react';
import { getVisitorId, getSessionId } from './abtest';
import { trackEvent as trackEventApi } from '@workspace/api-client-react';

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\/|Opera/.test(ua)) return 'opera';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'safari';
  return 'other';
}

function detectTrafficSource(utmSource: string | null, referrer: string): string {
  if (utmSource) return utmSource;
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname;
    if (/google|bing|yahoo|duckduckgo/.test(host)) return 'organic';
    if (/linkedin\.com/.test(host)) return 'linkedin';
    if (/twitter|x\.com|t\.co/.test(host)) return 'twitter';
    if (/facebook|fb\.com/.test(host)) return 'facebook';
    if (/reddit\.com/.test(host)) return 'reddit';
    return 'referral';
  } catch {
    return 'direct';
  }
}

function getPageSlug(): string {
  const path = window.location.pathname;
  if (path === '/' || path === '') return 'home';
  return path.replace(/^\//, '');
}

export async function trackEvent(
  eventName: string,
  props: Record<string, unknown> = {}
) {
  const searchParams = new URLSearchParams(window.location.search);
  const utmSource = searchParams.get('utm_source');
  const referrer = document.referrer || '';

  try {
    await trackEventApi({
      event_name: eventName,
      page_slug: (props['page_slug'] as string) ?? getPageSlug(),
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      utm_source: utmSource,
      utm_medium: searchParams.get('utm_medium'),
      utm_campaign: searchParams.get('utm_campaign'),
      utm_content: searchParams.get('utm_content'),
      utm_term: searchParams.get('utm_term'),
      referrer: referrer || null,
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      browser: detectBrowser(),
      traffic_source: detectTrafficSource(utmSource, referrer),
      experiment_id: (props['experiment_id'] as string) ?? null,
      variant_id: (props['variant_id'] as string) ?? null,
      conversion_value: (props['conversion_value'] as number) ?? null,
      metadata: Object.keys(props).filter(k =>
        !['page_slug','experiment_id','variant_id','conversion_value'].includes(k)
      ).length > 0
        ? Object.fromEntries(
            Object.entries(props).filter(([k]) =>
              !['page_slug','experiment_id','variant_id','conversion_value'].includes(k)
            )
          )
        : null,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[analytics] track failed', err);
  }
}

export function useEngagementTracking(opts: {
  slug?: string;
  experimentId?: string;
  variantId?: string;
}) {
  useEffect(() => {
    const { slug, experimentId, variantId } = opts;
    const base = { experiment_id: experimentId, variant_id: variantId, page_slug: slug };
    const triggered = new Set<number>();
    const startTime = Date.now();

    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = Math.round((scrolled / total) * 100);
      for (const marker of [25, 50, 75, 90]) {
        if (pct >= marker && !triggered.has(marker)) {
          triggered.add(marker);
          trackEvent(`scroll_${marker}`, base);
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const t30 = setTimeout(() => trackEvent('time_on_page_30s', base), 30_000);
    const t60 = setTimeout(() => trackEvent('time_on_page_60s', base), 60_000);

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        trackEvent('exit_intent', { ...base, time_on_page_s: Math.round((Date.now() - startTime) / 1000) });
      }
    };
    document.addEventListener('mouseleave', onMouseLeave);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseleave', onMouseLeave);
      clearTimeout(t30);
      clearTimeout(t60);
    };
  }, [opts.slug, opts.experimentId, opts.variantId]);
}
