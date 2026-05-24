/**
 * One-shot, idempotent data-repair for the `projects` table.
 *
 * Two problems this fixes (see task #66):
 *   1) `heroImageUrl` / `galleryImages` / `heroImage{1,2,3}` / `brochureFile`
 *      on three legacy rows point to local files that no longer exist on
 *      disk under `artifacts/unique-builders/public/`. Visitors see
 *      broken-image icons. We swap those bad paths for either an existing
 *      `/img/projects/*` file or a stable Unsplash URL.
 *   2) The structured per-section image fields
 *      (masterPlanImage, floorPlanImage, locationImage, exclusiveClubImage,
 *       facilitiesNearbyImage, constructionUpdateImage) are NULL on every
 *      row, so the public detail page's Project Showcase tabs (Plans /
 *      Amenities / Location / Construction) never render. We promote one
 *      of the project's existing gallery images (or a stable Unsplash
 *      photo) into each null field.
 *
 * Safety:
 *   - Only the `projects` table is touched.
 *   - Only image-path / gallery fields are written.
 *   - All affected rows are written to .local/project-images-backup-*.json
 *     before any UPDATE is issued.
 *   - Idempotent: re-running the script on already-clean data reports
 *     "0 repairs" and writes nothing.
 *
 * Run with:  pnpm --filter @workspace/api-server run repair:project-images
 */

import { db, pool } from "@workspace/db";
import { projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ─── Stable Unsplash fallbacks (already used by other projects) ────────────
const F = {
  hero: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1920&auto=format&fit=crop",
  heroAlt1:
    "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1920&auto=format&fit=crop",
  heroAlt2:
    "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=1920&auto=format&fit=crop",
  master:
    "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1920&auto=format&fit=crop",
  floor:
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=1920&auto=format&fit=crop",
  location:
    "https://images.unsplash.com/photo-1524813686514-a57563d77965?q=80&w=1920&auto=format&fit=crop",
  club: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1920&auto=format&fit=crop",
  facilities:
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1920&auto=format&fit=crop",
  construction:
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1920&auto=format&fit=crop",
} as const;

// Any string in this map (when seen anywhere — single field or array entry)
// gets swapped for the corresponding good URL.
const BROKEN_PATH_MAP: Record<string, string> = {
  // unique-new-town
  "img/newtown/banner.jpg": F.hero,
  "img/newtown/banner2.jpg": F.heroAlt1,
  "img/newtown/banner3.jpg": F.heroAlt2,
  "img/newtown/master.jpg": F.master,
  "img/newtown/floorPlan.jpg": F.floor,
  "img/newtown/club.jpg": F.club,
  // is-paradise (these on-disk files DO exist under /img/projects/)
  "img/is/banner1.png": "/img/projects/is-paradise-gallery1.png",
  "img/is/banner2.png": "/img/projects/is-paradise-gallery2.png",
  "img/is/banner3.png": "/img/projects/is-paradise-gallery3.png",
  "img/is/unit.png": "/img/projects/is-paradise-plan2.png",
  "img/is/master.png": "/img/projects/is-paradise-plan1.png",
  // unique-green-meadows
  "img/greenproject1.png": F.hero,
  "img/greenproject2.png": F.heroAlt1,
  "img/greenproject3.png": F.heroAlt2,
  "img/site-plan.jpg": F.master,
  "img/floorPlan1.jpg": F.floor,
  // shared
  "img/cp.jpg": F.club,
  "img/Location-Map.jpg": F.location,
};

const repair = (s: string | null | undefined): string | null => {
  if (!s) return s ?? null;
  return BROKEN_PATH_MAP[s] ?? s;
};

const repairArr = (arr: unknown): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v) => (typeof v === "string" ? repair(v) : null))
    .filter((v): v is string => Boolean(v));
};

// Pick the first gallery URL whose filename matches a keyword.
const pickByKeyword = (urls: string[], kws: string[]): string | undefined =>
  urls.find((u) => {
    const low = u.toLowerCase();
    return kws.some((k) => low.includes(k));
  });

type Row = typeof projectsTable.$inferSelect;
type Patch = Partial<typeof projectsTable.$inferInsert>;

function buildPatch(p: Row): { patch: Patch; changes: string[] } {
  const changes: string[] = [];
  const patch: Patch = {};

  // 1) Sanitize string image fields
  for (const k of [
    "heroImageUrl",
    "heroImage1",
    "heroImage2",
    "heroImage3",
    "logoImage",
    "brochureFile",
    "masterPlanImage",
    "floorPlanImage",
    "exclusiveClubImage",
    "facilitiesNearbyImage",
    "constructionUpdateImage",
    "locationImage",
  ] as const) {
    const cur = p[k];
    const next = repair(cur as string | null);
    if (next !== cur) {
      (patch as Record<string, unknown>)[k] = next;
      changes.push(`${k}: repaired path`);
    }
  }

  // 2) Sanitize array image fields
  for (const k of [
    "galleryImages",
    "planImages",
    "amenityImages",
    "constructionImages",
  ] as const) {
    const cur = (p[k] as string[] | null) ?? [];
    const next = repairArr(cur);
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      (patch as Record<string, unknown>)[k] = next;
      changes.push(`${k}: repaired array`);
    }
  }

  // 3) Promote gallery URLs into NULL structured fields so showcase tabs render.
  const gallery = ((patch.galleryImages as string[] | undefined) ??
    (p.galleryImages as string[] | null) ??
    []) as string[];

  const planArr = ((patch.planImages as string[] | undefined) ??
    (p.planImages as string[] | null) ??
    []) as string[];
  const amenityArr = ((patch.amenityImages as string[] | undefined) ??
    (p.amenityImages as string[] | null) ??
    []) as string[];
  const constructionArr = ((patch.constructionImages as string[] | undefined) ??
    (p.constructionImages as string[] | null) ??
    []) as string[];

  const cur = (k: keyof Row) =>
    ((patch as Record<string, unknown>)[k as string] as string | undefined) ??
    (p[k] as string | null | undefined);

  if (!cur("masterPlanImage")) {
    const v =
      pickByKeyword(gallery, ["master", "site"]) ??
      planArr[0] ??
      gallery[0] ??
      F.master;
    patch.masterPlanImage = v;
    changes.push("masterPlanImage: promoted");
  }
  if (!cur("floorPlanImage")) {
    const v =
      pickByKeyword(gallery, ["floor"]) ??
      planArr[1] ??
      planArr[0] ??
      gallery[1] ??
      F.floor;
    patch.floorPlanImage = v;
    changes.push("floorPlanImage: promoted");
  }
  if (!cur("locationImage")) {
    const v =
      pickByKeyword(gallery, ["location", "map"]) ??
      gallery[0] ??
      F.location;
    patch.locationImage = v;
    changes.push("locationImage: promoted");
  }
  if (!cur("exclusiveClubImage")) {
    const v =
      pickByKeyword(gallery, ["club", "cp"]) ??
      amenityArr[0] ??
      gallery[2] ??
      F.club;
    patch.exclusiveClubImage = v;
    changes.push("exclusiveClubImage: promoted");
  }
  if (!cur("facilitiesNearbyImage")) {
    const v =
      pickByKeyword(gallery, ["amenit", "facilit"]) ??
      amenityArr[1] ??
      amenityArr[0] ??
      gallery[3] ??
      gallery[2] ??
      F.facilities;
    patch.facilitiesNearbyImage = v;
    changes.push("facilitiesNearbyImage: promoted");
  }
  if (!cur("constructionUpdateImage")) {
    const v =
      pickByKeyword(gallery, ["construction", "progress"]) ??
      constructionArr[0] ??
      F.construction;
    patch.constructionUpdateImage = v;
    changes.push("constructionUpdateImage: promoted");
  }

  return { patch, changes };
}

async function main() {
  console.log("[repair-project-images] Loading all projects…");
  const rows = await db.select().from(projectsTable);
  console.log(`[repair-project-images] Loaded ${rows.length} projects.`);

  const plans = rows
    .map((r) => ({ row: r, ...buildPatch(r) }))
    .filter((x) => x.changes.length > 0);

  if (plans.length === 0) {
    console.log("[repair-project-images] All clean — 0 repairs needed.");
    return;
  }

  // Backup affected rows before mutating.
  mkdirSync(".local", { recursive: true });
  const backupPath = join(
    ".local",
    `project-images-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      plans.map((p) => p.row),
      null,
      2,
    ),
  );
  console.log(`[repair-project-images] Backup written → ${backupPath}`);

  // Apply patches and bucket each per-project change into kept/repaired/fallback.
  type Bucket = "kept" | "repaired" | "fallback";
  const FALLBACK_URLS = new Set<string>(Object.values(F));
  const summary: Array<{
    slug: string;
    kept: number;
    repaired: number;
    fallback: number;
    details: string[];
  }> = [];

  for (const { row, patch, changes } of plans) {
    patch.updatedAt = new Date();
    await db
      .update(projectsTable)
      .set(patch)
      .where(eq(projectsTable.id, row.id));

    let kept = 0;
    let repaired = 0;
    let fallback = 0;
    for (const change of changes) {
      const [field] = change.split(":");
      const newVal = (patch as Record<string, unknown>)[field.trim()];
      let bucket: Bucket = "kept";
      if (typeof newVal === "string") {
        bucket = FALLBACK_URLS.has(newVal) ? "fallback" : "repaired";
      } else if (Array.isArray(newVal)) {
        // Arrays are repairs (we only mutate them when something changed).
        bucket = "repaired";
      }
      if (bucket === "kept") kept += 1;
      else if (bucket === "repaired") repaired += 1;
      else fallback += 1;
    }

    summary.push({
      slug: row.slug,
      kept,
      repaired,
      fallback,
      details: changes,
    });
  }

  console.log("");
  console.log(
    "[repair-project-images] Per-project summary (kept / repaired / fallback):",
  );
  console.log("  slug" + " ".repeat(28) + "kept  rep  fb");
  for (const s of summary) {
    console.log(
      `  ${s.slug.padEnd(30)} ${String(s.kept).padStart(4)}  ${String(s.repaired).padStart(3)}  ${String(s.fallback).padStart(2)}`,
    );
  }
  const totals = summary.reduce(
    (a, s) => ({
      kept: a.kept + s.kept,
      repaired: a.repaired + s.repaired,
      fallback: a.fallback + s.fallback,
    }),
    { kept: 0, repaired: 0, fallback: 0 },
  );
  console.log(
    `  ${"TOTAL".padEnd(30)} ${String(totals.kept).padStart(4)}  ${String(totals.repaired).padStart(3)}  ${String(totals.fallback).padStart(2)}`,
  );
  console.log(
    `[repair-project-images] Done. Repaired ${plans.length} of ${rows.length} projects.`,
  );
}

main()
  .catch((err) => {
    console.error("[repair-project-images] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
