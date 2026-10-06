import { useCallback, type SyntheticEvent } from "react";
import CurrentHome from "./_CurrentHome";
import "./_review.css";

function containPreviewNavigation(event: SyntheticEvent<HTMLElement>) {
  const target = event.target as HTMLElement;
  const link = target.closest("a");
  if (link) {
    const href = link.getAttribute("href") ?? "";
    if (!href.startsWith("#")) event.preventDefault();
  }
}

export function Current() {
  const contain = useCallback((event: SyntheticEvent<HTMLElement>) => {
    containPreviewNavigation(event);
  }, []);

  return (
    <div className="homepage-evidence-review" onClickCapture={contain} onSubmitCapture={(event) => event.preventDefault()}>
      <aside className="review-status" role="note" aria-label="Baseline review status">
        <span className="review-status-mark" aria-hidden="true">B</span>
        <div><strong>Baseline · unchanged</strong><span>Extracted homepage shown as-is for comparison.</span></div>
      </aside>
      <CurrentHome />
    </div>
  );
}

export default Current;
