import { Router } from "express";
import { db } from "@workspace/db";
import { subscribersTable } from "@workspace/db/schema";
import { sql, count } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const subscribersRouter = Router();

subscribersRouter.get("/", requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const [subscribers, totalResult] = await Promise.all([
    db
      .select()
      .from(subscribersTable)
      .orderBy(sql`${subscribersTable.createdAt} desc`)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(subscribersTable),
  ]);

  res.json({
    subscribers,
    total: Number(totalResult[0]?.count ?? 0),
    page,
    limit,
  });
});

export default subscribersRouter;
