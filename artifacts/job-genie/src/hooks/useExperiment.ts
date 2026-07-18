import { useMemo, useEffect, useRef, useState } from 'react';
import abTests from '@content/ab-tests.json';
import { trackEvent } from '../lib/analytics';

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256sync(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const H0 = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const padLen = ((bytes.length + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padLen - 4, bitLen >>> 0, false);
  dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);

  const h = [...H0];
  for (let i = 0; i < padLen; i += 64) {
    const w = new Array<number>(64);
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr32(w[j - 15], 7) ^ rotr32(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr32(w[j - 2], 17) ^ rotr32(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((v) => v.toString(16).padStart(8, '0')).join('');
}

const LS_KEY = 'jg_visitor_id';

function readLocalVisitorId(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

function writeLocalVisitorId(id: string): void {
  try {
    localStorage.setItem(LS_KEY, id);
  } catch {
    // ignore
  }
}

function generateVisitorId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Resolve the canonical visitor ID via the server.
 *
 * Strategy:
 * 1. If localStorage already has an ID → send it to the server so it is
 *    registered (INSERT OR IGNORE). The server returns the same ID.
 * 2. If localStorage is empty → send an empty body. The server checks its
 *    `jg_vid` cookie. If a matching record exists in the `visitors` table it
 *    returns `{ visitor_id, restored: true }` and we write that to localStorage.
 * 3. If the server has nothing either → generate a fresh ID, write it to
 *    localStorage and register it with the server in a fire-and-forget call.
 */
async function resolveVisitorId(localId: string | null): Promise<string> {
  try {
    const body = localId ? { visitor_id: localId } : {};
    const res = await fetch('/api/visitors/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = (await res.json()) as { visitor_id: string | null; restored: boolean };
      if (data.visitor_id) {
        if (data.restored) {
          writeLocalVisitorId(data.visitor_id);
        }
        return data.visitor_id;
      }
    }
  } catch {
    // Network error — fall through
  }

  // Server had nothing; use the local ID we already had, or mint a fresh one.
  if (localId) return localId;

  const fresh = generateVisitorId();
  writeLocalVisitorId(fresh);

  // Register the new ID server-side (fire-and-forget).
  fetch('/api/visitors/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor_id: fresh }),
  }).catch(() => {});

  return fresh;
}

// Module-level singleton so all experiment hooks share a single network call.
let _promise: Promise<string> | null = null;

function getVisitorIdPromise(): Promise<string> {
  if (_promise) return _promise;
  // Read (but do NOT create) the local ID so we give the server a chance to
  // restore a prior ID from the cookie when localStorage is empty.
  const localId = readLocalVisitorId();
  _promise = resolveVisitorId(localId);
  return _promise;
}

/**
 * Returns the stable visitor ID for experiment bucketing.
 *
 * - Synchronous initial value: whatever is in localStorage right now
 *   (null if localStorage was cleared).
 * - Async update: once the server sync settles, the state is updated with
 *   the canonical ID (which may be restored from the server cookie).
 */
export function useVisitorId(): string | null {
  const [visitorId, setVisitorId] = useState<string | null>(() => readLocalVisitorId());

  useEffect(() => {
    let cancelled = false;
    getVisitorIdPromise().then((id) => {
      if (!cancelled) {
        setVisitorId(id);
        // Keep localStorage in sync (handles the restoration case)
        writeLocalVisitorId(id);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return visitorId;
}

function assignVariant(experimentId: string, visitorId: string, variants: Array<{ id: string; weight: number }>): string {
  const hex = sha256sync(`${experimentId}:${visitorId}`);
  const bucket = parseInt(hex.slice(-8), 16) % 100;
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += Math.round(variant.weight * 100);
    if (bucket < cumulative) return variant.id;
  }
  return variants[0]?.id ?? 'control';
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  overrides: Record<string, unknown>;
}

export interface UseExperimentResult {
  variant: ExperimentVariant | null;
  overrides: Record<string, unknown>;
  experimentId: string;
  variantId: string | null;
}

export function useExperiment(experimentId: string): UseExperimentResult {
  const visitorId = useVisitorId();

  const result = useMemo((): UseExperimentResult => {
    // If visitor ID is not yet resolved, return a null result.
    // The component will re-render once the server sync settles.
    if (!visitorId) {
      return { variant: null, overrides: {}, experimentId, variantId: null };
    }

    const experiment = (abTests.experiments as Array<{
      id: string;
      status: string;
      variants: Array<{ id: string; name: string; weight: number; overrides: Record<string, unknown> }>;
    }>).find((e) => e.id === experimentId && e.status === 'active');

    if (!experiment) {
      return { variant: null, overrides: {}, experimentId, variantId: null };
    }

    const selectedId = assignVariant(experimentId, visitorId, experiment.variants);
    const selectedVariant = experiment.variants.find((v) => v.id === selectedId) ?? experiment.variants[0];

    return {
      variant: selectedVariant,
      overrides: selectedVariant?.overrides ?? {},
      experimentId,
      variantId: selectedVariant?.id ?? null,
    };
  }, [experimentId, visitorId]);

  // Fire analytics exactly once: after the visitor ID is fully resolved and
  // stable. The firedRef guard ensures we never double-count even if the ID
  // briefly changes from null → restored.
  const firedRef = useRef(false);
  useEffect(() => {
    if (!firedRef.current && result.variantId && visitorId) {
      firedRef.current = true;
      trackEvent('experiment_assigned', {
        experiment_id: result.experimentId,
        variant_id: result.variantId,
      });
    }
  }, [result.experimentId, result.variantId, visitorId]);

  return result;
}
