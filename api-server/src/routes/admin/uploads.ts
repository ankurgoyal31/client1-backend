import { Router, type Request, type Response } from "express";
import { createReadStream, promises as fsp } from "node:fs";
import { pipeline } from "node:stream/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "../../lib/auth.js";
import { ObjectStorageService } from "../../lib/objectStorage.js";
import { setObjectAclPolicy, type ObjectAclPolicy } from "../../lib/objectAcl.js";
import { compressImage } from "../../lib/mediaCompress/image.js";
import { compressVideo } from "../../lib/mediaCompress/video.js";
import type { File as GcsFile } from "@google-cloud/storage";

const router = Router();
router.use(requireAdmin);

const objectStorageService = new ObjectStorageService();

/**
 * Re-apply the public ACL after an `objectFile.save(...)` overwrite, with a
 * single retry on transient failure. Throws if both attempts fail — the
 * caller should treat this as a finalize failure (because the object would
 * otherwise be silently un-readable to the public).
 */
async function reapplyAclWithRetry(
  objectFile: GcsFile,
  policy: ObjectAclPolicy,
): Promise<void> {
  try {
    await setObjectAclPolicy(objectFile, policy);
  } catch (err) {
    await new Promise((r) => setTimeout(r, 250));
    await setObjectAclPolicy(objectFile, policy);
  }
}

const IMAGE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB (high-quality DSLR / phone photos)
const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB (PDF brochures)
const VIDEO_MAX_BYTES = 1024 * 1024 * 1024; // 1 GB (project walkthrough clips, drone footage)

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
]);

type MediaKind = "image" | "document" | "video";

function classifyContentType(
  contentType: string,
): { kind: MediaKind; max: number } | null {
  if (ALLOWED_IMAGE_TYPES.has(contentType)) return { kind: "image", max: IMAGE_MAX_BYTES };
  if (ALLOWED_DOCUMENT_TYPES.has(contentType))
    return { kind: "document", max: DOCUMENT_MAX_BYTES };
  if (ALLOWED_VIDEO_TYPES.has(contentType)) return { kind: "video", max: VIDEO_MAX_BYTES };
  return null;
}

/**
 * Step 1 (image): client requests a presigned PUT URL for a new image.
 * Kept for backwards compatibility — the /file-url endpoint below
 * handles all media kinds (image, PDF, video).
 */
router.post("/image-url", async (req: Request, res: Response) => {
  await handleUploadUrlRequest(req, res, { kindFilter: "image" });
});

/**
 * Step 1 (any allowed media): generic presigned PUT URL endpoint
 * supporting images, PDF documents, and video files.
 */
router.post("/file-url", async (req: Request, res: Response) => {
  await handleUploadUrlRequest(req, res, { kindFilter: null });
});

async function handleUploadUrlRequest(
  req: Request,
  res: Response,
  opts: { kindFilter: MediaKind | null },
) {
  const { contentType, size } = (req.body ?? {}) as {
    contentType?: unknown;
    size?: unknown;
  };

  if (typeof contentType !== "string") {
    res.status(400).json({ error: "Missing contentType" });
    return;
  }
  const classification = classifyContentType(contentType);
  if (!classification) {
    res.status(400).json({ error: "Unsupported file type" });
    return;
  }
  if (opts.kindFilter && classification.kind !== opts.kindFilter) {
    res.status(400).json({ error: `Unsupported ${opts.kindFilter} type` });
    return;
  }

  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    res.status(400).json({ error: "Invalid file size" });
    return;
  }

  if (size > classification.max) {
    res.status(400).json({
      error: `File is too large (max ${classification.max / (1024 * 1024)}MB for ${classification.kind})`,
    });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, kind: classification.kind });
  } catch (err) {
    req.log.error({ err }, "Failed to generate upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
}

type FinalizeResult = {
  publicURL: string;
  originalBytes: number;
  storedBytes: number;
  compressed: boolean;
  warning?: string;
};

/**
 * Step 2: after the client has PUT the file to the presigned URL,
 * it calls this endpoint with the objectPath. The server:
 *   1. Marks the object publicly readable (blog post images, etc.).
 *   2. Downloads the just-uploaded object, runs a visually-lossless
 *      re-encode (image → sharp, video → ffmpeg) and overwrites the
 *      same object with the smaller bytes if the compressed version
 *      is actually smaller.
 *   3. Returns size info so the admin UI can show the savings.
 *
 * Compression is best-effort: any failure (corrupt file, unsupported
 * codec, ffmpeg timeout, …) leaves the original upload in place and
 * surfaces a `warning` field; the upload itself never fails because of
 * compression.
 */
async function finalizeHandler(req: Request, res: Response) {
  const { objectPath } = (req.body ?? {}) as { objectPath?: unknown };

  if (typeof objectPath !== "string" || !objectPath.startsWith("/objects/")) {
    res.status(400).json({ error: "Invalid objectPath" });
    return;
  }

  const adminId = req.admin?.id;
  if (!adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let normalized: string;
  try {
    normalized = await objectStorageService.trySetObjectEntityAclPolicy(
      objectPath,
      { owner: String(adminId), visibility: "public" },
    );
  } catch (err) {
    req.log.error({ err }, "Failed to finalize upload");
    res.status(500).json({ error: "Failed to finalize upload" });
    return;
  }

  const publicURL = `/api/storage${normalized}`;

  let result: FinalizeResult = {
    publicURL,
    originalBytes: 0,
    storedBytes: 0,
    compressed: false,
  };

  try {
    const objectFile = await objectStorageService.getObjectEntityFile(normalized);
    const [metadata] = await objectFile.getMetadata();
    const contentType = String(metadata.contentType ?? "application/octet-stream");
    const originalBytes = Number(metadata.size ?? 0);

    result.originalBytes = originalBytes;
    result.storedBytes = originalBytes;

    const aclPolicy = {
      owner: String(adminId),
      visibility: "public" as const,
    };

    let restoreFailed = false;

    const classification = classifyContentType(contentType);
    if (!classification) {
      req.log.info(
        {
          kind: "unknown",
          contentType,
          originalBytes,
          storedBytes: originalBytes,
          compressed: false,
        },
        "Upload finalized (unsupported content type)",
      );
    } else if (classification.kind === "image") {
      let originalBuffer: Buffer | null = null;
      try {
        [originalBuffer] = await objectFile.download();
      } catch (err) {
        req.log.warn(
          { err, kind: "image", contentType, originalBytes },
          "Could not download upload for compression — keeping original",
        );
        result.warning = "Image compression failed — original kept";
      }

      if (originalBuffer) {
        let compressed: Awaited<ReturnType<typeof compressImage>> | null = null;
        try {
          compressed = await compressImage(originalBuffer, contentType);
        } catch (err) {
          req.log.warn(
            { err, kind: "image", contentType, originalBytes },
            "Image compression failed — keeping original",
          );
          result.warning = "Image compression failed — original kept";
        }

        if (compressed && !compressed.skipped) {
          try {
            await objectFile.save(compressed.buffer, {
              contentType: compressed.contentType,
              resumable: false,
              metadata: { contentType: compressed.contentType },
            });
            await reapplyAclWithRetry(objectFile, aclPolicy);
            result.storedBytes = compressed.compressedBytes;
            result.compressed = true;
          } catch (overwriteErr) {
            // Mutation started; restore the original bytes so the public
            // URL stays usable. If restore also fails the object is in
            // an unknown state and we must surface a hard 500.
            try {
              await objectFile.save(originalBuffer, {
                contentType,
                resumable: false,
                metadata: { contentType },
              });
              await reapplyAclWithRetry(objectFile, aclPolicy);
              req.log.warn(
                { err: overwriteErr, kind: "image", contentType, originalBytes },
                "Image overwrite failed — original bytes restored",
              );
              result.warning = "Image compression failed — original kept";
            } catch (restoreErr) {
              req.log.error(
                { overwriteErr, restoreErr, kind: "image", contentType, originalBytes },
                "Image overwrite + restore both failed — object may be unreadable",
              );
              restoreFailed = true;
            }
          }
        }
      }

      if (!restoreFailed) {
        req.log.info(
          {
            kind: "image",
            contentType,
            originalBytes,
            storedBytes: result.storedBytes,
            compressed: result.compressed,
            warning: result.warning,
          },
          "Image upload finalized",
        );
      }
    } else if (classification.kind === "video") {
      const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "vidcomp-"));
      const inputPath = path.join(tmpDir, `in-${randomUUID()}`);
      const outputPath = path.join(tmpDir, `out-${randomUUID()}.mp4`);
      try {
        let downloaded = true;
        try {
          await objectFile.download({ destination: inputPath });
        } catch (err) {
          downloaded = false;
          req.log.warn(
            { err, kind: "video", contentType, originalBytes },
            "Could not download upload for compression — keeping original",
          );
          result.warning = "Video compression failed — original kept";
        }

        if (downloaded) {
          let compressed: Awaited<ReturnType<typeof compressVideo>> | null = null;
          try {
            compressed = await compressVideo(inputPath, outputPath);
          } catch (err) {
            req.log.warn(
              { err, kind: "video", contentType, originalBytes },
              "Video compression failed — keeping original",
            );
            result.warning = "Video compression failed — original kept";
          }

          if (compressed && !compressed.skipped) {
            try {
              const writeStream = objectFile.createWriteStream({
                contentType: "video/mp4",
                resumable: true,
                metadata: { contentType: "video/mp4" },
              });
              await pipeline(createReadStream(outputPath), writeStream);
              await reapplyAclWithRetry(objectFile, aclPolicy);
              result.storedBytes = compressed.compressedBytes;
              result.compressed = true;
            } catch (overwriteErr) {
              try {
                const restoreStream = objectFile.createWriteStream({
                  contentType,
                  resumable: true,
                  metadata: { contentType },
                });
                await pipeline(createReadStream(inputPath), restoreStream);
                await reapplyAclWithRetry(objectFile, aclPolicy);
                req.log.warn(
                  { err: overwriteErr, kind: "video", contentType, originalBytes },
                  "Video overwrite failed — original bytes restored",
                );
                result.warning = "Video compression failed — original kept";
              } catch (restoreErr) {
                req.log.error(
                  { overwriteErr, restoreErr, kind: "video", contentType, originalBytes },
                  "Video overwrite + restore both failed — object may be unreadable",
                );
                restoreFailed = true;
              }
            }
          }
        }

        if (!restoreFailed) {
          req.log.info(
            {
              kind: "video",
              contentType,
              originalBytes,
              storedBytes: result.storedBytes,
              compressed: result.compressed,
              warning: result.warning,
            },
            "Video upload finalized",
          );
        }
      } finally {
        await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } else {
      req.log.info(
        {
          kind: classification.kind,
          contentType,
          originalBytes,
          storedBytes: originalBytes,
          compressed: false,
        },
        "Upload finalized (no compression)",
      );
    }

    if (restoreFailed) {
      res.status(500).json({
        error:
          "Upload finalize failed; the file may be unreadable. Please re-upload.",
      });
      return;
    }
  } catch (err) {
    // The object is already publicly readable from step 1, so any
    // unexpected error here is reported as a soft warning rather than
    // failing the upload.
    req.log.error({ err }, "Compression pipeline error — original upload kept");
    if (!result.warning) {
      result.warning = "Compression failed — original kept";
    }
  }

  res.json({
    objectPath: normalized,
    publicURL: result.publicURL,
    originalBytes: result.originalBytes,
    storedBytes: result.storedBytes,
    compressed: result.compressed,
    ...(result.warning ? { warning: result.warning } : {}),
  });
}

router.post("/image-finalize", finalizeHandler);
router.post("/file-finalize", finalizeHandler);

export default router;
