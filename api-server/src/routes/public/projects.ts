import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

const VALID_STATUSES = ["ongoing", "completed", "upcoming"] as const;
const VALID_CATEGORIES = ["RESIDENTIAL", "COMMERCIAL", "TOWNSHIP"] as const;

type ProjectStatus = (typeof VALID_STATUSES)[number];
type ProjectCategory = (typeof VALID_CATEGORIES)[number];

function isValidStatus(v: string): v is ProjectStatus {
  return (VALID_STATUSES as readonly string[]).includes(v);
}
function isValidCategory(v: string): v is ProjectCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(v);
}

router.get("/", async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const featuredParam = typeof req.query.featured === "string" ? req.query.featured : undefined;

    const conditions = [eq(projectsTable.isActive, true)];

    if (status) {
      if (!isValidStatus(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
        return;
      }
      conditions.push(eq(projectsTable.status, status));
    }

    if (category) {
      if (!isValidCategory(category)) {
        res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
        return;
      }
      conditions.push(eq(projectsTable.category, category));
    }

    if (featuredParam === "true") {
      conditions.push(eq(projectsTable.isFeatured, true));
    }

    // For the general Projects list, order strictly by the admin-chosen sort
    // number with project name as a stable tie-breaker — matching the admin
    // dashboard so what admins see is what visitors see. The Featured tabs
    // (homepage) hit this endpoint with `?featured=true` and need the
    // independent featuredOrder to drive their tab order, so honor that
    // first only when the caller asked for featured projects.
    const orderBy =
      featuredParam === "true"
        ? [
            asc(projectsTable.featuredOrder),
            asc(projectsTable.sortOrder),
            asc(projectsTable.name),
          ]
        : [asc(projectsTable.sortOrder), asc(projectsTable.name)];
    const projects = await db
      .select()
      .from(projectsTable)
      .where(and(...conditions))
      .orderBy(...orderBy);

    res.json({ data: projects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.slug, req.params.slug),
          eq(projectsTable.isActive, true),
        ),
      )
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ data: project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

export default router;
