import { Router } from "express";
import { db } from "@workspace/db";
import { jobOpeningsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const jobs = await db
      .select()
      .from(jobOpeningsTable)
      .orderBy(desc(jobOpeningsTable.createdAt));
    res.json({ data: jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, department, experience, description } = req.body;
    if (!title || !department || !experience) {
      res.status(400).json({ error: "title, department, and experience are required" });
      return;
    }
    const [job] = await db
      .insert(jobOpeningsTable)
      .values({ title, department, experience, description, updatedAt: new Date() })
      .returning();
    res.status(201).json({ data: job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create job" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [job] = await db
      .update(jobOpeningsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(jobOpeningsTable.id, id))
      .returning();
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json({ data: job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(jobOpeningsTable).where(eq(jobOpeningsTable.id, id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

export default router;
