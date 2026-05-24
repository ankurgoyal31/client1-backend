import { db, pool } from "@workspace/db";
import { csrInitiativesTable, milestonesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function fix() {
  console.log("Fixing seed data...");

  // Fix CSR image URLs: w=800 → w=2070 (match exact URLs in CSR.jsx source array)
  const csrUpdates = [
    {
      title: "Hunger & Health Support",
      imageUrl: "https://images.unsplash.com/photo-1522770179533-24471fcdba45?q=80&w=2070&auto=format&fit=crop",
    },
    {
      title: "Seasonal Care & Comfort",
      imageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=2070&auto=format&fit=crop",
    },
    {
      title: "Environmental Harmony",
      imageUrl: "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=2070&auto=format&fit=crop",
    },
    {
      title: "Education & Awareness",
      imageUrl: "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=2070&auto=format&fit=crop",
    },
  ];

  for (const u of csrUpdates) {
    const rows = await db
      .update(csrInitiativesTable)
      .set({ imageUrl: u.imageUrl })
      .where(eq(csrInitiativesTable.title, u.title))
      .returning();
    console.log(`CSR updated: ${u.title} → ${rows.length > 0 ? "✓" : "not found"}`);
  }

  // Fix milestone descriptions: preserve bullet-point format from MilestonesSection.jsx source
  const milestoneUpdates = [
    {
      year: "2002",
      description: "• The Beginning of a Vision: Established with a commitment to quality and integrity.\n• My Haveli: Launched as our flagship project, setting the benchmark for community living.",
    },
    {
      year: "2010",
      description: "• Iconic Landmarks: A landmark year featuring the development of Apex Tower, Golf, and Solitaire, defining the skyline with luxury and precision.",
    },
    {
      year: "2011",
      description: "• Umang \u2013 Dreams for All: Launched one of Rajasthan\u2019s first truly affordable housing concepts. By introducing quality homes starting at just \u20b95 lakhs, we turned the dream of homeownership into a reality for thousands.",
    },
    {
      year: "2013",
      description: "• Golf Estate (Jodhpur): Brought world-class leisure to the Sun City. It remains one of the only golf-based residential projects in Rajasthan, blending sport with sophisticated living.",
    },
    {
      year: "2015",
      description: "• IS Paradise: A fusion of international architectural aesthetics and modern comfort.\n• Iridium (Mumbai): Expanded our footprint into the Mumbai market with high-end elevations and cutting-edge design.",
    },
    {
      year: "2018",
      description: "• Garden City (NCR/Neemrana): Solidified our presence in the National Capital Region (NCR) and Neemrana, catering to the growing industrial and residential demand in the corridor.",
    },
    {
      year: "2024",
      description: "• City Unique Life: Venturing into expansive plotting townships. We are creating curated spaces that offer the freedom of independent living within a structured, modern community.",
    },
  ];

  for (const u of milestoneUpdates) {
    const rows = await db
      .update(milestonesTable)
      .set({ description: u.description, updatedAt: new Date() })
      .where(eq(milestonesTable.year, u.year))
      .returning();
    console.log(`Milestone updated: ${u.year} → ${rows.length > 0 ? "✓" : "not found"}`);
  }

  await pool.end();
  console.log("Fix complete!");
}

fix().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
