// Generate `<name>.webp` siblings for every JPG / JPEG / PNG under
// `artifacts/unique-builders/public/img/` so the marketing site can serve
// WebP via `<picture>` with a guaranteed-present sibling. Writes are
// idempotent (skipped when the existing webp is at least as new as the
// source) and atomic (.tmp + rename). Source files are never modified.
//
// Run with:
//   pnpm --filter @workspace/api-server run generate:public-webp
//   pnpm --filter @workspace/api-server run generate:public-webp -- --dry-run
//   pnpm --filter @workspace/api-server run generate:public-webp -- --dir=/abs/path

import { promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compressImage } from "../lib/mediaCompress/image.js";

// ─── CLI flags ─────────────────────────────────────────────────────────────

type Flags = {
  dryRun: boolean;
  dir: string;
};

function defaultTargetDir(): string {
  // This file lives at artifacts/api-server/src/scripts/. Walk up to the
  // monorepo root, then into the unique-builders public/img directory.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(
    here,
    "..",
    "..",
    "..",
    "unique-builders",
    "public",
    "img",
  );
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, dir: defaultTargetDir() };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg.startsWith("--dir=")) {
      const v = arg.slice("--dir=".length);
      if (v) {
        flags.dir = path.resolve(v);
      }
    }
  }
  return flags;
}

// ─── Content-type classification ───────────────────────────────────────────

const ENCODABLE_EXTENSIONS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function sourceContentTypeForFile(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return ENCODABLE_EXTENSIONS[ext] ?? null;
}

function webpSiblingPath(filePath: string): string {
  const ext = path.extname(filePath);
  return `${filePath.slice(0, filePath.length - ext.length)}.webp`;
}

// ─── Pretty-print helpers ──────────────────────────────────────────────────

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)}${units[i]}`;
}

function fmtPct(numer: number, denom: number): string {
  if (denom <= 0) return "0%";
  return `${((numer / denom) * 100).toFixed(1)}%`;
}

// ─── Filesystem walk ───────────────────────────────────────────────────────

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    throw new Error(
      `Cannot read directory ${dir}: ${(err as Error).message}`,
    );
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

// ─── Per-file processor ────────────────────────────────────────────────────

type FileOutcome =
  | { status: "wrote"; sourceBytes: number; webpBytes: number }
  | { status: "up-to-date"; sourceBytes: number; webpBytes: number }
  | { status: "failed"; sourceBytes: number; reason: string };

async function processFile(
  filePath: string,
  contentType: string,
  flags: Flags,
): Promise<FileOutcome> {
  const webpPath = webpSiblingPath(filePath);

  let sourceStat;
  try {
    sourceStat = await fsp.stat(filePath);
  } catch (err) {
    return {
      status: "failed",
      sourceBytes: 0,
      reason: `stat source failed: ${(err as Error).message}`,
    };
  }
  const sourceBytes = sourceStat.size;

  // Idempotency: an existing webp at least as new as the source is left
  // alone. We do NOT compare sizes — every supported source must have a
  // sibling so PictureWithWebp's <source srcSet=...webp> never 404s.
  try {
    const webpStat = await fsp.stat(webpPath);
    if (webpStat.mtimeMs >= sourceStat.mtimeMs) {
      return {
        status: "up-to-date",
        sourceBytes,
        webpBytes: webpStat.size,
      };
    }
  } catch {
    // No sibling yet — fall through and encode.
  }

  let buffer: Buffer;
  try {
    buffer = await fsp.readFile(filePath);
  } catch (err) {
    return {
      status: "failed",
      sourceBytes,
      reason: `read failed: ${(err as Error).message}`,
    };
  }

  // compressImage(buf, "image/webp") runs sharp(buf).webp(...) which
  // transcodes any decodable input (JPEG, PNG, ...) to WebP.
  let encoded: Awaited<ReturnType<typeof compressImage>>;
  try {
    encoded = await compressImage(buffer, "image/webp");
  } catch (err) {
    return {
      status: "failed",
      sourceBytes,
      reason: `encode failed: ${(err as Error).message}`,
    };
  }

  // compressImage marks `skipped: true` when its re-encode is not smaller
  // than the input buffer; in that case `encoded.buffer` is the original
  // input we just passed in (not a real WebP). For sources that don't
  // shrink we still want a real WebP sibling on disk, so re-encode via
  // sharp directly to bypass compressImage's internal "no-win" guard.
  let webpBuffer: Buffer;
  let webpBytes: number;
  if (encoded.skipped) {
    const sharp = (await import("sharp")).default;
    webpBuffer = await sharp(buffer).webp().toBuffer();
    webpBytes = webpBuffer.length;
  } else {
    webpBuffer = encoded.buffer;
    webpBytes = encoded.compressedBytes;
  }

  if (flags.dryRun) {
    return { status: "wrote", sourceBytes, webpBytes };
  }

  const tmpPath = `${webpPath}.tmp-${process.pid}`;
  try {
    await fsp.writeFile(tmpPath, webpBuffer);
    await fsp.rename(tmpPath, webpPath);
    return { status: "wrote", sourceBytes, webpBytes };
  } catch (err) {
    await fsp.rm(tmpPath, { force: true }).catch(() => {});
    return {
      status: "failed",
      sourceBytes,
      reason: `write failed: ${(err as Error).message}`,
    };
  }
}

// ─── Driver ────────────────────────────────────────────────────────────────

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  try {
    const stat = await fsp.stat(flags.dir);
    if (!stat.isDirectory()) {
      throw new Error(`${flags.dir} is not a directory`);
    }
  } catch (err) {
    console.error(
      `[generate-public-webp] Cannot access ${flags.dir}: ${(err as Error).message}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[generate-public-webp] Scanning ${flags.dir}` +
      (flags.dryRun ? "  (dry-run, no writes)" : ""),
  );

  let totalSource = 0;
  let totalWebp = 0;
  let wroteCount = 0;
  let upToDateCount = 0;
  let unsupportedCount = 0;
  let failedCount = 0;
  let processed = 0;

  for await (const filePath of walk(flags.dir)) {
    const rel = path.relative(flags.dir, filePath);
    const contentType = sourceContentTypeForFile(filePath);

    if (!contentType) {
      unsupportedCount += 1;
      continue;
    }

    processed += 1;

    const outcome = await processFile(filePath, contentType, flags);

    totalSource += outcome.sourceBytes;

    if (outcome.status === "wrote") {
      wroteCount += 1;
      totalWebp += outcome.webpBytes;
      const saved = outcome.sourceBytes - outcome.webpBytes;
      console.log(
        `[public-webp] ${rel} → ${path.basename(webpSiblingPath(rel))}  src=${fmtBytes(outcome.sourceBytes)}  webp=${fmtBytes(outcome.webpBytes)}  saved=${fmtBytes(saved)} (${fmtPct(saved, outcome.sourceBytes)})  ${flags.dryRun ? "DRY-RUN" : "WROTE"}`,
      );
    } else if (outcome.status === "up-to-date") {
      upToDateCount += 1;
      totalWebp += outcome.webpBytes;
      console.log(
        `[public-webp] ${rel}  src=${fmtBytes(outcome.sourceBytes)}  webp=${fmtBytes(outcome.webpBytes)}  up-to-date`,
      );
    } else {
      failedCount += 1;
      totalWebp += outcome.sourceBytes;
      console.log(
        `[public-webp] ${rel}  src=${fmtBytes(outcome.sourceBytes)}  FAILED: ${outcome.reason}`,
      );
    }
  }

  const saved = totalSource - totalWebp;
  console.log("");
  console.log("[generate-public-webp] ─── Report ─────────────────────────");
  console.log(`  Files scanned:           ${processed}`);
  console.log(`  Wrote new/updated WebP:  ${wroteCount}`);
  console.log(`  Already up-to-date:      ${upToDateCount}`);
  console.log(`  Failed:                  ${failedCount}`);
  console.log(`  Unsupported (skipped):   ${unsupportedCount}`);
  console.log(`  Total source size:       ${fmtBytes(totalSource)}`);
  console.log(`  Total WebP-served size:  ${fmtBytes(totalWebp)}`);
  console.log(
    `  Bytes saved on WebP path: ${fmtBytes(saved)} (${fmtPct(saved, totalSource)})`,
  );
  if (flags.dryRun) {
    console.log("  NOTE: --dry-run was set. Nothing was written to disk.");
  }
}

main().catch((err) => {
  console.error("[generate-public-webp] FAILED:", err);
  process.exitCode = 1;
});
