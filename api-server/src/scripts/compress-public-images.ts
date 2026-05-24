/**
 * One-shot, idempotent re-compression of the static images shipped with the
 * marketing site under `artifacts/unique-builders/public/img/`.
 *
 * The upload pipeline (task #72) and the storage backfill (task #73) only
 * touch files in object storage. The site itself ships a separate set of
 * pre-existing JPEG / PNG / WebP assets that have never been compressed.
 * Many are well over 500KB and slow down every public page load.
 *
 * For each supported image under the target directory:
 *   1. Read the file from disk.
 *   2. Run the same `compressImage` helper used by the upload route.
 *   3. Overwrite the file in place when (and only when) the compressed
 *      buffer is strictly smaller. The file extension is preserved.
 *
 * Safety / idempotency:
 *   - File paths and extensions never change, so HTML / CSS references keep
 *     working unmodified.
 *   - `compressImage` returns `skipped: true` when re-encoding would not
 *     produce a smaller file, so re-running is a no-op for already
 *     compressed images.
 *   - Each overwrite uses a `<file>.tmp` sibling + atomic rename so the
 *     original is never partially written.
 *   - SVG / GIF (and any other unsupported types) pass through untouched.
 *   - `--dry-run` runs the full pipeline without writing anything to disk.
 *     Use it first to estimate savings.
 *
 * Per-file lines look like:
 *   [compress-public] about/management2.jpg  image/jpeg  orig=14.2MB  stored=2.1MB  saved=85.2%  COMPRESSED
 *
 * Final report shows total bytes saved.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server run compress:public-images
 *   pnpm --filter @workspace/api-server run compress:public-images -- --dry-run
 *   pnpm --filter @workspace/api-server run compress:public-images -- --dir=/abs/path/to/img
 */

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

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function contentTypeForFile(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_CONTENT_TYPE[ext] ?? null;
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
  | { status: "compressed"; originalBytes: number; storedBytes: number }
  | { status: "skipped"; originalBytes: number; reason: string }
  | { status: "failed"; originalBytes: number; reason: string };

async function processFile(
  filePath: string,
  contentType: string,
  flags: Flags,
): Promise<FileOutcome> {
  let buffer: Buffer;
  try {
    buffer = await fsp.readFile(filePath);
  } catch (err) {
    return {
      status: "failed",
      originalBytes: 0,
      reason: `read failed: ${(err as Error).message}`,
    };
  }

  const originalBytes = buffer.length;

  let compressed: Awaited<ReturnType<typeof compressImage>>;
  try {
    compressed = await compressImage(buffer, contentType);
  } catch (err) {
    return {
      status: "failed",
      originalBytes,
      reason: `compress failed: ${(err as Error).message}`,
    };
  }

  if (compressed.skipped || compressed.compressedBytes >= originalBytes) {
    return {
      status: "skipped",
      originalBytes,
      reason: "no smaller output",
    };
  }

  if (flags.dryRun) {
    return {
      status: "compressed",
      originalBytes,
      storedBytes: compressed.compressedBytes,
    };
  }

  // Atomic overwrite: write to a sibling tmp file, then rename. This ensures
  // the original is never partially written if the process is killed.
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  try {
    await fsp.writeFile(tmpPath, compressed.buffer);
    await fsp.rename(tmpPath, filePath);
    return {
      status: "compressed",
      originalBytes,
      storedBytes: compressed.compressedBytes,
    };
  } catch (err) {
    await fsp.rm(tmpPath, { force: true }).catch(() => {});
    return {
      status: "failed",
      originalBytes,
      reason: `write failed: ${(err as Error).message}`,
    };
  }
}

// ─── Driver ────────────────────────────────────────────────────────────────

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  // Make sure the directory exists before we start walking it.
  try {
    const stat = await fsp.stat(flags.dir);
    if (!stat.isDirectory()) {
      throw new Error(`${flags.dir} is not a directory`);
    }
  } catch (err) {
    console.error(
      `[compress-public-images] Cannot access ${flags.dir}: ${(err as Error).message}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[compress-public-images] Scanning ${flags.dir}` +
      (flags.dryRun ? "  (dry-run, no writes)" : ""),
  );

  let totalOriginal = 0;
  let totalStored = 0;
  let compressedCount = 0;
  let skippedCount = 0;
  let unsupportedCount = 0;
  let failedCount = 0;
  let processed = 0;

  for await (const filePath of walk(flags.dir)) {
    const rel = path.relative(flags.dir, filePath);
    const contentType = contentTypeForFile(filePath);

    if (!contentType) {
      unsupportedCount += 1;
      continue;
    }

    processed += 1;

    const outcome = await processFile(filePath, contentType, flags);

    totalOriginal += outcome.originalBytes;

    if (outcome.status === "compressed") {
      compressedCount += 1;
      totalStored += outcome.storedBytes;
      const saved = outcome.originalBytes - outcome.storedBytes;
      console.log(
        `[compress-public] ${rel}  ${contentType}  orig=${fmtBytes(outcome.originalBytes)}  stored=${fmtBytes(outcome.storedBytes)}  saved=${fmtBytes(saved)} (${fmtPct(saved, outcome.originalBytes)})  ${flags.dryRun ? "DRY-RUN" : "COMPRESSED"}`,
      );
    } else if (outcome.status === "skipped") {
      skippedCount += 1;
      totalStored += outcome.originalBytes;
      console.log(
        `[compress-public] ${rel}  ${contentType}  orig=${fmtBytes(outcome.originalBytes)}  ${outcome.reason} — skipped`,
      );
    } else {
      failedCount += 1;
      totalStored += outcome.originalBytes;
      console.log(
        `[compress-public] ${rel}  ${contentType}  orig=${fmtBytes(outcome.originalBytes)}  FAILED: ${outcome.reason}`,
      );
    }
  }

  const saved = totalOriginal - totalStored;
  console.log("");
  console.log("[compress-public-images] ─── Report ─────────────────────────");
  console.log(`  Files scanned:       ${processed}`);
  console.log(`  Compressed:          ${compressedCount}`);
  console.log(`  Skipped (no win):    ${skippedCount}`);
  console.log(`  Failed:              ${failedCount}`);
  console.log(`  Unsupported (skip):  ${unsupportedCount}`);
  console.log(`  Total original size: ${fmtBytes(totalOriginal)}`);
  console.log(`  Total stored size:   ${fmtBytes(totalStored)}`);
  console.log(
    `  Total bytes saved:   ${fmtBytes(saved)} (${fmtPct(saved, totalOriginal)})`,
  );
  if (flags.dryRun) {
    console.log("  NOTE: --dry-run was set. Nothing was written to disk.");
  }
}

main().catch((err) => {
  console.error("[compress-public-images] FAILED:", err);
  process.exitCode = 1;
});
