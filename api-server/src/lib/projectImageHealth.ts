/**
 * Image-health scanner for the `projects` table.
 *
 * For each project we inspect every image-bearing field (single-string and
 * array fields) and classify it as one of:
 *   - "ok"       — value is set AND resolves (HEAD 200 for http(s); file
 *                   exists on disk for local paths)
 *   - "broken"   — value is set but does NOT resolve
 *   - "missing"  — value is null / empty AND the field is one we expect to be
 *                   populated (the six structured per-section images).
 *                   Optional fields (logoImage, brochureFile, etc.) are
 *                   reported as "empty" rather than "missing".
 *   - "empty"    — value is null / empty for an optional field. Not counted.
 *
 * The field list deliberately mirrors `repair-project-images.ts` so that
 * fixing a project via the repair script and then re-scanning gives a clean
 * report.
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { Project } from "@workspace/db/schema";

// Status returned per individual image entry.
export type ImageStatus = "ok" | "broken" | "missing" | "empty";

export interface ImageCheck {
  // Field on the project (e.g. "heroImageUrl", "galleryImages").
  field: string;
  // For array fields, the index of the entry within the array; null otherwise.
  index: number | null;
  // The value we attempted to resolve. May be empty string for missing fields.
  value: string;
  status: ImageStatus;
  // Reason string for broken entries (e.g. "HTTP 404", "file not found").
  reason?: string;
}

export interface ProjectImageHealth {
  id: number;
  slug: string;
  name: string;
  // Roll-up counts (excluding "empty").
  totals: {
    checked: number; // ok + broken
    ok: number;
    broken: number;
    missing: number;
  };
  // Overall colour for the admin row badge.
  level: "green" | "yellow" | "red";
  checks: ImageCheck[];
}

// Single-string image fields. The first six are REQUIRED for the public
// detail page's tabs to render; the rest are optional.
const REQUIRED_STRING_FIELDS = [
  "masterPlanImage",
  "floorPlanImage",
  "locationImage",
  "exclusiveClubImage",
  "facilitiesNearbyImage",
  "constructionUpdateImage",
] as const;

const OPTIONAL_STRING_FIELDS = [
  "heroImageUrl",
  "heroImage1",
  "heroImage2",
  "heroImage3",
  "logoImage",
  "brochureFile",
] as const;

const ARRAY_FIELDS = [
  "galleryImages",
  "planImages",
  "amenityImages",
  "constructionImages",
] as const;

export const ALL_SCANNED_FIELDS: readonly string[] = [
  ...REQUIRED_STRING_FIELDS,
  ...OPTIONAL_STRING_FIELDS,
  ...ARRAY_FIELDS,
];

// Where local image paths live. The api-server's cwd is
// `artifacts/api-server`; the public site sits next to it.
const PUBLIC_DIR = path.resolve(process.cwd(), "../unique-builders/public");

/**
 * Classify a single value. Returns null reason on success.
 * Network checks have a short timeout so a flaky CDN doesn't hang the scan.
 */
async function checkOne(
  value: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: "ok" | "broken"; reason?: string }> {
  const trimmed = value.trim();
  if (!trimmed) return { status: "broken", reason: "empty value" };

  // Absolute http(s) URL → HEAD check (fall back to GET if HEAD is rejected).
  if (/^https?:\/\//i.test(trimmed)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      let res = await fetchImpl(trimmed, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      // Some CDNs (notably some Unsplash variants) reject HEAD with 405/403.
      // Retry with a ranged GET so we don't false-positive on those.
      if (res.status === 405 || res.status === 403 || res.status === 501) {
        res = await fetchImpl(trimmed, {
          method: "GET",
          signal: controller.signal,
          redirect: "follow",
          headers: { Range: "bytes=0-0" },
        });
      }
      if (res.ok || (res.status >= 200 && res.status < 400)) {
        return { status: "ok" };
      }
      return { status: "broken", reason: `HTTP ${res.status}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: "broken", reason: `fetch failed: ${msg}` };
    } finally {
      clearTimeout(timer);
    }
  }

  // data: URI — assume valid, we can't do much else.
  if (trimmed.startsWith("data:")) return { status: "ok" };

  // Local path. Strip leading slash and resolve under the public dir.
  const rel = trimmed.replace(/^\/+/, "");
  const full = path.join(PUBLIC_DIR, rel);
  // Guard against path traversal that escapes PUBLIC_DIR.
  if (!full.startsWith(PUBLIC_DIR)) {
    return { status: "broken", reason: "path escapes public dir" };
  }
  try {
    if (existsSync(full) && statSync(full).isFile()) return { status: "ok" };
    return { status: "broken", reason: "file not found" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "broken", reason: `stat failed: ${msg}` };
  }
}

// Bounded concurrency runner so we don't open hundreds of sockets at once.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function scanProject(
  p: Project,
  fetchImpl: typeof fetch = fetch,
): Promise<ProjectImageHealth> {
  // Build the list of (field, index, value, isRequired) tuples.
  type Item = {
    field: string;
    index: number | null;
    value: string;
    required: boolean;
  };
  const items: Item[] = [];

  for (const k of REQUIRED_STRING_FIELDS) {
    const v = (p as unknown as Record<string, unknown>)[k];
    items.push({
      field: k,
      index: null,
      value: typeof v === "string" ? v : "",
      required: true,
    });
  }
  for (const k of OPTIONAL_STRING_FIELDS) {
    const v = (p as unknown as Record<string, unknown>)[k];
    items.push({
      field: k,
      index: null,
      value: typeof v === "string" ? v : "",
      required: false,
    });
  }
  for (const k of ARRAY_FIELDS) {
    const arr = (p as unknown as Record<string, unknown>)[k];
    if (Array.isArray(arr)) {
      arr.forEach((entry, i) => {
        if (typeof entry === "string") {
          items.push({ field: k, index: i, value: entry, required: false });
        }
      });
    }
  }

  const results = await mapWithConcurrency(items, 8, async (it) => {
    if (!it.value.trim()) {
      const status: ImageStatus = it.required ? "missing" : "empty";
      return { field: it.field, index: it.index, value: it.value, status };
    }
    const r = await checkOne(it.value, fetchImpl);
    return {
      field: it.field,
      index: it.index,
      value: it.value,
      status: r.status as ImageStatus,
      reason: r.reason,
    };
  });

  const totals = { checked: 0, ok: 0, broken: 0, missing: 0 };
  for (const r of results) {
    if (r.status === "ok") {
      totals.ok += 1;
      totals.checked += 1;
    } else if (r.status === "broken") {
      totals.broken += 1;
      totals.checked += 1;
    } else if (r.status === "missing") {
      totals.missing += 1;
    }
  }

  let level: "green" | "yellow" | "red" = "green";
  if (totals.broken > 0) level = "red";
  else if (totals.missing > 0) level = "yellow";

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    totals,
    level,
    checks: results,
  };
}

export async function scanProjects(
  rows: Project[],
  fetchImpl: typeof fetch = fetch,
): Promise<ProjectImageHealth[]> {
  // Scan up to 3 projects in parallel so a slow CDN per-project doesn't
  // dominate latency, while still bounding total socket usage.
  return mapWithConcurrency(rows, 3, (r) => scanProject(r, fetchImpl));
}
