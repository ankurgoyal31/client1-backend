import { Router } from "express";
import { db } from "@workspace/db";
import { careerPageContentTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const router = Router();

router.use(requireAdmin);

const VALID_SECTIONS = ["life_at_ub", "why_join", "expectation"] as const;
type CareerSection = (typeof VALID_SECTIONS)[number];

function isValidSection(v: string): v is CareerSection {
  return (VALID_SECTIONS as readonly string[]).includes(v);
}

router.get("/", async (req, res) => {
  try {
    const sectionParam =
      typeof req.query.section === "string" ? req.query.section : undefined;

    if (sectionParam && !isValidSection(sectionParam)) {
      res.status(400).json({ error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(", ")}` });
      return;
    }

    const rows = sectionParam
      ? await db
          .select()
          .from(careerPageContentTable)
          .where(eq(careerPageContentTable.section, sectionParam as CareerSection))
          .orderBy(asc(careerPageContentTable.sortOrder))
      : await db
          .select()
          .from(careerPageContentTable)
          .orderBy(asc(careerPageContentTable.sortOrder));

    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch career content" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { section, title, description, imageUrl, icon, sortOrder, isActive } = req.body;
    if (!section || !title) {
      res.status(400).json({ error: "section and title are required" });
      return;
    }
    if (!isValidSection(section)) {
      res.status(400).json({ error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(", ")}` });
      return;
    }
    const [created] = await db
      .insert(careerPageContentTable)
      .values({ section, title, description, imageUrl, icon, sortOrder: sortOrder ?? 0, isActive: isActive ?? true, updatedAt: new Date() })
      .returning();
    res.status(201).json({ data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create career content" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const body = { ...req.body };
    if (body.section && !isValidSection(body.section)) {
      res.status(400).json({ error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(", ")}` });
      return;
    }
    const [updated] = await db
      .update(careerPageContentTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(careerPageContentTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update career content" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [deleted] = await db
      .delete(careerPageContentTable)
      .where(eq(careerPageContentTable.id, id))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete career content" });
  }
});

export default router;
