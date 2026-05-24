import { Router } from "express";
import { db } from "@workspace/db";
import { siteConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const router = Router();

router.use(requireAdmin);

// List all config entries
router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(siteConfigTable);
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch site config" });
  }
});

// Create a new config key
router.post("/", async (req, res) => {
  try {
    const { key, value, label } = req.body;
    if (!key) {
      res.status(400).json({ error: "key is required" });
      return;
    }
    const [created] = await db
      .insert(siteConfigTable)
      .values({ key, value, label, updatedAt: new Date() })
      .returning();
    res.status(201).json({ data: created });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "23505") {
      res.status(409).json({ error: "Config key already exists" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create config entry" });
  }
});

// Update a config entry by key
router.patch("/:key", async (req, res) => {
  try {
    const { value, label } = req.body;
    const [updated] = await db
      .update(siteConfigTable)
      .set({ value, label, updatedAt: new Date() })
      .where(eq(siteConfigTable.key, req.params.key))
      .returning();
    if (!updated) { res.status(404).json({ error: "Config key not found" }); return; }
    res.json({ data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update config entry" });
  }
});

// Delete a config entry by key
router.delete("/:key", async (req, res) => {
  try {
    const [deleted] = await db
      .delete(siteConfigTable)
      .where(eq(siteConfigTable.key, req.params.key))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Config key not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete config entry" });
  }
});

export default router;
