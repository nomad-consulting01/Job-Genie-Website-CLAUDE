import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../corpus/db.js", () => ({
  listPublishedBlogPosts: vi.fn(async () => []),
  getBlogPostById: vi.fn(async () => null),
  insertContentAsset: vi.fn(async () => ({})),
  getContentAssetById: vi.fn(async () => null),
  updateContentAssetStatus: vi.fn(async () => {}),
  markBlogPostFacebookShared: vi.fn(async () => {}),
}));

vi.mock("../../loops/voice-loop/variantGenerator.js", () => ({
  generateVoiceVariants: vi.fn(async () => ({
    variants: [],
    autoRejected: 0,
    budgetUsedUsd: 0,
    budgetCapHit: false,
    errors: [],
  })),
}));

vi.mock("../../loops/voice-loop/fileStore.js", () => ({
  readSelfImproveProposals: vi.fn(() => ({ proposals: [] })),
  readVoiceLibrary: vi.fn(() => ({})),
  readVoiceLedger: vi.fn(() => ({})),
  writePublishedVariants: vi.fn(() => {}),
  readPublishedVariants: vi.fn(() => ({ entries: [], lastUpdatedAt: "" })),
}));

vi.mock("../../loops/voice-loop/selfImprove.js", () => ({
  applySelfImproveProposal: vi.fn(async () => ({ applied: true })),
  dismissSelfImproveProposal: vi.fn(async () => ({ dismissed: true })),
}));

vi.mock("../../loops/voice-loop/fbMetrics.js", () => ({
  runFbMetricsIngest: vi.fn(async () => ({})),
}));

vi.mock("../../integrations/facebook.js", () => ({
  postToFacebookPage: vi.fn(async () => ({ postId: null, error: "no creds" })),
}));

vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getContentAssetById } from "../../corpus/db.js";

const ADMIN_TOKEN = "test-admin-token";

let app: express.Express;

beforeAll(async () => {
  process.env["ADMIN_TOKEN"] = ADMIN_TOKEN;
  const { default: voiceVariantsRouter } = await import("../voice-variants.js");
  app = express();
  app.use(express.json());
  app.use("/voice-variants", voiceVariantsRouter);
});

function authed(req: request.Test): request.Test {
  return req.set("Authorization", `Bearer ${ADMIN_TOKEN}`);
}

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    channel: "voice_variant",
    status: "draft",
    payloadJson: {} as Record<string, unknown>,
    answerId: 10,
    publishedAt: null,
    ...overrides,
  };
}

describe("POST /voice-variants/:id/publish — publishing gate", () => {
  beforeEach(() => {
    vi.mocked(getContentAssetById).mockReset();
  });

  it("returns 403 when variant status is 'draft' (not yet approved)", async () => {
    vi.mocked(getContentAssetById).mockResolvedValue(makeAsset({ status: "draft" }) as never);

    const res = await authed(request(app).post("/voice-variants/1/publish"));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/approval/i);
    expect(res.body.currentStatus).toBe("draft");
  });

  it("returns 403 when variant status is 'approved' but payloadJson has no approver", async () => {
    vi.mocked(getContentAssetById).mockResolvedValue(
      makeAsset({ status: "approved", payloadJson: {} }) as never
    );

    const res = await authed(request(app).post("/voice-variants/1/publish"));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/approver/i);
  });

  it("returns 403 when variant status is 'rejected'", async () => {
    vi.mocked(getContentAssetById).mockResolvedValue(makeAsset({ status: "rejected" }) as never);

    const res = await authed(request(app).post("/voice-variants/1/publish"));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/approval/i);
    expect(res.body.currentStatus).toBe("rejected");
  });

  it("does not block publishing when status is 'approved' and approver is recorded", async () => {
    vi.mocked(getContentAssetById).mockResolvedValue(
      makeAsset({
        status: "approved",
        payloadJson: {
          approver: "alice",
          approvedAt: new Date().toISOString(),
          variantId: "v-abc",
          voiceId: "voice-a",
          hookType: "question",
          bodyText: "Some copy",
          blogPostSlug: null,
          blogPostAssetId: null,
        },
      }) as never
    );

    const res = await authed(request(app).post("/voice-variants/1/publish"));

    expect(res.status).not.toBe(403);
    expect(res.body.status).toBe("published");
  });
});

describe("POST /voice-variants/:id/approve — approver gate", () => {
  beforeEach(() => {
    vi.mocked(getContentAssetById).mockReset();
  });

  it("returns 400 when approver field is missing from request body", async () => {
    vi.mocked(getContentAssetById).mockResolvedValue(makeAsset({ status: "draft" }) as never);

    const res = await authed(request(app).post("/voice-variants/1/approve").send({}));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approver/i);
  });

  it("returns 400 when approver is a blank string", async () => {
    vi.mocked(getContentAssetById).mockResolvedValue(makeAsset({ status: "draft" }) as never);

    const res = await authed(
      request(app).post("/voice-variants/1/approve").send({ approver: "   " })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approver/i);
  });

  it("returns 409 when trying to approve a rejected variant", async () => {
    vi.mocked(getContentAssetById).mockResolvedValue(makeAsset({ status: "rejected" }) as never);

    const res = await authed(
      request(app).post("/voice-variants/1/approve").send({ approver: "alice" })
    );

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/rejected/i);
  });
});

describe("requireAdmin middleware", () => {
  it("returns 401 when Authorization header is absent", async () => {
    const res = await request(app).post("/voice-variants/1/publish");
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is incorrect", async () => {
    const res = await request(app)
      .post("/voice-variants/1/publish")
      .set("Authorization", "Bearer wrong-token");
    expect(res.status).toBe(401);
  });
});
