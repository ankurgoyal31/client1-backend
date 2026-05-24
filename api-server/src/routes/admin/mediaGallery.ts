import { Router } from "express";
import { db } from "@workspace/db";
import { galleryImagesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";
import { validateUrlFields } from "../../lib/validation.js";

const router = Router();
router.use(requireAdmin);

const URL_FIELDS = ["imageUrl", "videoUrl"] as const;
const ALLOWED_FIELDS = [
  "mediaType",
  "imageUrl",
  "videoUrl",
  "caption",
  "sortOrder",
  "isActive",
] as const;
const ALLOWED_MEDIA_TYPES = ["image", "video"] as const;

function pickAllowed(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

router.get("/", async (_req, res) => {
  try {
    const images = await db
      .select()
      .from(galleryImagesTable)
      .orderBy(asc(galleryImagesTable.sortOrder));
    res.json({ data: images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch gallery" });
  }
});

function validateMediaType(body: Record<string, unknown>): string | null {
  if (body.mediaType === undefined) return null;
  if (
    typeof body.mediaType !== "string" ||
    !ALLOWED_MEDIA_TYPES.includes(body.mediaType as (typeof ALLOWED_MEDIA_TYPES)[number])
  ) {
    return "mediaType must be 'image' or 'video'";
  }
  return null;
}

router.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    const mediaType = (body.mediaType as string | undefined) ?? "image";
    const typeError = validateMediaType({ ...body, mediaType });
    if (typeError) {
      res.status(400).json({ error: typeError });
      return;
    }
    if (!body.imageUrl) {
      res.status(400).json({
        error: mediaType === "video" ? "imageUrl (poster) is required" : "imageUrl is required",
      });
      return;
    }
    if (mediaType === "video" && !body.videoUrl) {
      res.status(400).json({ error: "videoUrl is required for video items" });
      return;
    }
    const urlError = validateUrlFields(body, URL_FIELDS);
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }
    const values = pickAllowed(body);
    if (values.mediaType === undefined) values.mediaType = "image";
    if (values.sortOrder === undefined) values.sortOrder = 0;
    if (values.isActive === undefined) values.isActive = true;
    if (values.mediaType === "image") values.videoUrl = null;
    const [image] = await db
      .insert(galleryImagesTable)
      .values(values as typeof galleryImagesTable.$inferInsert)
      .returning();
    res.status(201).json({ data: image });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add gallery item" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body = req.body ?? {};
    const typeError = validateMediaType(body);
    if (typeError) {
      res.status(400).json({ error: typeError });
      return;
    }
    if (body.mediaType === "video" && body.videoUrl !== undefined && !body.videoUrl) {
      res.status(400).json({ error: "videoUrl is required for video items" });
      return;
    }
    const urlError = validateUrlFields(body, URL_FIELDS);
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }
    const values = pickAllowed(body);
    if (values.mediaType === "image") values.videoUrl = null;
    const [image] = await db
      .update(galleryImagesTable)
      .set(values)
      .where(eq(galleryImagesTable.id, id))
      .returning();
    if (!image) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json({ data: image });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(galleryImagesTable).where(eq(galleryImagesTable.id, id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

export default router;
