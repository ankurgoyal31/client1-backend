/**
 * One-shot, idempotent backfill that re-compresses media uploaded before the
 * upload pipeline started running compression on every new file (task #72).
 *
 * For every object under `<PRIVATE_OBJECT_DIR>/uploads/`:
 *   1. Read the object's metadata (content-type, size, ACL).
 *   2. If the content-type is a supported image or video, download the bytes,
 *      run the same compression helper used by the upload route, and overwrite
 *      the object in place when the compressed result is actually smaller.
 *   3. Re-apply the original ACL policy (`custom:aclPolicy`) so visibility is
 *      preserved across the overwrite.
 *
 * Safety:
 *   - The object's path / public URL never changes, so existing CMS references
 *     keep working.
 *   - Every overwrite has a restore-on-failure fallback that writes the
 *     original bytes back if the compressed save throws partway through.
 *   - Idempotent: re-running on already-compressed objects is a no-op
 *     (the compress helpers return `skipped: true` when re-encoding would
 *     not produce a smaller file).
 *   - `--dry-run` runs the full pipeline without writing anything back to
 *     storage. Use it first to estimate savings.
 *
 * Per-object lines look like:
 *   [backfill] uploads/<id>  image/jpeg  orig=812.3KB  stored=412.1KB  saved=49.3%  COMPRESSED
 *
 * Final report shows total bytes saved.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server run backfill:compression
 *   pnpm --filter @workspace/api-server run backfill:compression -- --dry-run
 *   pnpm --filter @workspace/api-server run backfill:compression -- --limit=10
 */

import { createReadStream, promises as fsp } from "node:fs";
import { pipeline } from "node:stream/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { File as GcsFile } from "@google-cloud/storage";
import { objectStorageClient } from "../lib/objectStorage.js";
import {
  getObjectAclPolicy,
  setObjectAclPolicy,
  type ObjectAclPolicy,
} from "../lib/objectAcl.js";
import { compressImage } from "../lib/mediaCompress/image.js";
import { compressVideo } from "../lib/mediaCompress/video.js";

// ─── CLI flags ─────────────────────────────────────────────────────────────

type Flags = {
  dryRun: boolean;
  limit: number | null;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, limit: null };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) {
        flags.limit = Math.floor(n);
      }
    }
  }
  return flags;
}

// ─── Storage path helpers ──────────────────────────────────────────────────

function getPrivateUploadsLocation(): {
  bucketName: string;
  prefix: string;
} {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error(
      "PRIVATE_OBJECT_DIR not set. Configure object storage before running this script.",
    );
  }
  const trimmed = dir.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error(
      `PRIVATE_OBJECT_DIR is malformed: ${dir} (expected /<bucket> or /<bucket>/<path>)`,
    );
  }
  const parts = trimmed.split("/");
  const bucketName = parts[0];
  const objectPrefix = parts.slice(1).join("/");
  // Both `/<bucket>` (no inner path) and `/<bucket>/<path>` are accepted.
  const prefix = objectPrefix
    ? `${objectPrefix}/uploads/`
    : `uploads/`;
  return { bucketName, prefix };
}

// ─── Content-type classification (mirrors uploads.ts) ──────────────────────

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
]);

type MediaKind = "image" | "video" | "skip";

function classify(contentType: string): MediaKind {
  const ct = contentType.toLowerCase();
  if (ALLOWED_IMAGE_TYPES.has(ct)) return "image";
  if (ALLOWED_VIDEO_TYPES.has(ct)) return "video";
  return "skip";
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

// ─── ACL preservation ──────────────────────────────────────────────────────

async function reapplyAclWithRetry(
  objectFile: GcsFile,
  policy: ObjectAclPolicy,
): Promise<void> {
  try {
    await setObjectAclPolicy(objectFile, policy);
  } catch {
    await new Promise((r) => setTimeout(r, 250));
    await setObjectAclPolicy(objectFile, policy);
  }
}

// ─── Per-object processors ─────────────────────────────────────────────────

type ObjectOutcome =
  | { status: "compressed"; originalBytes: number; storedBytes: number }
  | { status: "skipped"; originalBytes: number; reason: string }
  | { status: "failed"; originalBytes: number; reason: string };

async function processImage(
  objectFile: GcsFile,
  contentType: string,
  originalBytes: number,
  acl: ObjectAclPolicy | null,
  flags: Flags,
): Promise<ObjectOutcome> {
  let buffer: Buffer;
  try {
    [buffer] = await objectFile.download();
  } catch (err) {
    return {
      status: "failed",
      originalBytes,
      reason: `download failed: ${(err as Error).message}`,
    };
  }

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

  if (compressed.skipped || compressed.compressedBytes >= buffer.length) {
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

  try {
    await objectFile.save(compressed.buffer, {
      contentType: compressed.contentType,
      resumable: false,
      metadata: { contentType: compressed.contentType },
    });
    if (acl) {
      await reapplyAclWithRetry(objectFile, acl);
    }
    return {
      status: "compressed",
      originalBytes,
      storedBytes: compressed.compressedBytes,
    };
  } catch (overwriteErr) {
    try {
      await objectFile.save(buffer, {
        contentType,
        resumable: false,
        metadata: { contentType },
      });
      if (acl) {
        await reapplyAclWithRetry(objectFile, acl);
      }
    } catch (restoreErr) {
      return {
        status: "failed",
        originalBytes,
        reason: `overwrite + restore both failed: ${(overwriteErr as Error).message} / ${(restoreErr as Error).message}`,
      };
    }
    return {
      status: "failed",
      originalBytes,
      reason: `overwrite failed (original restored): ${(overwriteErr as Error).message}`,
    };
  }
}

async function processVideo(
  objectFile: GcsFile,
  contentType: string,
  originalBytes: number,
  acl: ObjectAclPolicy | null,
  flags: Flags,
): Promise<ObjectOutcome> {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "vidback-"));
  const inputPath = path.join(tmpDir, `in-${randomUUID()}`);
  const outputPath = path.join(tmpDir, `out-${randomUUID()}.mp4`);

  try {
    try {
      await objectFile.download({ destination: inputPath });
    } catch (err) {
      return {
        status: "failed",
        originalBytes,
        reason: `download failed: ${(err as Error).message}`,
      };
    }

    let compressed: Awaited<ReturnType<typeof compressVideo>>;
    try {
      compressed = await compressVideo(inputPath, outputPath);
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

    try {
      const writeStream = objectFile.createWriteStream({
        contentType: "video/mp4",
        resumable: true,
        metadata: { contentType: "video/mp4" },
      });
      await pipeline(createReadStream(outputPath), writeStream);
      if (acl) {
        await reapplyAclWithRetry(objectFile, acl);
      }
      return {
        status: "compressed",
        originalBytes,
        storedBytes: compressed.compressedBytes,
      };
    } catch (overwriteErr) {
      try {
        const restoreStream = objectFile.createWriteStream({
          contentType,
          resumable: true,
          metadata: { contentType },
        });
        await pipeline(createReadStream(inputPath), restoreStream);
        if (acl) {
          await reapplyAclWithRetry(objectFile, acl);
        }
      } catch (restoreErr) {
        return {
          status: "failed",
          originalBytes,
          reason: `overwrite + restore both failed: ${(overwriteErr as Error).message} / ${(restoreErr as Error).message}`,
        };
      }
      return {
        status: "failed",
        originalBytes,
        reason: `overwrite failed (original restored): ${(overwriteErr as Error).message}`,
      };
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Driver ────────────────────────────────────────────────────────────────

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const { bucketName, prefix } = getPrivateUploadsLocation();

  console.log(
    `[backfill-compression] Scanning gs://${bucketName}/${prefix}` +
      (flags.dryRun ? "  (dry-run, no writes)" : "") +
      (flags.limit ? `  (limit=${flags.limit})` : ""),
  );

  const bucket = objectStorageClient.bucket(bucketName);

  let totalOriginal = 0;
  let totalStored = 0;
  let compressedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let processed = 0;

  // Stream the listing instead of loading every File into memory at once,
  // so this scales to buckets with very large numbers of uploads. The
  // underlying client still pages internally; we just consume one page
  // at a time.
  const stream = bucket.getFilesStream({ prefix });

  for await (const file of stream as AsyncIterable<GcsFile>) {
    if (flags.limit !== null && processed >= flags.limit) {
      stream.destroy();
      break;
    }
    processed += 1;

    const shortName = file.name.startsWith(prefix)
      ? file.name.slice(prefix.length - "uploads/".length)
      : file.name;

    let metadata: { contentType?: unknown; size?: unknown };
    try {
      const [m] = await file.getMetadata();
      metadata = m as { contentType?: unknown; size?: unknown };
    } catch (err) {
      failedCount += 1;
      console.log(
        `[backfill] ${shortName}  metadata fetch failed: ${(err as Error).message}`,
      );
      continue;
    }

    const contentType = String(
      metadata.contentType ?? "application/octet-stream",
    );
    const originalBytes = Number(metadata.size ?? 0);
    const kind = classify(contentType);

    if (originalBytes <= 0) {
      skippedCount += 1;
      console.log(
        `[backfill] ${shortName}  ${contentType}  empty object — skipped`,
      );
      continue;
    }

    if (kind === "skip") {
      skippedCount += 1;
      totalOriginal += originalBytes;
      totalStored += originalBytes;
      console.log(
        `[backfill] ${shortName}  ${contentType}  size=${fmtBytes(originalBytes)}  unsupported — skipped`,
      );
      continue;
    }

    // Read the ACL policy *before* any overwrite so we can faithfully
    // restore it afterwards. If the read itself fails we must not proceed
    // — overwriting and losing the existing policy could change the
    // object's effective access (e.g. silently flipping public → private).
    let acl: ObjectAclPolicy | null;
    try {
      acl = await getObjectAclPolicy(file);
    } catch (err) {
      failedCount += 1;
      totalOriginal += originalBytes;
      totalStored += originalBytes;
      console.log(
        `[backfill] ${shortName}  ${contentType}  orig=${fmtBytes(originalBytes)}  FAILED: ACL read error — ${(err as Error).message}`,
      );
      continue;
    }

    const outcome =
      kind === "image"
        ? await processImage(file, contentType, originalBytes, acl, flags)
        : await processVideo(file, contentType, originalBytes, acl, flags);

    totalOriginal += outcome.originalBytes;

    if (outcome.status === "compressed") {
      compressedCount += 1;
      totalStored += outcome.storedBytes;
      const saved = outcome.originalBytes - outcome.storedBytes;
      console.log(
        `[backfill] ${shortName}  ${contentType}  orig=${fmtBytes(outcome.originalBytes)}  stored=${fmtBytes(outcome.storedBytes)}  saved=${fmtBytes(saved)} (${fmtPct(saved, outcome.originalBytes)})  ${flags.dryRun ? "DRY-RUN" : "COMPRESSED"}`,
      );
    } else if (outcome.status === "skipped") {
      skippedCount += 1;
      totalStored += outcome.originalBytes;
      console.log(
        `[backfill] ${shortName}  ${contentType}  orig=${fmtBytes(outcome.originalBytes)}  ${outcome.reason} — skipped`,
      );
    } else {
      failedCount += 1;
      totalStored += outcome.originalBytes;
      console.log(
        `[backfill] ${shortName}  ${contentType}  orig=${fmtBytes(outcome.originalBytes)}  FAILED: ${outcome.reason}`,
      );
    }
  }

  const saved = totalOriginal - totalStored;
  console.log("");
  console.log("[backfill-compression] ─── Report ─────────────────────────");
  console.log(`  Objects scanned:     ${processed}`);
  console.log(`  Compressed:          ${compressedCount}`);
  console.log(`  Skipped (no win):    ${skippedCount}`);
  console.log(`  Failed:              ${failedCount}`);
  console.log(`  Total original size: ${fmtBytes(totalOriginal)}`);
  console.log(`  Total stored size:   ${fmtBytes(totalStored)}`);
  console.log(
    `  Total bytes saved:   ${fmtBytes(saved)} (${fmtPct(saved, totalOriginal)})`,
  );
  if (flags.dryRun) {
    console.log("  NOTE: --dry-run was set. Nothing was written to storage.");
  }
}

main()
  .catch((err) => {
    console.error("[backfill-compression] FAILED:", err);
    process.exitCode = 1;
  });
