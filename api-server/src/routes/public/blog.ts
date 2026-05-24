import { Router } from "express";
import { db } from "@workspace/db";
import { blogPostsTable } from "@workspace/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { category, limit, page, pageSize } = req.query as Record<string, string>;
    const conditions = [eq(blogPostsTable.isPublished, true)];
    if (category) conditions.push(eq(blogPostsTable.category, category));

    const whereClause = and(...conditions);

    if (page !== undefined || pageSize !== undefined) {
      const rawPage = parseInt(page ?? "1", 10);
      const rawPageSize = parseInt(pageSize ?? "6", 10);
      const parsedPage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
      const parsedPageSize = Number.isFinite(rawPageSize) && rawPageSize >= 1 ? Math.min(rawPageSize, 100) : 6;
      const offset = (parsedPage - 1) * parsedPageSize;

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(blogPostsTable)
        .where(whereClause);

      const total = Number(countRow?.count ?? 0);

      const posts = await db
        .select()
        .from(blogPostsTable)
        .where(whereClause)
        .orderBy(asc(blogPostsTable.sortOrder), desc(blogPostsTable.publishedAt))
        .limit(parsedPageSize)
        .offset(offset);

      res.json({ data: posts, total });
      return;
    }

    let query = db
      .select()
      .from(blogPostsTable)
      .where(whereClause)
      .orderBy(asc(blogPostsTable.sortOrder), desc(blogPostsTable.publishedAt));

    const posts = limit
      ? await query.limit(parseInt(limit, 10))
      : await query;

    res.json({ data: posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const [post] = await db
      .select()
      .from(blogPostsTable)
      .where(
        and(
          eq(blogPostsTable.slug, req.params.slug),
          eq(blogPostsTable.isPublished, true),
        ),
      )
      .limit(1);

    if (!post) {
      res.status(404).json({ error: "Blog post not found" });
      return;
    }
    res.json({ data: post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

export default router;
