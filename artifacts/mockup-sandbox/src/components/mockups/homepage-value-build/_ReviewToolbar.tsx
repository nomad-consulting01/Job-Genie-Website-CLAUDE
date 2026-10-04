import { useEffect } from "react";

export function ReviewToolbar({ proposed = false }: { proposed?: boolean }) {
  useEffect(() => {
    const section = window.location.hash.slice(1) || "price";
    if (section) {
      const timer = window.setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: "instant" }), 200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

  function jump(id: string) {
    if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" });
    else if (id === "footer") document.querySelector("footer")?.scrollIntoView({ behavior: "smooth" });
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
    <link rel="stylesheet" media="print" onLoad={(event) => { event.currentTarget.media = "all"; }}
      href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" />
    <div style={{ position: "fixed", inset: "0 0 auto", zIndex: 10000, height: 56, background: "#10172e", borderBottom: "1px solid #363f62", display: "flex", alignItems: "center", gap: 16, padding: "0 20px", overflowX: "auto", whiteSpace: "nowrap", fontFamily: "Manrope, sans-serif", fontSize: 12 }}>
      <strong style={{ color: proposed ? "#2dd4bf" : "#f5f5f2" }}>{proposed ? "AFTER · PROPOSED" : "BEFORE · CURRENT"}</strong>
      <span style={{ color: "#a5adcb" }}>Preview only</span>
      {[
        ["top", "Overview"],
        ["truth-layer", "Evidence layer"],
        ...(proposed ? [["recruiter-brief", "New Brief section"]] : []),
        ["feat", "Feature benefits"],
        ["price", proposed ? "Value stack + pricing" : "Pricing"],
        ["footer", "Footer"],
      ].map(([id, label]) => (
        <button key={id} onClick={() => jump(id)} style={{ color: "#e4e8fa", padding: "6px 10px", border: "1px solid #363f62", borderRadius: 20, flexShrink: 0 }}>{label}</button>
      ))}
    </div>
    </>
  );
}