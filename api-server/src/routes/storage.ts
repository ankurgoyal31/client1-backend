import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { ObjectPermission } from "../lib/objectAcl.js";
import path from "node:path";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * Serves a private object entity (uploaded via presigned URL).
 *
 * Access is gated by the object's stored ACL policy:
 *   - "public" visibility — anyone may read (e.g. blog images)
 *   - otherwise — denied (this route does not currently support
 *     authenticated reads of private objects)
 *
 * Objects with no policy are also denied so that ACL omissions fail
 * closed instead of leaking the entire private namespace.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  const USE_LOCAL_STORAGE = process.env.STORAGE_PROVIDER === "local" || !process.env.REPL_ID;

  if (USE_LOCAL_STORAGE) {
    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const parts = wildcardPath.split("/");
      const objectId = parts[parts.length - 1];

      const UPLOADS_DIR = path.join(process.cwd(), "uploads");
      const PUBLIC_DIR = path.join(UPLOADS_DIR, "public");
      const filePath = path.join(PUBLIC_DIR, objectId);
      const metadataPath = path.join(PUBLIC_DIR, `${objectId}.json`);

      const fs = await import("node:fs");
      if (!fs.existsSync(filePath) || !fs.existsSync(metadataPath)) {
        res.status(404).json({ error: "Object not found" });
        return;
      }

      const fsp = fs.promises;
      const metadataContent = await fsp.readFile(metadataPath, "utf8");
      const metadata = JSON.parse(metadataContent);

      res.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=3600");

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
      return;
    } catch (error) {
      req.log.error({ err: error }, "Error serving local object");
      res.status(500).json({ error: "Failed to serve object" });
      return;
    }
  }

  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const canRead = await objectStorageService.canAccessObjectEntity({
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canRead) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
