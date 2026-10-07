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
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
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
  it("identifies the running handler without a subscription side effect", async () => {
    const beehiiv = vi.fn();
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      String(input) === url ? globalFetch(input, init) : beehiiv(input, init));
    const result = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(result.status).toBe(400);
    expect(result.headers.get("x-autopsy-automation-id")).toBe("aut_badd5896-ca28-4019-9eed-a16f0aa58465");
    expect(result.headers.get("x-newsletter-handler")).toBe("fork-journey-precheck");
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(beehiiv).not.toHaveBeenCalled();
  });

  it.each(["/free-autopsy3", "/free-autopsy4", "/free-autopsy4/"])("enrolls %s visitors in the Autopsy journey", async (slug) => {
    const beehiiv = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "sub_third" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ subscription_id: "sub_third", status: "in_progress" }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      String(input) === url ? globalFetch(input, init) : beehiiv(input, init));

    const result = await submit(slug);
    expect(result.status).toBe(200);
    expect(beehiiv).toHaveBeenCalledTimes(3);
    expect(JSON.parse(beehiiv.mock.calls[1][1].body).automation_ids)
      .toEqual(["aut_badd5896-ca28-4019-9eed-a16f0aa58465"]);
  });

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
    expect(payload.automation_ids).toEqual(["aut_badd5896-ca28-4019-9eed-a16f0aa58465"]);
    expect(payload.utm_source).toBe("referral");
    expect(payload.utm_medium).toBe("partner");
    expect(payload.utm_campaign).toBe("fall");
    expect(payload.custom_fields).toContainEqual({ name: "First Name", value: "Alex" });
    expect(payload.custom_fields).toContainEqual({ name: "visitor_id", value: "visitor-1" });
    expect(String(beehiiv.mock.calls[2][0])).toContain("/automations/aut_badd5896-ca28-4019-9eed-a16f0aa58465/journeys");
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], total_pages: 1 }), { status: 200 }))
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
    expect(String(enrollCalls[0][0])).toContain("/automations/aut_badd5896-ca28-4019-9eed-a16f0aa58465/journeys");
    expect(JSON.parse(enrollCalls[0][1].body)).toEqual({ subscription_id: "sub_existing" });
  });

  it.each(["in_progress", "completed"])("does not write to Beehiiv for an existing subscriber with a %s journey", async (journeyStatus) => {
    const beehiiv = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: "sub_existing", email: "new-signup@example.com", status: "active" },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ subscription_id: "sub_existing", status: journeyStatus }], total_pages: 1,
      }), { status: 200 }));
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      String(input) === url ? globalFetch(input, init) : beehiiv(input, init));

    const result = await submit("/free-autopsy");
    expect(result.status).toBe(200);
    expect(beehiiv).toHaveBeenCalledTimes(2);
    expect(beehiiv.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
    expect(result.headers.get("x-autopsy-automation-id")).toBe("aut_badd5896-ca28-4019-9eed-a16f0aa58465");
    expect(result.headers.get("x-newsletter-handler")).toBe("fork-journey-precheck");
  });

  it("finds an existing fork journey on a later page without an enrollment write", async () => {
    const beehiiv = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: "sub_existing", email: "new-signup@example.com", status: "active" },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ subscription_id: "sub_other" }], total_pages: 2,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ subscription_id: "sub_existing" }], total_pages: 2,
      }), { status: 200 }));
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      String(input) === url ? globalFetch(input, init) : beehiiv(input, init));
    const result = await submit("/free-autopsy4");
    expect(result.status).toBe(200);
    expect(String(beehiiv.mock.calls[2][0])).toContain("page=2");
    expect(beehiiv.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
  });

  it("fails explicitly on a malformed journey response instead of trying to enroll again", async () => {
    const beehiiv = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: "sub_existing", email: "new-signup@example.com", status: "active" },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "journey_without_subscription_id" }], total_pages: 1,
      }), { status: 200 }));
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      String(input) === url ? globalFetch(input, init) : beehiiv(input, init));
    const result = await submit("/free-autopsy");
    expect(result.status).toBe(502);
    expect(beehiiv).toHaveBeenCalledTimes(2);
    expect(beehiiv.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
  });
});

const globalFetch = globalThis.fetch;