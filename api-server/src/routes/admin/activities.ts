import { Router } from "express";
import { db } from "@workspace/db";
import { activitiesTable, leadsTable } from "@workspace/db/schema";
import { sql, eq } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const activitiesRouter = Router();


activitiesRouter.get("/", requireAdmin, async (_req, res) => {
  const activities = await db
    .select({
      id: activitiesTable.id,
      leadId: activitiesTable.leadId,
      leadName: leadsTable.name,
      action: activitiesTable.action,
      performedBy: activitiesTable.performedBy,
      createdAt: activitiesTable.createdAt,
    })
    .from(activitiesTable)
    .leftJoin(leadsTable, eq(activitiesTable.leadId, leadsTable.id))
    .orderBy(sql`${activitiesTable.createdAt} desc`)
    .limit(20);

  res.json({ activities });
});

export default activitiesRouter;
