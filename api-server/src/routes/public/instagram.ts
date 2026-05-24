import { Router } from "express";
import { db } from "@workspace/db";
import { instagramPostsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const posts = await db
      .select()
      .from(instagramPostsTable)
      .where(eq(instagramPostsTable.isActive, true))
      .orderBy(asc(instagramPostsTable.sortOrder));
    res.json({ data: posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch instagram posts" });
  }
});

export default router;
