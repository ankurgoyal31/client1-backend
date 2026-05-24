import { Router } from "express";
import { db } from "@workspace/db";
import { heroSlidesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";
import { validateUrlFields } from "../../lib/validation.js";

const router = Router();

router.use(requireAdmin);

const URL_FIELDS = ["backgroundVideoUrl", "backgroundImageUrl", "ctaLink"] as const;
const ALLOWED_FIELDS = [
  "title",
  "subtitle",
  "description",
  "backgroundVideoUrl",
  "backgroundImageUrl",
  "ctaLabel",
  "ctaLink",
  "sortOrder",
  "isActive",
] as const;

function pickAllowed(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

router.get("/", async (_req, res) => {
  try {
    const slides = await db
      .select()
      .from(heroSlidesTable)
      .orderBy(asc(heroSlidesTable.sortOrder));
    res.json({ data: slides });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch hero slides" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const urlError = validateUrlFields(body, URL_FIELDS);
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }
    const values = pickAllowed(body);
    if (values.sortOrder === undefined) values.sortOrder = 0;
    if (values.isActive === undefined) values.isActive = true;
    values.updatedAt = new Date();
    const [created] = await db
      .insert(heroSlidesTable)
      .values(values as typeof heroSlidesTable.$inferInsert)
      .returning();
    res.status(201).json({ data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create hero slide" });
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
    const urlError = validateUrlFields(body, URL_FIELDS);
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }
    const values = pickAllowed(body);
    values.updatedAt = new Date();
    const [updated] = await db
      .update(heroSlidesTable)
      .set(values)
      .where(eq(heroSlidesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update hero slide" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db
      .delete(heroSlidesTable)
      .where(eq(heroSlidesTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete hero slide" });
  }
});

export default router;
