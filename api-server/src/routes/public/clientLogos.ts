import { Router } from "express";
import { db } from "@workspace/db";
import { clientLogosTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const logos = await db
      .select()
      .from(clientLogosTable)
      .where(eq(clientLogosTable.isActive, true))
      .orderBy(asc(clientLogosTable.sortOrder));
    res.json({ data: logos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch client logos" });
  }
});

export default router;
