import { BRAND_NAV_STYLES, renderBrandNavigation } from "@workspace/site-config";
import { trackEvent } from "../lib/analytics";

/** The homepage brand/navigation, also used by non-React FAQ responses. */
export function BrandNavigation() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <>
      <style>{BRAND_NAV_STYLES}</style>
      <div
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("[data-jg-cta]")) {
            trackEvent("free_autopsy_click", { location: "nav" });
          }
        }}
        dangerouslySetInnerHTML={{ __html: renderBrandNavigation(base) }}
      />
    </>
  );
}