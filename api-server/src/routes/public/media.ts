import { Router } from "express";
import { db } from "@workspace/db";
import { mediaArticlesTable, galleryImagesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/articles", async (_req, res) => {
  try {
    const articles = await db
      .select()
      .from(mediaArticlesTable)
      .where(eq(mediaArticlesTable.isPublished, true))
      .orderBy(asc(mediaArticlesTable.sortOrder), asc(mediaArticlesTable.id));

    res.json({ data: articles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch media articles" });
  }
});

router.get("/gallery", async (_req, res) => {
  try {
    const images = await db
      .select()
      .from(galleryImagesTable)
      .where(eq(galleryImagesTable.isActive, true))
      .orderBy(asc(galleryImagesTable.sortOrder), asc(galleryImagesTable.createdAt));

    res.json({ data: images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch gallery images" });
  }
});

export default router;
