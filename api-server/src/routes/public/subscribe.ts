import { Router } from "express";
import { db } from "@workspace/db";
import { subscribersTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const subscribeRouter = Router();

subscribeRouter.post("/", async (req, res) => {
  const { email, category } = req.body as Record<string, string>;

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
    await db
      .insert(subscribersTable)
      .values({
        email,
        category: category || "Real Estate",
      })
      .onConflictDoUpdate({
        target: subscribersTable.email,
        set: { category: sql`excluded.category` },
      });

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving subscriber:", err);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

export default subscribeRouter;
