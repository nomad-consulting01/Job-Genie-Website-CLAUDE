import { vi } from "vitest";

const makeChain = (finalValue: unknown = []) => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "from", "where", "orderBy", "limit", "offset", "innerJoin", "set", "update", "insert", "values", "returning", "delete"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => Promise.resolve(finalValue).then(resolve);
  return chain;
};

export const db = {
  select: vi.fn(() => makeChain([])),
  update: vi.fn(() => makeChain([])),
  insert: vi.fn(() => makeChain([])),
  delete: vi.fn(() => makeChain([])),
};

export const contentAssets = { id: "id", channel: "channel", status: "status", payloadJson: "payloadJson", answerId: "answerId", publishedAt: "publishedAt" };
export const answers = { id: "id", questionId: "questionId" };
export const questions = { id: "id", normalisedQuestion: "normalisedQuestion" };

export const eq = vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] }));
export const and = vi.fn((...args: unknown[]) => ({ and: args }));
export const sql = vi.fn((s: unknown) => s);
export const desc = vi.fn((a: unknown) => a);
export const isNull = vi.fn((a: unknown) => a);
export const isNotNull = vi.fn((a: unknown) => a);
export const notExists = vi.fn((a: unknown) => a);
