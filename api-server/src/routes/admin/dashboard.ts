import { Router } from "express";
import { db } from "@workspace/db";
import {
  leadsTable,
  activitiesTable,
  remindersTable,
  projectsTable,
  blogPostsTable,
  heroSlidesTable,
  mediaArticlesTable,
  instagramPostsTable,
  businessHighlightsTable,
} from "@workspace/db/schema";
import { eq, count, sql, and, gte, lte, lt } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

const dashboardRouter = Router();

dashboardRouter.get("/stats", requireAdmin, async (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // 30-day window for leads-by-day series.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const [
    totalResult,
    newTodayResult,
    newYesterdayResult,
    pendingResult,
    assignedResult,
    convertedResult,
    lostResult,
    remindersResult,
    recentActivities,
    newLeads,
    leadsByDayRaw,
    projectsCount,
    activeProjectsCount,
    blogCount,
    heroCount,
    mediaCount,
    instaCount,
    highlightsCount,
    prevTotalLeads,
    prevNewLeads,
    prevConverted,
    currTotalLeads,
    currNewLeads,
    currConverted,
  ] = await Promise.all([
    db.select({ count: count() }).from(leadsTable),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(gte(leadsTable.createdAt, todayStart)),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(
        and(
          gte(leadsTable.createdAt, yesterdayStart),
          lt(leadsTable.createdAt, todayStart),
        ),
      ),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(eq(leadsTable.status, "pending")),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(eq(leadsTable.status, "assigned")),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(eq(leadsTable.status, "converted")),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(eq(leadsTable.status, "lost")),
    db
      .select({ count: count() })
      .from(remindersTable)
      .where(
        and(
          eq(remindersTable.done, false),
          gte(remindersTable.dueAt, new Date()),
          lte(remindersTable.dueAt, weekFromNow),
        ),
      ),
    db
      .select({
        id: activitiesTable.id,
        action: activitiesTable.action,
        performedBy: activitiesTable.performedBy,
        createdAt: activitiesTable.createdAt,
      })
      .from(activitiesTable)
      .orderBy(sql`${activitiesTable.createdAt} desc`)
      .limit(5),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(eq(leadsTable.status, "new")),
    db
      .select({
        date: sql<string>`to_char(${leadsTable.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(leadsTable)
      .where(gte(leadsTable.createdAt, thirtyDaysAgo))
      .groupBy(sql`to_char(${leadsTable.createdAt}, 'YYYY-MM-DD')`),
    db.select({ count: count() }).from(projectsTable),
    db
      .select({ count: count() })
      .from(projectsTable)
      .where(eq(projectsTable.status, "ongoing")),
    db.select({ count: count() }).from(blogPostsTable),
    db.select({ count: count() }).from(heroSlidesTable),
    db.select({ count: count() }).from(mediaArticlesTable),
    db.select({ count: count() }).from(instagramPostsTable),
    db.select({ count: count() }).from(businessHighlightsTable),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(
        and(
          gte(leadsTable.createdAt, fourteenDaysAgo),
          lt(leadsTable.createdAt, sevenDaysAgo),
        ),
      ),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.status, "new"),
          gte(leadsTable.createdAt, fourteenDaysAgo),
          lt(leadsTable.createdAt, sevenDaysAgo),
        ),
      ),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.status, "converted"),
          gte(leadsTable.createdAt, fourteenDaysAgo),
          lt(leadsTable.createdAt, sevenDaysAgo),
        ),
      ),
    // Current 7-day window (for like-for-like comparison vs previousPeriod)
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(gte(leadsTable.createdAt, sevenDaysAgo)),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.status, "new"),
          gte(leadsTable.createdAt, sevenDaysAgo),
        ),
      ),
    db
      .select({ count: count() })
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.status, "converted"),
          gte(leadsTable.createdAt, sevenDaysAgo),
        ),
      ),
  ]);

  // Build a dense 30-day series so the chart never has gaps.
  const byDate = new Map<string, number>();
  for (const row of leadsByDayRaw) {
    byDate.set(row.date, Number(row.count));
  }
  const leadsByDay: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    leadsByDay.push({ date: key, count: byDate.get(key) ?? 0 });
  }

  res.json({
    totalLeads: Number(totalResult[0]?.count ?? 0),
    newLeadsToday: Number(newTodayResult[0]?.count ?? 0),
    newLeadsYesterday: Number(newYesterdayResult[0]?.count ?? 0),
    newLeads: Number(newLeads[0]?.count ?? 0),
    pendingReplies: Number(pendingResult[0]?.count ?? 0),
    assigned: Number(assignedResult[0]?.count ?? 0),
    converted: Number(convertedResult[0]?.count ?? 0),
    lost: Number(lostResult[0]?.count ?? 0),
    activeProjects: Number(activeProjectsCount[0]?.count ?? 0),
    followUpReminders: Number(remindersResult[0]?.count ?? 0),
    recentActivities,
    leadsByDay,
    contentCounts: {
      projects: Number(projectsCount[0]?.count ?? 0),
      blogPosts: Number(blogCount[0]?.count ?? 0),
      heroSlides: Number(heroCount[0]?.count ?? 0),
      mediaArticles: Number(mediaCount[0]?.count ?? 0),
      instagramPosts: Number(instaCount[0]?.count ?? 0),
      businessHighlights: Number(highlightsCount[0]?.count ?? 0),
    },
    currentPeriod: {
      totalLeads: Number(currTotalLeads[0]?.count ?? 0),
      newLeads: Number(currNewLeads[0]?.count ?? 0),
      converted: Number(currConverted[0]?.count ?? 0),
    },
    previousPeriod: {
      totalLeads: Number(prevTotalLeads[0]?.count ?? 0),
      newLeads: Number(prevNewLeads[0]?.count ?? 0),
      converted: Number(prevConverted[0]?.count ?? 0),
    },
  });
});

export default dashboardRouter;
