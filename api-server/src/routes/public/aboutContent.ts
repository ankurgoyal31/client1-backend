import { Router } from "express";
import { db } from "@workspace/db";
import { aboutPageContentTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

const VALID_SECTIONS = [
  "hero",
  "philosophy",
  "intro",
  "stakeholder",
  "management",
  "value",
  "function",
  "csr",
  "certification",
] as const;
type AboutSection = (typeof VALID_SECTIONS)[number];

function isValidSection(v: string): v is AboutSection {
  return (VALID_SECTIONS as readonly string[]).includes(v);
}

// GET /api/about-content — returns all sections grouped, or filtered by ?section=
router.get("/", async (req, res) => {
  try {
    const sectionParam =
      typeof req.query.section === "string" ? req.query.section : undefined;

    if (sectionParam) {
      if (!isValidSection(sectionParam)) {
        res.status(400).json({
          error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(", ")}`,
        });
        return;
      }

      const items = await db
        .select()
        .from(aboutPageContentTable)
        .where(
          and(
            eq(aboutPageContentTable.section, sectionParam),
            eq(aboutPageContentTable.isActive, true),
          ),
        )
        .orderBy(asc(aboutPageContentTable.sortOrder));

      res.json({ data: items });
      return;
    }

    const all = await db
      .select()
      .from(aboutPageContentTable)
      .where(eq(aboutPageContentTable.isActive, true))
      .orderBy(asc(aboutPageContentTable.sortOrder));

    const grouped: Record<AboutSection, typeof all> = {
      hero: [],
      philosophy: [],
      intro: [],
      stakeholder: [],
      management: [],
      value: [],
      function: [],
      csr: [],
      certification: [],
    };

    for (const item of all) {
      grouped[item.section].push(item);
    }

    res.json({ data: grouped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch about content" });
  }
});

export default router;
