import { Router } from "express";
import { db } from "@workspace/db";
import { remindersTable, leadsTable } from "@workspace/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const remindersRouter = Router();

remindersRouter.use(requireAdmin);

remindersRouter.get("/", async (_req, res) => {
  const reminders = await db
    .select({
      id: remindersTable.id,
      leadId: remindersTable.leadId,
      leadName: leadsTable.name,
      dueAt: remindersTable.dueAt,
      note: remindersTable.note,
      done: remindersTable.done,
      createdAt: remindersTable.createdAt,
    })
    .from(remindersTable)
    .leftJoin(leadsTable, eq(remindersTable.leadId, leadsTable.id))
    .where(
      and(
        eq(remindersTable.done, false),
        gte(remindersTable.dueAt, new Date()),
      ),
    )
    .orderBy(sql`${remindersTable.dueAt} asc`)
    .limit(50);

  res.json({ reminders });
});

remindersRouter.patch("/:id/done", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [updated] = await db
    .update(remindersTable)
    .set({ done: true })
    .where(eq(remindersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  res.json(updated);
});

export default remindersRouter;
