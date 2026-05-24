import { Router } from "express";
import { db } from "@workspace/db";
import {
  siteStatsTable,
  milestonesTable,
  awardsTable,
  teamMembersTable,
  csrInitiativesTable,
} from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const router = Router();
router.use(requireAdmin);

// ── Stats ──────────────────────────────────────────────────────────────────────

router.get("/stats", async (_req, res) => {
  const rows = await db.select().from(siteStatsTable).orderBy(asc(siteStatsTable.sortOrder));
  res.json({ data: rows });
});

router.post("/stats", async (req, res) => {
  const [row] = await db.insert(siteStatsTable).values({ ...req.body, updatedAt: new Date() }).returning();
  res.status(201).json({ data: row });
});

router.patch("/stats/:id", async (req, res) => {
  const [row] = await db
    .update(siteStatsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(siteStatsTable.id, parseInt(req.params.id, 10)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.delete("/stats/:id", async (req, res) => {
  await db.delete(siteStatsTable).where(eq(siteStatsTable.id, parseInt(req.params.id, 10)));
  res.status(204).end();
});

// ── Milestones ─────────────────────────────────────────────────────────────────

router.get("/milestones", async (_req, res) => {
  const rows = await db.select().from(milestonesTable).orderBy(asc(milestonesTable.sortOrder));
  res.json({ data: rows });
});

router.post("/milestones", async (req, res) => {
  const [row] = await db.insert(milestonesTable).values({ ...req.body, updatedAt: new Date() }).returning();
  res.status(201).json({ data: row });
});

router.patch("/milestones/:id", async (req, res) => {
  const [row] = await db
    .update(milestonesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(milestonesTable.id, parseInt(req.params.id, 10)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.delete("/milestones/:id", async (req, res) => {
  await db.delete(milestonesTable).where(eq(milestonesTable.id, parseInt(req.params.id, 10)));
  res.status(204).end();
});

// ── Awards ─────────────────────────────────────────────────────────────────────

router.get("/awards", async (_req, res) => {
  const rows = await db.select().from(awardsTable).orderBy(asc(awardsTable.sortOrder));
  res.json({ data: rows });
});

router.post("/awards", async (req, res) => {
  const [row] = await db.insert(awardsTable).values(req.body).returning();
  res.status(201).json({ data: row });
});

router.patch("/awards/:id", async (req, res) => {
  const [row] = await db
    .update(awardsTable)
    .set(req.body)
    .where(eq(awardsTable.id, parseInt(req.params.id, 10)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.delete("/awards/:id", async (req, res) => {
  await db.delete(awardsTable).where(eq(awardsTable.id, parseInt(req.params.id, 10)));
  res.status(204).end();
});

// ── Team Members ───────────────────────────────────────────────────────────────

router.get("/team", async (_req, res) => {
  const rows = await db.select().from(teamMembersTable).orderBy(asc(teamMembersTable.sortOrder));
  res.json({ data: rows });
});

router.post("/team", async (req, res) => {
  const [row] = await db.insert(teamMembersTable).values({ ...req.body, updatedAt: new Date() }).returning();
  res.status(201).json({ data: row });
});

router.patch("/team/:id", async (req, res) => {
  const [row] = await db
    .update(teamMembersTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(teamMembersTable.id, parseInt(req.params.id, 10)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.delete("/team/:id", async (req, res) => {
  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, parseInt(req.params.id, 10)));
  res.status(204).end();
});

// ── CSR ────────────────────────────────────────────────────────────────────────

router.get("/csr", async (_req, res) => {
  const rows = await db.select().from(csrInitiativesTable).orderBy(asc(csrInitiativesTable.sortOrder));
  res.json({ data: rows });
});

router.post("/csr", async (req, res) => {
  const [row] = await db.insert(csrInitiativesTable).values({ ...req.body, updatedAt: new Date() }).returning();
  res.status(201).json({ data: row });
});

router.patch("/csr/:id", async (req, res) => {
  const [row] = await db
    .update(csrInitiativesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(csrInitiativesTable.id, parseInt(req.params.id, 10)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.delete("/csr/:id", async (req, res) => {
  await db.delete(csrInitiativesTable).where(eq(csrInitiativesTable.id, parseInt(req.params.id, 10)));
  res.status(204).end();
});

export default router;
