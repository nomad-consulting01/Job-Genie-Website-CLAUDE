import { useEffect, useState } from "react";
import { useSubscribeNewsletter } from "@workspace/api-client-react";
import { trackEvent } from "../lib/analytics";
import { getVisitorId } from "../lib/abtest";

function getLocalVariantContext(): { experiment_id: string | null; variant_id: string | null } {
  try {
    const expKey = "exp_home_headline_test";
    const variantId = localStorage.getItem(expKey) ?? null;
    return { experiment_id: "home_headline_test", variant_id: variantId };
  } catch {
    return { experiment_id: null, variant_id: null };
  }
}

function getUtmParams() {
  const s = new URLSearchParams(window.location.search);
  return {
    utm_source: s.get("utm_source"),
    utm_medium: s.get("utm_medium"),
    utm_campaign: s.get("utm_campaign"),
    utm_content: s.get("utm_content"),
    utm_term: s.get("utm_term"),
  };
}

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const subscribe = useSubscribeNewsletter();

  useEffect(() => {
    trackEvent("newsletter_form_view");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    trackEvent("newsletter_submit_attempt");
    const { experiment_id, variant_id } = getLocalVariantContext();
    const utm = getUtmParams();

    subscribe.mutate(
      {
        data: {
          email,
          page_slug: window.location.pathname,
          experiment_id: experiment_id ?? undefined,
          variant_id: variant_id ?? undefined,
          utm_source: utm.utm_source ?? undefined,
          utm_medium: utm.utm_medium ?? undefined,
          utm_campaign: utm.utm_campaign ?? undefined,
          utm_content: utm.utm_content ?? undefined,
          utm_term: utm.utm_term ?? undefined,
          visitor_id: getVisitorId(),
        },
      },
      {
        onSuccess: () => {
          trackEvent("newsletter_submit_success");
          setEmail("");
        },
        onError: () => {
          trackEvent("newsletter_submit_error");
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-sm mt-4">
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onFocus={() => trackEvent("newsletter_signup_intent")}
        className="flex-1 bg-white/10 border border-white/20 rounded-md px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        required
        data-testid="input-newsletter-email"
      />
      <button
        type="submit"
        disabled={subscribe.isPending || subscribe.isSuccess}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-md text-sm transition-colors disabled:opacity-50"
        data-testid="button-newsletter-submit"
      >
        {subscribe.isPending ? "Subscribing..." : subscribe.isSuccess ? "Check inbox!" : "Subscribe"}
      </button>
    </form>
  );
}
