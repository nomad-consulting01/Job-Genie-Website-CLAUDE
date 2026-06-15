import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trackEvent } from "../lib/analytics";
import experimentsData from "../data/experiments.json";

export default function Admin() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("ADMIN_TOKEN"));
  const [metrics, setMetrics] = useState<any>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!token) {
      const input = window.prompt("Enter Admin Token:");
      if (input) {
        localStorage.setItem("ADMIN_TOKEN", input);
        setToken(input);
      } else {
        setLocation("/");
      }
    }
  }, [token, setLocation]);

  useEffect(() => {
    if (token) {
      fetch("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => setMetrics(data))
        .catch((e) => console.error("Failed to fetch metrics", e));
    }
  }, [token]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Job Genie Admin</h1>
          <p className="text-zinc-400">Marketing & A/B Test Operations</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white border-b border-zinc-800 pb-2">Site Metrics</h2>
          {metrics ? (
            <div className="overflow-x-auto bg-zinc-900 border border-zinc-800 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">Slug</th>
                    <th className="px-6 py-4 font-medium">Page Views</th>
                    <th className="px-6 py-4 font-medium">Unique Visitors</th>
                    <th className="px-6 py-4 font-medium">Free Autopsy Clicks</th>
                    <th className="px-6 py-4 font-medium">Newsletter Signups</th>
                    <th className="px-6 py-4 font-medium">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {metrics.by_slug?.map((row: any) => (
                    <tr key={row.slug} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{row.slug}</td>
                      <td className="px-6 py-4">{row.page_views}</td>
                      <td className="px-6 py-4">{row.unique_visitors}</td>
                      <td className="px-6 py-4">{row.free_autopsy_clicks}</td>
                      <td className="px-6 py-4">{row.newsletter_signups}</td>
                      <td className="px-6 py-4 text-emerald-400">{(row.conversion_rate || 0).toFixed(2)}%</td>
                    </tr>
                  ))}
                  {!metrics.by_slug?.length && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                        No metrics data available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-zinc-800 rounded"></div>
                  <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white border-b border-zinc-800 pb-2">Experiments</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {experimentsData.experiments.map((exp) => (
              <div key={exp.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">{exp.name}</h3>
                    <p className="text-sm text-zinc-500 font-mono mt-1">{exp.id}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${exp.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                    {exp.status.toUpperCase()}
                  </span>
                </div>
                
                <div className="pt-4 space-y-3">
                  <p className="text-sm text-zinc-400 font-medium">Variants</p>
                  <ul className="space-y-2">
                    {exp.variants.map(v => (
                      <li key={v.id} className="flex justify-between items-center text-sm p-3 bg-zinc-950/50 rounded-md border border-zinc-800">
                        <span className="text-zinc-300">{v.name}</span>
                        <span className="text-zinc-500 font-mono">{(v.weight * 100).toFixed(0)}% traffic</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
