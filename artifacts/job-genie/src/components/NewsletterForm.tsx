import { useEffect, useState } from "react";
import { useSubscribeNewsletter } from "@workspace/api-client-react";
import { trackEvent } from "../lib/analytics";

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
    subscribe.mutate(
      { data: { email, page_slug: window.location.pathname } },
      {
        onSuccess: () => {
          trackEvent("newsletter_signup_complete");
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
