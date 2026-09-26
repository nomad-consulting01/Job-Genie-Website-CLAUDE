import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

vi.mock("@workspace/api-zod", () => ({
  SubscribeNewsletterBody: {
    safeParse: (body: Record<string, unknown>) => ({
      success: typeof body?.email === "string" && body.email.includes("@"),
      data: body,
    }),
  },
}));
vi.mock("../../lib/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

let server: Server;
let url: string;

beforeAll(async () => {
  const { default: router } = await import("../newsletter.js");
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  url = `http://127.0.0.1:${address.port}/api/newsletter`;
});

afterAll(() => server.close());
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  process.env["BEEHIIV_API_KEY"] = "test-key";
  process.env["BEEHIIV_PUBLICATION_ID"] = "pub_af7c9c60-c55a-4f88-9c44-dc48b00d147f";
});

async function submit(page_slug: string) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "new-signup@example.com",
      first_name: "Alex",
      page_slug,
      visitor_id: "visitor-1",
      lead_magnet: "100-application-autopsy",
      utm_source: "referral",
      utm_medium: "partner",
      utm_campaign: "fall",
    }),
  });
}

describe("Free Autopsy newsletter signup", () => {
  it("enrolls a new CTA signup and confirms its journey, retaining attribution", async () => {
    const beehiiv = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "sub_new" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ subscription_id: "sub_new", status: "in_progress" }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === url) return globalFetch(input, init);
      return beehiiv(input, init);
    });

    const result = await submit("/free-autopsy/");
    expect(result.status).toBe(200);
    expect(beehiiv).toHaveBeenCalledTimes(3);
    const [createUrl, createOptions] = beehiiv.mock.calls[1];
    expect(String(createUrl)).toContain("/subscriptions");
    const payload = JSON.parse(createOptions.body);
    expect(payload.automation_ids).toEqual(["aut_0e902f78-459f-4e37-8850-906ba78d1c23"]);
    expect(payload.utm_source).toBe("referral");
    expect(payload.utm_medium).toBe("partner");
    expect(payload.utm_campaign).toBe("fall");
    expect(payload.custom_fields).toContainEqual({ name: "First Name", value: "Alex" });
    expect(payload.custom_fields).toContainEqual({ name: "visitor_id", value: "visitor-1" });
    expect(String(beehiiv.mock.calls[2][0])).toContain("/automations/aut_0e902f78-459f-4e37-8850-906ba78d1c23/journeys");
  });

  it("does not enroll unrelated newsletter forms", async () => {
    const beehiiv = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      String(input) === url ? globalFetch(input, init) : beehiiv(input, init));
    const result = await submit("/blog");
    expect(result.status).toBe(200);
    expect(beehiiv).toHaveBeenCalledTimes(1);
    expect(JSON.parse(beehiiv.mock.calls[0][1].body).automation_ids).toBeUndefined();
  });

  it("does not claim success when Beehiiv creates a subscriber without a journey", async () => {
    const beehiiv = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "sub_new" } }), { status: 201 }))
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 })));
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      String(input) === url ? globalFetch(input, init) : beehiiv(input, init));
    const result = await submit("/free-autopsy");
    expect(result.status).toBe(502);
    expect(beehiiv).toHaveBeenCalledTimes(6);
    expect(beehiiv.mock.calls.some(([path, options]) =>
      String(path).endsWith("/journeys") && options?.method === "POST")).toBe(false);
  });

  it("repairs an active existing subscriber who never entered the automation", async () => {
    const beehiiv = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: "sub_existing", email: "new-signup@example.com", status: "active" },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "sub_existing" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], total_pages: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], total_pages: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], total_pages: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], total_pages: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "journey_new" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ subscription_id: "sub_existing", status: "in_progress" }], total_pages: 1,
      }), { status: 200 }));
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      String(input) === url ? globalFetch(input, init) : beehiiv(input, init));

    const result = await submit("/free-autopsy");
    expect(result.status).toBe(200);
    const enrollCalls = beehiiv.mock.calls.filter(([path, options]) =>
      String(path).endsWith("/journeys") && options?.method === "POST");
    expect(enrollCalls).toHaveLength(1);
    expect(JSON.parse(enrollCalls[0][1].body)).toEqual({ subscription_id: "sub_existing" });
  });

  it("does not re-enroll an existing subscriber who already has a journey", async () => {
    const beehiiv = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: "sub_existing", email: "new-signup@example.com", status: "active" },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "sub_existing" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ subscription_id: "sub_existing", status: "in_progress" }], total_pages: 1,
      }), { status: 200 }));
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      String(input) === url ? globalFetch(input, init) : beehiiv(input, init));

    const result = await submit("/free-autopsy");
    expect(result.status).toBe(200);
    expect(beehiiv).toHaveBeenCalledTimes(3);
    expect(beehiiv.mock.calls.some(([path, options]) =>
      String(path).endsWith("/journeys") && options?.method === "POST")).toBe(false);
  });
});

const globalFetch = globalThis.fetch;