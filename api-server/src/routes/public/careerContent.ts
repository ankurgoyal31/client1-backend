import { Router } from "express";
import { db } from "@workspace/db";
import { careerPageContentTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

const VALID_SECTIONS = ["life_at_ub", "why_join", "expectation"] as const;
type CareerSection = (typeof VALID_SECTIONS)[number];

function isValidSection(v: string): v is CareerSection {
  return (VALID_SECTIONS as readonly string[]).includes(v);
}

// GET /api/career-content — returns all sections grouped
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
        .from(careerPageContentTable)
        .where(
          and(
            eq(careerPageContentTable.section, sectionParam),
            eq(careerPageContentTable.isActive, true),
          ),
        )
        .orderBy(asc(careerPageContentTable.sortOrder));

      res.json({ data: items });
      return;
    }

    // No filter — return all grouped by section
    const all = await db
      .select()
      .from(careerPageContentTable)
      .where(eq(careerPageContentTable.isActive, true))
      .orderBy(asc(careerPageContentTable.sortOrder));

    const grouped: Record<string, typeof all> = {
      life_at_ub: [],
      why_join: [],
      expectation: [],
    };

    for (const item of all) {
      if (grouped[item.section]) {
        grouped[item.section].push(item);
      }
    }

    res.json({ data: grouped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch career content" });
  }
});

export default router;
