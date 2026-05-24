import { Router } from "express";
import { db } from "@workspace/db";
import {
  siteStatsTable,
  milestonesTable,
  awardsTable,
  teamMembersTable,
  csrInitiativesTable,
} from "@workspace/db/schema";
import { asc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [stats, milestones, awards, team, csr] = await Promise.all([
      db.select().from(siteStatsTable).orderBy(asc(siteStatsTable.sortOrder)),
      db.select().from(milestonesTable).orderBy(asc(milestonesTable.sortOrder)),
      db.select().from(awardsTable).orderBy(asc(awardsTable.sortOrder)),
      db.select().from(teamMembersTable).orderBy(asc(teamMembersTable.sortOrder)),
      db.select().from(csrInitiativesTable).orderBy(asc(csrInitiativesTable.sortOrder)),
    ]);

    res.json({ data: { stats, milestones, awards, team, csr } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch site settings" });
  }
});

export default router;
