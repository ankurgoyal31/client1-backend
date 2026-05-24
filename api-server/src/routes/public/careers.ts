import { Router } from "express";
import { db } from "@workspace/db";
import { careerApplicationsTable } from "@workspace/db/schema";

const careersRouter = Router();

careersRouter.post("/apply", async (req, res) => {
  const { name, email, phone, jobTitle, experience, cvNote } = req.body as Record<string, string>;

  if (!name || !email || !jobTitle) {
    res.status(400).json({ error: "Name, email, and job title are required" });
    return;
  }

  try {
    await db.insert(careerApplicationsTable).values({
      name,
      email,
      phone: phone || null,
      jobTitle,
      experience: experience || null,
      cvNote: cvNote || null,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving career application:", err);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

export default careersRouter;
