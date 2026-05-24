import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  pgEnum,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "pending",
  "assigned",
  "converted",
  "lost",
]);

export const projectCategoryEnum = pgEnum("project_category", [
  "RESIDENTIAL",
  "COMMERCIAL",
  "TOWNSHIP",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "ongoing",
  "completed",
  "upcoming",
]);

export const teamSectionEnum = pgEnum("team_section", [
  "leadership",
  "management",
]);

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── CRM ──────────────────────────────────────────────────────────────────────

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  source: text("source"),
  status: leadStatusEnum("status").default("new").notNull(),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leadsTable.id, {
    onDelete: "cascade",
  }),
  action: text("action").notNull(),
  performedBy: text("performed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leadsTable.id, {
    onDelete: "cascade",
  }),
  dueAt: timestamp("due_at").notNull(),
  note: text("note"),
  done: boolean("done").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── CMS: Projects ────────────────────────────────────────────────────────────

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: projectCategoryEnum("category").notNull(),
  status: projectStatusEnum("status").notNull().default("ongoing"),
  address: text("address"),
  location: text("location"),
  priceRange: text("price_range"),
  aboutDescription: text("about_description"),
  reraNumber: text("rera_number"),
  googleMapsLink: text("google_maps_link"),
  heroImage1: text("hero_image_1"),
  heroImage2: text("hero_image_2"),
  heroImage3: text("hero_image_3"),
  logoImage: text("logo_image"),
  masterPlanImage: text("master_plan_image"),
  floorPlanImage: text("floor_plan_image"),
  exclusiveClubImage: text("exclusive_club_image"),
  facilitiesNearbyImage: text("facilities_nearby_image"),
  constructionUpdateImage: text("construction_update_image"),
  locationImage: text("location_image"),
  brochureFile: text("brochure_file"),
  videoUrl: text("video_url"),
  reelUrl: text("reel_url"),
  heroImageUrl: text("hero_image_url"),
  isFeatured: boolean("is_featured").default(false).notNull(),
  featuredOrder: integer("featured_order").default(0).notNull(),
  featuredTabLabel: text("featured_tab_label"),
  featuredTitle: text("featured_title"),
  featuredDescription: text("featured_description"),
  bedrooms: text("bedrooms"),
  area: text("area"),
  price: text("price"),
  amenities: jsonb("amenities").$type<string[]>().default([]),
  galleryImages: jsonb("gallery_images").$type<string[]>().default([]),
  planImages: jsonb("plan_images").$type<string[]>().default([]),
  amenityImages: jsonb("amenity_images").$type<string[]>().default([]),
  constructionImages: jsonb("construction_images").$type<string[]>().default([]),
  highlights: jsonb("highlights")
    .$type<{ title: string; description: string; image: string }[]>()
    .default([]),
  faqs: jsonb("faqs").$type<{ question: string; answer: string }[]>().default([]),
  areaAndLot: jsonb("area_and_lot").$type<string[]>().default([]),
  interiorFeatures: jsonb("interior_features").$type<string[]>().default([]),
  exteriorFeatures: jsonb("exterior_features").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: Blog ────────────────────────────────────────────────────────────────

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  excerpt: text("excerpt"),
  content: text("content"),
  heroImage: text("hero_image"),
  author: text("author"),
  publishedAt: timestamp("published_at"),
  isPublished: boolean("is_published").default(false).notNull(),
  readTime: text("read_time"),
  contentImages: jsonb("content_images").$type<string[]>().default([]),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: Jobs ────────────────────────────────────────────────────────────────

export const jobOpeningsTable = pgTable("job_openings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  experience: text("experience").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: Media ───────────────────────────────────────────────────────────────

export const mediaArticlesTable = pgTable("media_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  source: text("source"),
  category: text("category"),
  excerpt: text("excerpt"),
  publishedDate: text("published_date"),
  imageUrl: text("image_url"),
  articleUrl: text("article_url"),
  isPublished: boolean("is_published").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const galleryImagesTable = pgTable("gallery_images", {
  id: serial("id").primaryKey(),
  mediaType: text("media_type").default("image").notNull(),
  imageUrl: text("image_url").notNull(),
  videoUrl: text("video_url"),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── CMS: Site Settings ───────────────────────────────────────────────────────

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  imageUrl: text("image_url"),
  bio: text("bio"),
  sortOrder: integer("sort_order").default(0).notNull(),
  section: teamSectionEnum("section").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const siteStatsTable = pgTable("site_stats", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  value: integer("value").notNull(),
  suffix: text("suffix").default("").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const milestonesTable = pgTable("milestones", {
  id: serial("id").primaryKey(),
  year: text("year").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const awardsTable = pgTable("awards", {
  id: serial("id").primaryKey(),
  year: text("year").notNull(),
  title: text("title").notNull(),
  organization: text("organization"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const csrInitiativesTable = pgTable("csr_initiatives", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: Hero Slides ─────────────────────────────────────────────────────────
// Source: HomeHeroNew.jsx slides array
export const heroSlidesTable = pgTable("hero_slides", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  backgroundVideoUrl: text("background_video_url"),
  backgroundImageUrl: text("background_image_url"),
  ctaLabel: text("cta_label"),
  ctaLink: text("cta_link"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: Business Highlights ─────────────────────────────────────────────────
// Source: BusinessHighlights.jsx slides array
export const businessHighlightsTable = pgTable("business_highlights", {
  id: serial("id").primaryKey(),
  projectName: text("project_name").notNull(),
  slug: text("slug"),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: Client Logos ────────────────────────────────────────────────────────
// Source: ProjectsPage.jsx demoLogos array (45 logos from UB Logos/ assets)
// Note: current logos are bundled assets; imageUrl stores hosted CDN URL when available
export const clientLogosTable = pgTable("client_logos", {
  id: serial("id").primaryKey(),
  name: text("name"),
  imageUrl: text("image_url"),
  website: text("website"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: Site Config ─────────────────────────────────────────────────────────
// Source: Footer.jsx — address, phone, social links
// key-value store; each row is one config entry
export const siteConfigTable = pgTable("site_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  label: text("label"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: Career Page Content ─────────────────────────────────────────────────
// Source: Career.jsx — lifeAtUB, whyJoin, expectations arrays

export const careerSectionEnum = pgEnum("career_section", [
  "life_at_ub",
  "why_join",
  "expectation",
]);

export const careerPageContentTable = pgTable("career_page_content", {
  id: serial("id").primaryKey(),
  section: careerSectionEnum("section").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: Instagram Posts ─────────────────────────────────────────────────────
// Source: InstagramSection.jsx instagramPosts array
// Note: current images are bundled assets; imageUrl stores hosted URL when available
export const instagramPostsTable = pgTable("instagram_posts", {
  id: serial("id").primaryKey(),
  postId: text("post_id"),
  imageUrl: text("image_url"),
  link: text("link").notNull(),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CMS: About Page Content ─────────────────────────────────────────────────
// Source: About2.jsx — hero, philosophy, intro, stakeholders, management,
// timeline (handled by milestonesTable also), values, csr, certifications.
// Generic shape so a single table can hold every section.

export const aboutSectionEnum = pgEnum("about_section", [
  "hero",
  "philosophy",
  "intro",
  "stakeholder",
  "management",
  "value",
  "function",
  "csr",
  "certification",
]);

export const aboutPageContentTable = pgTable("about_page_content", {
  id: serial("id").primaryKey(),
  section: aboutSectionEnum("section").notNull(),
  // Headings / copy
  eyebrow: text("eyebrow"),
  title: text("title"),
  subtitle: text("subtitle"),
  description: text("description"),
  body: text("body"),
  body2: text("body2"),
  quote: text("quote"),
  // People-specific
  name: text("name"),
  role: text("role"),
  // Media
  imageUrl: text("image_url"),
  imageUrl2: text("image_url2"),
  imageUrl3: text("image_url3"),
  videoUrl: text("video_url"),
  // Misc
  icon: text("icon"),
  linkUrl: text("link_url"),
  linkLabel: text("link_label"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Zod Schemas & Types ──────────────────────────────────────────────────────

export const insertAdminUserSchema = createInsertSchema(adminUsersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsersTable.$inferSelect;

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectLeadSchema = createSelectSchema(leadsTable);
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;

export const insertReminderSchema = createInsertSchema(remindersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof remindersTable.$inferSelect;

export type Project = typeof projectsTable.$inferSelect;
export type InsertProject = typeof projectsTable.$inferInsert;
export type BlogPost = typeof blogPostsTable.$inferSelect;
export type InsertBlogPost = typeof blogPostsTable.$inferInsert;
export type JobOpening = typeof jobOpeningsTable.$inferSelect;
export type InsertJobOpening = typeof jobOpeningsTable.$inferInsert;
export type MediaArticle = typeof mediaArticlesTable.$inferSelect;
export type InsertMediaArticle = typeof mediaArticlesTable.$inferInsert;
export type GalleryImage = typeof galleryImagesTable.$inferSelect;
export type InsertGalleryImage = typeof galleryImagesTable.$inferInsert;
export type TeamMember = typeof teamMembersTable.$inferSelect;
export type InsertTeamMember = typeof teamMembersTable.$inferInsert;
export type SiteStat = typeof siteStatsTable.$inferSelect;
export type InsertSiteStat = typeof siteStatsTable.$inferInsert;
export type Milestone = typeof milestonesTable.$inferSelect;
export type InsertMilestone = typeof milestonesTable.$inferInsert;
export type Award = typeof awardsTable.$inferSelect;
export type InsertAward = typeof awardsTable.$inferInsert;
export type CsrInitiative = typeof csrInitiativesTable.$inferSelect;
export type InsertCsrInitiative = typeof csrInitiativesTable.$inferInsert;
export type HeroSlide = typeof heroSlidesTable.$inferSelect;
export type InsertHeroSlide = typeof heroSlidesTable.$inferInsert;
export type BusinessHighlight = typeof businessHighlightsTable.$inferSelect;
export type InsertBusinessHighlight = typeof businessHighlightsTable.$inferInsert;
export type ClientLogo = typeof clientLogosTable.$inferSelect;
export type InsertClientLogo = typeof clientLogosTable.$inferInsert;
export type SiteConfig = typeof siteConfigTable.$inferSelect;
export type InsertSiteConfig = typeof siteConfigTable.$inferInsert;
export type CareerPageContent = typeof careerPageContentTable.$inferSelect;
export type InsertCareerPageContent = typeof careerPageContentTable.$inferInsert;
export type InstagramPost = typeof instagramPostsTable.$inferSelect;
export type InsertInstagramPost = typeof instagramPostsTable.$inferInsert;

// ─── Form Capture ─────────────────────────────────────────────────────────────

export const subscribersTable = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  category: text("category").notNull().default("Real Estate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const careerApplicationsTable = pgTable("career_applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  jobTitle: text("job_title").notNull(),
  experience: text("experience"),
  cvNote: text("cv_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriberSchema = createInsertSchema(subscribersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type Subscriber = typeof subscribersTable.$inferSelect;

export const insertCareerApplicationSchema = createInsertSchema(careerApplicationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCareerApplication = z.infer<typeof insertCareerApplicationSchema>;
export type CareerApplication = typeof careerApplicationsTable.$inferSelect;
