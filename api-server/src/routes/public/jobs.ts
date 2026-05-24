import { Router } from "express";
import { db } from "@workspace/db";
import { jobOpeningsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const jobs = await db
      .select()
      .from(jobOpeningsTable)
      .where(eq(jobOpeningsTable.isActive, true))
      .orderBy(asc(jobOpeningsTable.createdAt));

    res.json({ data: jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch job openings" });
  }
});

export default router;
