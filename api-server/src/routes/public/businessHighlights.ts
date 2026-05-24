import { Router } from "express";
import { db } from "@workspace/db";
import { businessHighlightsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const highlights = await db
      .select()
      .from(businessHighlightsTable)
      .where(eq(businessHighlightsTable.isActive, true))
      .orderBy(asc(businessHighlightsTable.sortOrder));
    res.json({ data: highlights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch business highlights" });
  }
});

export default router;
