import { beforeEach, describe, expect, it, vi } from "vitest";
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; } }));
vi.mock("@workspace/api-zod", () => import("../../../../../lib/api-zod/src/generated/api.js"));
import { analyzePosting } from "../job-posting-analysis.js";

const text = "Senior Programme Manager. Use PRINCE2 delivery methodology. Own programme budgets. Manage steering committees. Demonstrate benefits realisation.";
const signals = ["PRINCE2 delivery methodology", "Own programme budgets", "Manage steering committees"].map(evidence => ({
  signal: evidence, weight: "high", evidence, interpretation: "Explicit responsibility in the posting.",
}));
const result = { isJobPosting: true, title: "Senior Programme Manager", company: null, signals, summary: "Make the stated evidence explicit.", limitations: [] };
const reply = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

describe("grounded posting briefs", () => {
  beforeEach(() => { create.mockReset(); vi.stubEnv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "https://example.invalid"); });
  it("returns grounded quotes and mandatory caveats", async () => {
    create.mockResolvedValueOnce(reply(result));
    const brief = await analyzePosting(text, null);
    expect(brief?.signals).toHaveLength(3);
    expect(brief?.sourceType).toBe("text");
    expect(brief?.limitations[0]).toContain("not confirmed employer");
  });
  it("removes invented quotations rather than showing them", async () => {
    create.mockResolvedValueOnce(reply({ ...result, signals: [...signals, { ...signals[0], evidence: "Unstated £50 million budget" }] }));
    expect((await analyzePosting(text, null))?.signals).toHaveLength(3);
  });
  it("rejects a brief with too few grounded signals", async () => {
    create.mockResolvedValueOnce(reply({ ...result, signals: signals.map(signal => ({ ...signal, evidence: "An invented requirement" })) }));
    await expect(analyzePosting(text, null)).rejects.toMatchObject({ reason: "ungrounded_quotes" });
  });
  it("returns no brief for non-job content", async () => {
    create.mockResolvedValueOnce(reply({ isJobPosting: false, signals: [] }));
    expect(await analyzePosting(text, null)).toBeNull();
  });
  it("rejects malformed provider output explicitly", async () => {
    create.mockResolvedValueOnce({ content: [{ type: "text", text: "not JSON" }] });
    await expect(analyzePosting(text, null)).rejects.toMatchObject({ reason: "invalid_json" });
  });
});
