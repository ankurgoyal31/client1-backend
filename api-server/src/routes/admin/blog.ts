import { Router } from "express";
import { db } from "@workspace/db";
import { blogPostsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";
import sanitizeHtml from "sanitize-html";

const ALLOWED_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "em",
    "ul", "ol", "li",
    "blockquote",
    "a",
    "img",
    "hr",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  allowedSchemesByTag: {
    img: ["https", "http"],
    a: ["https", "http", "mailto"],
  },
  allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "noscript"],
  transformTags: {
    a: (tagName, attribs) => {
      const next: Record<string, string> = { ...attribs };
      if (next.target === "_blank") {
        next.rel = "noopener noreferrer";
      } else if ("rel" in next) {
        delete next.rel;
      }
      return { tagName, attribs: next };
    },
  },
};

function sanitizeContent(content: unknown): string | null {
  if (!content || typeof content !== "string") return null;
  const cleaned = sanitizeHtml(content, ALLOWED_HTML_OPTIONS).trim();
  return cleaned || null;
}

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const posts = await db
      .select()
      .from(blogPostsTable)
      .orderBy(asc(blogPostsTable.sortOrder), asc(blogPostsTable.createdAt));
    res.json({ data: posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    if (!body.slug || !body.title || !body.category) {
      res.status(400).json({ error: "slug, title, and category are required" });
      return;
    }
    const values = { ...body, content: sanitizeContent(body.content), updatedAt: new Date() };
    const [post] = await db
      .insert(blogPostsTable)
      .values(values)
      .returning();
    res.status(201).json({ data: post });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "23505") {
      res.status(409).json({ error: "A post with that slug already exists" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create blog post" });
  }
});

router.put("/reorder", async (req, res) => {
  try {
    const items = req.body as { id: number; sortOrder: number }[];
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "Expected an array of { id, sortOrder }" });
      return;
    }
    const validItems = items.filter(
      (item) =>
        typeof item.id === "number" &&
        Number.isInteger(item.id) &&
        item.id > 0 &&
        typeof item.sortOrder === "number" &&
        Number.isInteger(item.sortOrder) &&
        item.sortOrder >= 0,
    );
    if (validItems.length !== items.length) {
      res.status(400).json({ error: "Each item must have a positive integer id and non-negative integer sortOrder" });
      return;
    }
    await db.transaction(async (tx) => {
      await Promise.all(
        validItems.map(({ id, sortOrder }) =>
          tx
            .update(blogPostsTable)
            .set({ sortOrder, updatedAt: new Date() })
            .where(eq(blogPostsTable.id, id)),
        ),
      );
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reorder blog posts" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updates = { ...req.body, updatedAt: new Date() };
    if ("content" in req.body) {
      updates.content = sanitizeContent(req.body.content);
    }
    const [post] = await db
      .update(blogPostsTable)
      .set(updates)
      .where(eq(blogPostsTable.id, id))
      .returning();
    if (!post) {
      res.status(404).json({ error: "Blog post not found" });
      return;
    }
    res.json({ data: post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update blog post" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete blog post" });
  }
});

export default router;
