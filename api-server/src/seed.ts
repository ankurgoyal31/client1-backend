import bcrypt from "bcryptjs";
import { db, pool } from "@workspace/db";
import {
  adminUsersTable,
  leadsTable,
  activitiesTable,
  remindersTable,
} from "@workspace/db/schema";

async function seed() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 10);

  await db
    .insert(adminUsersTable)
    .values({
      email: "admin@uniquebuilders.in",
      passwordHash,
      name: "Admin",
    })
    .onConflictDoNothing();

  console.log("Created admin user: admin@uniquebuilders.in / admin123");

  const existing = await db.select().from(leadsTable).limit(1);
  if (existing.length > 0) {
    console.log("Leads already seeded. Skipping.");
    await pool.end();
    return;
  }

  const sampleLeads = [
    {
      name: "Rajesh Sharma",
      email: "rajesh.sharma@gmail.com",
      phone: "+91 98765 43210",
      source: "Website",
      status: "new" as const,
      notes: "Interested in 3BHK at Green Meadows",
    },
    {
      name: "Priya Mehta",
      email: "priya.mehta@yahoo.com",
      phone: "+91 87654 32109",
      source: "Instagram",
      status: "pending" as const,
      notes: "Wants brochure for IS Paradise",
    },
    {
      name: "Vikram Singh",
      email: "vikram.singh@hotmail.com",
      phone: "+91 76543 21098",
      source: "Referral",
      status: "assigned" as const,
      assignedTo: "Arjun Kapoor",
      notes: "Follow up scheduled for next week",
    },
    {
      name: "Anita Patel",
      email: "anita.patel@gmail.com",
      phone: "+91 65432 10987",
      source: "Google Ads",
      status: "converted" as const,
      notes: "Booked 2BHK at New Town. Payment complete.",
    },
    {
      name: "Suresh Kumar",
      email: "suresh.kumar@gmail.com",
      phone: "+91 54321 09876",
      source: "Facebook",
      status: "lost" as const,
      notes: "Went with competitor. Budget mismatch.",
    },
    {
      name: "Deepika Verma",
      email: "deepika.v@gmail.com",
      phone: "+91 43210 98765",
      source: "Website",
      status: "new" as const,
      notes: "First-time buyer, interested in Jaipur projects",
    },
    {
      name: "Amit Agarwal",
      email: "amit.ag@business.com",
      phone: "+91 32109 87654",
      source: "LinkedIn",
      status: "pending" as const,
      notes: "Commercial property inquiry",
    },
    {
      name: "Kavita Joshi",
      email: "kavita.j@gmail.com",
      phone: "+91 21098 76543",
      source: "Referral",
      status: "assigned" as const,
      assignedTo: "Priya Rathore",
      notes: "Looking for investment property",
    },
    {
      name: "Ravi Gupta",
      email: "ravi.gupta@outlook.com",
      phone: "+91 10987 65432",
      source: "Walk-in",
      status: "new" as const,
      notes: "Visited site office, wants virtual tour",
    },
    {
      name: "Sunita Rao",
      email: "sunita.rao@gmail.com",
      phone: "+91 09876 54321",
      source: "Website",
      status: "converted" as const,
      notes: "Purchased villa plot. Very satisfied.",
    },
    {
      name: "Manoj Tiwari",
      email: "manoj.t@company.com",
      phone: "+91 98760 12345",
      source: "Cold Call",
      status: "pending" as const,
      notes: "Needs EMI calculator info",
    },
    {
      name: "Pooja Bansal",
      email: "pooja.bansal@gmail.com",
      phone: "+91 87651 23456",
      source: "Google Ads",
      status: "new" as const,
      notes: "NRI buyer, prefers online meetings",
    },
    {
      name: "Harish Choudhary",
      email: "harish.c@yahoo.com",
      phone: "+91 76542 34567",
      source: "Instagram",
      status: "lost" as const,
      notes: "On hold due to personal reasons",
    },
    {
      name: "Rekha Malhotra",
      email: "rekha.m@gmail.com",
      phone: "+91 65433 45678",
      source: "Referral",
      status: "assigned" as const,
      assignedTo: "Arjun Kapoor",
      notes: "Site visit booked for this weekend",
    },
    {
      name: "Anil Bhatt",
      email: "anil.bhatt@gmail.com",
      phone: "+91 54324 56789",
      source: "Website",
      status: "new" as const,
      notes: "Looking for retirement home in Rajasthan",
    },
  ];

  const inserted = await db.insert(leadsTable).values(sampleLeads).returning();
  console.log(`Inserted ${inserted.length} sample leads`);

  const activities = inserted.flatMap((lead, i) => [
    {
      leadId: lead.id,
      action: `Lead created: ${lead.name}`,
      performedBy: "System",
    },
    ...(lead.status !== "new"
      ? [
          {
            leadId: lead.id,
            action: `Status updated to ${lead.status}`,
            performedBy: i % 2 === 0 ? "Arjun Kapoor" : "Priya Rathore",
          },
        ]
      : []),
  ]);

  await db.insert(activitiesTable).values(activities);
  console.log(`Inserted ${activities.length} activity records`);

  const now = new Date();
  const reminders = inserted.slice(0, 5).map((lead, i) => ({
    leadId: lead.id,
    dueAt: new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000),
    note: `Follow up with ${lead.name}`,
    done: false,
  }));

  await db.insert(remindersTable).values(reminders);
  console.log(`Inserted ${reminders.length} reminders`);

  await pool.end();
  console.log("Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
