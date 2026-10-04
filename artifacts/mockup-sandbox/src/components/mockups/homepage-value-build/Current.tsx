import { CurrentHome } from "./_CurrentHome";
import { ReviewToolbar } from "./_ReviewToolbar";
import "./_group.css";

export function Current() {
  return (
    <div className="min-h-screen" onClickCapture={(event) => {
      const anchor = (event.target as Element).closest("a");
      if (anchor && !anchor.getAttribute("href")?.startsWith("#")) event.preventDefault();
    }}>
      <ReviewToolbar />
      <CurrentHome homepageCtas />
    </div>
  );
}