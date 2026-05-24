import { Router } from "express";
import { db } from "@workspace/db";
import { mediaArticlesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";
import { validateUrlFields } from "../../lib/validation.js";

const router = Router();
router.use(requireAdmin);

const URL_FIELDS = ["imageUrl", "articleUrl"] as const;
const ALLOWED_FIELDS = [
  "title",
  "source",
  "category",
  "excerpt",
  "publishedDate",
  "imageUrl",
  "articleUrl",
  "isPublished",
  "sortOrder",
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
    const articles = await db
      .select()
      .from(mediaArticlesTable)
      .orderBy(asc(mediaArticlesTable.sortOrder), asc(mediaArticlesTable.id));
    res.json({ data: articles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch articles" });
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
    values.updatedAt = new Date();
    const [article] = await db
      .insert(mediaArticlesTable)
      .values(values as typeof mediaArticlesTable.$inferInsert)
      .returning();
    res.status(201).json({ data: article });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create article" });
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
    const [article] = await db
      .update(mediaArticlesTable)
      .set(values)
      .where(eq(mediaArticlesTable.id, id))
      .returning();
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    res.json({ data: article });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update article" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(mediaArticlesTable).where(eq(mediaArticlesTable.id, id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

export default router;
