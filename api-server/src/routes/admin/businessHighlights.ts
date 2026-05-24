import { Router } from "express";
import { db } from "@workspace/db";
import { businessHighlightsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";
import { validateUrlFields } from "../../lib/validation.js";

const router = Router();

router.use(requireAdmin);

const URL_FIELDS = ["imageUrl"] as const;
const ALLOWED_FIELDS = [
  "projectName",
  "slug",
  "description",
  "imageUrl",
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
    const highlights = await db
      .select()
      .from(businessHighlightsTable)
      .orderBy(asc(businessHighlightsTable.sortOrder));
    res.json({ data: highlights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch business highlights" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.projectName) {
      res.status(400).json({ error: "projectName is required" });
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
      .insert(businessHighlightsTable)
      .values(values as typeof businessHighlightsTable.$inferInsert)
      .returning();
    res.status(201).json({ data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create business highlight" });
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
      .update(businessHighlightsTable)
      .set(values)
      .where(eq(businessHighlightsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update business highlight" });
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
      .delete(businessHighlightsTable)
      .where(eq(businessHighlightsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete business highlight" });
  }
});

export default router;
