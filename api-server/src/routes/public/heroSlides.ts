import { Router } from "express";
import { db } from "@workspace/db";
import { heroSlidesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const slides = await db
      .select()
      .from(heroSlidesTable)
      .where(eq(heroSlidesTable.isActive, true))
      .orderBy(asc(heroSlidesTable.sortOrder));
    res.json({ data: slides });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch hero slides" });
  }
});

export default router;
