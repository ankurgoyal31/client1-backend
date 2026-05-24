import { Router } from "express";
import { db } from "@workspace/db";
import { leadsTable, activitiesTable } from "@workspace/db/schema";
import { eq, ilike, sql, and, count } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const leadsRouter = Router();

leadsRouter.use(requireAdmin);

leadsRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const conditions = [];
  if (status && status !== "all") {
    conditions.push(
      eq(leadsTable.status, status as "new" | "pending" | "assigned" | "converted" | "lost"),
    );
  }
  if (search) {
    conditions.push(
      sql`(${leadsTable.name} ilike ${"%" + search + "%"} or ${leadsTable.email} ilike ${"%" + search + "%"} or ${leadsTable.phone} ilike ${"%" + search + "%"})`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [leads, totalResult] = await Promise.all([
    db
      .select()
      .from(leadsTable)
      .where(where)
      .orderBy(sql`${leadsTable.createdAt} desc`)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(leadsTable).where(where),
  ]);

  res.json({
    leads,
    total: Number(totalResult[0]?.count ?? 0),
    page,
    limit,
  });
});

leadsRouter.post("/", async (req, res) => {
  const { name, email, phone, source, status, assignedTo, notes } = req.body as Record<string, string>;

  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const [lead] = await db
    .insert(leadsTable)
    .values({
      name,
      email: email || null,
      phone: phone || null,
      source: source || null,
      status: (status as "new" | "pending" | "assigned" | "converted" | "lost") || "new",
      assignedTo: assignedTo || null,
      notes: notes || null,
    })
    .returning();

  await db.insert(activitiesTable).values({
    leadId: lead!.id,
    action: `Lead created: ${name}`,
    performedBy: req.admin?.name ?? "Admin",
  });

  res.status(201).json(lead);
});

leadsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { name, email, phone, source, status, assignedTo, notes } = req.body as Record<string, string>;

  const [existing] = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const [updated] = await db
    .update(leadsTable)
    .set({
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(source !== undefined && { source }),
      ...(status !== undefined && { status: status as "new" | "pending" | "assigned" | "converted" | "lost" }),
      ...(assignedTo !== undefined && { assignedTo }),
      ...(notes !== undefined && { notes }),
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, id))
    .returning();

  if (status && status !== existing.status) {
    await db.insert(activitiesTable).values({
      leadId: id,
      action: `Status changed from ${existing.status} → ${status} for ${existing.name}`,
      performedBy: req.admin?.name ?? "Admin",
    });
  }

  res.json(updated);
});

leadsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db
    .delete(leadsTable)
    .where(eq(leadsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  res.json({ success: true, deleted });
});

export default leadsRouter;
