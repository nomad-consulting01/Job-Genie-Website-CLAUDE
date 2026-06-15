import { getVisitorId, getSessionId } from './abtest';
import { trackEvent as trackEventApi } from '@workspace/api-client-react';

export async function trackEvent(eventName: string, props: Record<string, any> = {}) {
  const searchParams = new URLSearchParams(window.location.search);
  
  const payload = {
    event_name: eventName,
    page_slug: window.location.pathname.replace(/^\/lp\//, '').replace(/^\/$/, 'home'),
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    utm_source: searchParams.get('utm_source') || null,
    utm_medium: searchParams.get('utm_medium') || null,
    utm_campaign: searchParams.get('utm_campaign') || null,
    utm_content: searchParams.get('utm_content') || null,
    utm_term: searchParams.get('utm_term') || null,
    referrer: document.referrer || null,
    device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    ...props
  };

  try {
    // using the raw fetcher from our generated api
    await trackEventApi({
        event_name: payload.event_name,
        page_slug: payload.page_slug,
        visitor_id: payload.visitor_id,
        session_id: payload.session_id,
        utm_source: payload.utm_source,
        utm_medium: payload.utm_medium,
        utm_campaign: payload.utm_campaign,
        utm_content: payload.utm_content,
        utm_term: payload.utm_term,
        referrer: payload.referrer,
        device_type: payload.device_type,
        experiment_id: payload.experiment_id,
        variant_id: payload.variant_id,
        metadata: payload.metadata
    });
  } catch (err) {
    console.error('Failed to track event', err);
  }
}
