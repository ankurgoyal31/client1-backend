import { Router } from "express";
import { db } from "@workspace/db";
import { siteConfigTable } from "@workspace/db/schema";

const router = Router();

// Returns all site config entries as a flat key-value object
router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(siteConfigTable);
    const config: Record<string, string | null> = {};
    for (const row of rows) {
      config[row.key] = row.value ?? null;
    }
    res.json({ data: config });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch site config" });
  }
});

export default router;
