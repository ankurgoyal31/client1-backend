import { Router } from "express";
import { db } from "@workspace/db";
import { careerApplicationsTable } from "@workspace/db/schema";
import { sql, count } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const careerApplicationsRouter = Router();

careerApplicationsRouter.get("/", requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const [applications, totalResult] = await Promise.all([
    db
      .select()
      .from(careerApplicationsTable)
      .orderBy(sql`${careerApplicationsTable.createdAt} desc`)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(careerApplicationsTable),
  ]);

  res.json({
    applications,
    total: Number(totalResult[0]?.count ?? 0),
    page,
    limit,
  });
});

export default careerApplicationsRouter;
