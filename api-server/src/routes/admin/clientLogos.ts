import { Router } from "express";
import { db } from "@workspace/db";
import { clientLogosTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const router = Router();

router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const logos = await db
      .select()
      .from(clientLogosTable)
      .orderBy(asc(clientLogosTable.sortOrder));
    res.json({ data: logos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch client logos" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, imageUrl, website, sortOrder, isActive } = req.body;
    const [created] = await db
      .insert(clientLogosTable)
      .values({ name, imageUrl, website, sortOrder: sortOrder ?? 0, isActive: isActive ?? true, updatedAt: new Date() })
      .returning();
    res.status(201).json({ data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create client logo" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [updated] = await db
      .update(clientLogosTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(clientLogosTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update client logo" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [deleted] = await db
      .delete(clientLogosTable)
      .where(eq(clientLogosTable.id, id))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete client logo" });
  }
});

export default router;
