import { useRef, useState } from "react";

export interface PublicMarketingVariant {
  copy: string;
  hashtags: string[];
  cta: string;
}

export interface PublicDirectResponse {
  meta: PublicMarketingVariant | null;
  instagram: PublicMarketingVariant | null;
}

const SORA = "'Sora', sans-serif";
const DM_SANS = "'DM Sans', sans-serif";
const NAVY = "#090D19";
const INDIGO = "#7C83FF";

const CHANNELS: { key: "meta" | "instagram"; label: string }[] = [
  { key: "meta", label: "Meta" },
  { key: "instagram", label: "Instagram" },
];

function variantPlainText(v: PublicMarketingVariant): string {
  return [v.copy, v.hashtags.join(" "), v.cta].filter((s) => s && s.trim()).join("\n\n");
}

function CopyVariantButton({ variant }: { variant: PublicMarketingVariant }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(variantPlainText(variant));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{ fontFamily: SORA, background: "rgba(124,131,255,0.15)", color: INDIGO, border: "1px solid rgba(124,131,255,0.35)" }}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function VariantBody({ variant }: { variant: PublicMarketingVariant }) {
  return (
    <div className="space-y-4">
      <p className="whitespace-pre-wrap leading-relaxed text-[15px] text-gray-200" style={{ fontFamily: DM_SANS }}>
        {variant.copy}
      </p>
      {variant.hashtags.length > 0 && (
        <p className="text-sm font-medium" style={{ fontFamily: DM_SANS, color: INDIGO }}>
          {variant.hashtags.join(" ")}
        </p>
      )}
      {variant.cta && (
        <p className="text-sm font-semibold text-white" style={{ fontFamily: DM_SANS }}>
          {variant.cta}
        </p>
      )}
      <div className="pt-1">
        <CopyVariantButton variant={variant} />
      </div>
    </div>
  );
}

export function DirectResponseTabs({ directResponse }: { directResponse: PublicDirectResponse | null }) {
  const available = CHANNELS.filter((c) => directResponse?.[c.key]);
  const [active, setActive] = useState<"meta" | "instagram">(available[0]?.key ?? "meta");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (!directResponse || available.length === 0) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = available.findIndex((c) => c.key === active);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % available.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + available.length) % available.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = available.length - 1;
    else return;
    e.preventDefault();
    const key = available[next]!.key;
    setActive(key);
    tabRefs.current[key]?.focus();
  };

  return (
    <section
      aria-label="Ready-to-share social posts"
      className="mt-12 rounded-2xl p-6 sm:p-8"
      style={{ background: NAVY, border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: SORA }}>
        Share this insight
      </h2>
      <p className="text-sm text-gray-400 mb-5" style={{ fontFamily: DM_SANS }}>
        Copy a ready-to-post version for your channel.
      </p>

      <div role="tablist" aria-label="Social platform" className="flex items-center gap-2 mb-5" onKeyDown={onKeyDown}>
        {available.map((c) => {
          const selected = c.key === active;
          return (
            <button
              key={c.key}
              ref={(el) => {
                tabRefs.current[c.key] = el;
              }}
              role="tab"
              id={`dr-tab-${c.key}`}
              type="button"
              aria-selected={selected}
              aria-controls={`dr-panel-${c.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(c.key)}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              style={
                selected
                  ? { fontFamily: SORA, background: INDIGO, color: NAVY }
                  : { fontFamily: SORA, background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }
              }
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {available.map((c) => (
        <div
          key={c.key}
          role="tabpanel"
          id={`dr-panel-${c.key}`}
          aria-labelledby={`dr-tab-${c.key}`}
          hidden={c.key !== active}
          tabIndex={0}
        >
          <VariantBody variant={directResponse[c.key]!} />
        </div>
      ))}
    </section>
  );
}
