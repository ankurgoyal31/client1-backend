import { Router } from "express";
import { db } from "@workspace/db";
import { aboutPageContentTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const router = Router();

router.use(requireAdmin);

const VALID_SECTIONS = [
  "hero",
  "philosophy",
  "intro",
  "stakeholder",
  "management",
  "value",
  "csr",
  "certification",
] as const;
type AboutSection = (typeof VALID_SECTIONS)[number];

const SINGLETON_SECTIONS: ReadonlySet<AboutSection> = new Set([
  "hero",
  "philosophy",
  "intro",
  "csr",
]);

const URL_FIELDS = ["imageUrl", "imageUrl2", "imageUrl3", "videoUrl", "linkUrl"] as const;

function isValidSection(v: string): v is AboutSection {
  return (VALID_SECTIONS as readonly string[]).includes(v);
}

function isSafeUrl(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  // Allow root-relative paths used for bundled assets.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  // Otherwise require an explicit safe scheme.
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function validateUrlFields(body: Record<string, unknown>): string | null {
  for (const field of URL_FIELDS) {
    if (field in body && !isSafeUrl(body[field])) {
      return `${field} must be a relative path starting with "/" or an http(s) URL`;
    }
  }
  return null;
}

router.get("/", async (req, res) => {
  try {
    const sectionParam =
      typeof req.query.section === "string" ? req.query.section : undefined;

    if (sectionParam && !isValidSection(sectionParam)) {
      res.status(400).json({
        error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(", ")}`,
      });
      return;
    }

    const rows = sectionParam
      ? await db
          .select()
          .from(aboutPageContentTable)
          .where(
            eq(aboutPageContentTable.section, sectionParam as AboutSection),
          )
          .orderBy(asc(aboutPageContentTable.sortOrder))
      : await db
          .select()
          .from(aboutPageContentTable)
          .orderBy(asc(aboutPageContentTable.sortOrder));

    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch about content" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [row] = await db
      .select()
      .from(aboutPageContentTable)
      .where(eq(aboutPageContentTable.id, id));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch about content item" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { section } = req.body ?? {};
    if (!section) {
      res.status(400).json({ error: "section is required" });
      return;
    }
    if (!isValidSection(section)) {
      res.status(400).json({
        error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(", ")}`,
      });
      return;
    }
    const urlError = validateUrlFields(req.body ?? {});
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }
    if (SINGLETON_SECTIONS.has(section)) {
      const existing = await db
        .select({ id: aboutPageContentTable.id })
        .from(aboutPageContentTable)
        .where(eq(aboutPageContentTable.section, section));
      if (existing.length > 0) {
        res.status(409).json({
          error: `Section "${section}" already has an item. Edit the existing one instead of creating a new one.`,
        });
        return;
      }
    }
    const allowed = [
      "section",
      "eyebrow",
      "title",
      "subtitle",
      "description",
      "body",
      "body2",
      "quote",
      "name",
      "role",
      "imageUrl",
      "imageUrl2",
      "imageUrl3",
      "videoUrl",
      "icon",
      "linkUrl",
      "linkLabel",
      "sortOrder",
      "isActive",
    ] as const;
    const values: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) values[key] = req.body[key];
    }
    values.updatedAt = new Date();

    const [created] = await db
      .insert(aboutPageContentTable)
      .values(values as typeof aboutPageContentTable.$inferInsert)
      .returning();
    res.status(201).json({ data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create about content" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body = { ...req.body };
    if (body.section && !isValidSection(body.section)) {
      res.status(400).json({
        error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(", ")}`,
      });
      return;
    }
    const urlError = validateUrlFields(body);
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }
    delete body.id;
    delete body.createdAt;
    const [updated] = await db
      .update(aboutPageContentTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(aboutPageContentTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update about content" });
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
      .delete(aboutPageContentTable)
      .where(eq(aboutPageContentTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete about content" });
  }
});
export default router;