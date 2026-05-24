import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";
import { scanProject, scanProjects } from "../../lib/projectImageHealth.js";

const router = Router();
router.use(requireAdmin);

// Image-health summary for every project. Matched routes are evaluated in
// declaration order, so this must come before "/:id" to avoid being shadowed.
router.get("/image-health", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(projectsTable)
      .orderBy(asc(projectsTable.sortOrder), asc(projectsTable.name));
    const data = await scanProjects(rows);
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to scan project images" });
  }
});

// Detailed image-health for a single project (for the edit dialog).
router.get("/:id/image-health", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [row] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id));
    if (!row) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const data = await scanProject(row);
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to scan project images" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const projects = await db
      .select()
      .from(projectsTable)
      // Match the public site: admin-chosen sort number first, then name as
      // a stable tie-breaker. Keeps "what admins see" === "what visitors see".
      .orderBy(asc(projectsTable.sortOrder), asc(projectsTable.name));
    res.json({ data: projects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.slug || !body.name || !body.category) {
      res.status(400).json({ error: "slug, name, and category are required" });
      return;
    }
    // Auto-assign sortOrder when the admin leaves it blank: place the new
    // project at the end of the list with breathing room (max + 10), so the
    // admin can later squeeze rows in between without renumbering everything.
    // We treat null, undefined, and empty string as "blank"; explicit numbers
    // (including 0) are honored as-is.
    const sortOrderRaw = body.sortOrder;
    const sortOrderBlank =
      sortOrderRaw === null ||
      sortOrderRaw === undefined ||
      sortOrderRaw === "" ||
      (typeof sortOrderRaw === "number" && !Number.isFinite(sortOrderRaw));
    if (sortOrderBlank) {
      const [{ maxOrder }] = await db
        .select({
          maxOrder: sql<number | null>`COALESCE(MAX(${projectsTable.sortOrder}), 0)`,
        })
        .from(projectsTable);
      body.sortOrder = (maxOrder ?? 0) + 10;
    }
    const [project] = await db
      .insert(projectsTable)
      .values({ ...body, updatedAt: new Date() })
      .returning();
    res.status(201).json({ data: project });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "23505") {
      res.status(409).json({ error: "A project with that slug already exists" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const body = { ...req.body };
    // Mirror the POST auto-assign behavior: if the admin clears the Sort
    // Order field on an existing project, treat it as "put me at the end"
    // (MAX(sortOrder) + 10) instead of letting the not-null DB column reject
    // the update with a 500.
    if ("sortOrder" in body) {
      const v = body.sortOrder;
      const blank =
        v === null ||
        v === undefined ||
        v === "" ||
        (typeof v === "number" && !Number.isFinite(v));
      if (blank) {
        const [{ maxOrder }] = await db
          .select({
            maxOrder: sql<number | null>`COALESCE(MAX(${projectsTable.sortOrder}), 0)`,
          })
          .from(projectsTable);
        body.sortOrder = (maxOrder ?? 0) + 10;
      }
    }
    const [project] = await db
      .update(projectsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(projectsTable.id, id))
      .returning();
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ data: project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
