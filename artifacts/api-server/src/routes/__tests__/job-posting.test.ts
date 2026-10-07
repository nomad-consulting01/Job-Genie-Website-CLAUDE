import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const mocks = vi.hoisted(() => ({ analyze: vi.fn(), fetch: vi.fn() }));
vi.mock("@workspace/api-zod", () => import("../../../../../lib/api-zod/src/generated/api.js"));
vi.mock("../../integrations/job-posting-analysis.js", () => ({ analyzePosting: mocks.analyze, PostingAnalysisError: class extends Error {} }));
vi.mock("../../lib/job-posting-fetch.js", async importOriginal => ({
  ...(await importOriginal<typeof import("../../lib/job-posting-fetch.js")>()), fetchJobPosting: mocks.fetch,
}));
import router from "../job-posting.js";

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.log = { warn: vi.fn() } as unknown as typeof req.log; next(); });
app.use(router);
const posting = "Senior Programme Manager. Lead transformation programmes using PRINCE2. Own programme budgets and headcount. Report benefits realisation to the steering committee.";

describe("anonymous posting analysis", () => {
  beforeEach(() => { mocks.analyze.mockReset(); mocks.fetch.mockReset(); });
  it("requires exactly one source", async () => {
    for (const body of [{}, { url: "https://jobs.example.com", text: posting }, { text: "too short" }]) {
      const res = await request(app).post("/job-posting/analyze").send(body);
      expect(res.status).toBe(400);
    }
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("returns a real analyzed brief without identity or CV fields", async () => {
    mocks.analyze.mockResolvedValueOnce({ title: "Senior Programme Manager", sourceType: "text", signals: [] });
    const res = await request(app).post("/job-posting/analyze").send({ text: posting });
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(mocks.analyze).toHaveBeenCalledWith(posting, null);
    expect(res.body.title).toBe("Senior Programme Manager");
  });
  it("does not substitute a demo for insufficient input", async () => {
    mocks.analyze.mockResolvedValueOnce(null);
    const res = await request(app).post("/job-posting/analyze").send({ text: posting });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("insufficient_posting");
    expect(res.body.signals).toBeUndefined();
  });
  it("reports provider failure explicitly", async () => {
    mocks.analyze.mockRejectedValueOnce(new Error("provider failed"));
    const res = await request(app).post("/job-posting/analyze").send({ text: posting });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("analysis_failed");
    expect(res.body.error).not.toContain("provider failed");
  });
});
