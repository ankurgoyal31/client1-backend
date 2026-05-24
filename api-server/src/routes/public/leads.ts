import { Router } from "express";
import { db } from "@workspace/db";
import { leadsTable, activitiesTable } from "@workspace/db/schema";

const publicLeadsRouter = Router();

publicLeadsRouter.post("/", async (req, res) => {
  const { name, phone, email, source, projectName, message } = req.body as Record<string, string>;

  if (!name || !phone) {
    res.status(400).json({ error: "Name and phone are required" });
    return;
  }

  const notes = [projectName && `Project: ${projectName}`, message].filter(Boolean).join("\n") || null;

  try {
    const [lead] = await db
      .insert(leadsTable)
      .values({
        name,
        phone: phone || null,
        email: email || null,
        source: source || "website",
        status: "new",
        notes,
      })
      .returning();

    await db.insert(activitiesTable).values({
      leadId: lead!.id,
      action: `Lead created via website (${source || "website"}): ${name}`,
      performedBy: "Website",
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error creating lead:", err);
    res.status(500).json({ error: "Failed to save lead" });
  }
});

export default publicLeadsRouter;
