import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import storageRouter from "./storage.js";

// Admin routes
import authRouter from "./admin/auth.js";
import dashboardRouter from "./admin/dashboard.js";
import leadsRouter from "./admin/leads.js";
import activitiesRouter from "./admin/activities.js";
import remindersRouter from "./admin/reminders.js";
import adminProjectsRouter from "./admin/projects.js";
import adminBlogRouter from "./admin/blog.js";
import adminJobsRouter from "./admin/jobs.js";
import adminMediaArticlesRouter from "./admin/mediaArticles.js";
import adminMediaGalleryRouter from "./admin/mediaGallery.js";
import adminSiteSettingsRouter from "./admin/siteSettings.js";
import subscribersRouter from "./admin/subscribers.js";
import careerApplicationsRouter from "./admin/career-applications.js";
import adminHeroSlidesRouter from "./admin/heroSlides.js";
import adminBusinessHighlightsRouter from "./admin/businessHighlights.js";
import adminClientLogosRouter from "./admin/clientLogos.js";
import adminSiteConfigRouter from "./admin/siteConfig.js";
import adminCareerContentRouter from "./admin/careerContent.js";
import adminInstagramRouter from "./admin/instagram.js";
import adminAboutContentRouter from "./admin/aboutContent.js";
import adminUploadsRouter from "./admin/uploads.js";

// Public CMS routes
import publicProjectsRouter from "./public/projects.js";
import publicBlogRouter from "./public/blog.js";
import publicJobsRouter from "./public/jobs.js";
import publicMediaRouter from "./public/media.js";
import publicSiteSettingsRouter from "./public/siteSettings.js";
import publicLeadsRouter from "./public/leads.js";
import subscribeRouter from "./public/subscribe.js";
import careersRouter from "./public/careers.js";
import publicHeroSlidesRouter from "./public/heroSlides.js";
import publicBusinessHighlightsRouter from "./public/businessHighlights.js";
import publicClientLogosRouter from "./public/clientLogos.js";
import publicSiteConfigRouter from "./public/siteConfig.js";
import publicCareerContentRouter from "./public/careerContent.js";
import publicInstagramRouter from "./public/instagram.js";
import publicAboutContentRouter from "./public/aboutContent.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.use("/admin/auth", authRouter);
router.use("/admin/uploads", adminUploadsRouter);
router.use("/admin/dashboard", dashboardRouter);
router.use("/admin/leads", leadsRouter);
router.use("/admin/activities", activitiesRouter);
router.use("/admin/reminders", remindersRouter);
router.use("/admin/projects", adminProjectsRouter);
router.use("/admin/blog", adminBlogRouter);
router.use("/admin/jobs", adminJobsRouter);
router.use("/admin/media/articles", adminMediaArticlesRouter);
router.use("/admin/media/gallery", adminMediaGalleryRouter);
router.use("/admin/site-settings", adminSiteSettingsRouter);
router.use("/admin/subscribers", subscribersRouter);
router.use("/admin/career-applications", careerApplicationsRouter);
router.use("/admin/hero-slides", adminHeroSlidesRouter);
router.use("/admin/business-highlights", adminBusinessHighlightsRouter);
router.use("/admin/client-logos", adminClientLogosRouter);
router.use("/admin/site-config", adminSiteConfigRouter);
router.use("/admin/career-content", adminCareerContentRouter);
router.use("/admin/instagram", adminInstagramRouter);
router.use("/admin/about-content", adminAboutContentRouter);

// ── Public CMS ────────────────────────────────────────────────────────────────
router.use("/projects", publicProjectsRouter);
router.use("/blog", publicBlogRouter);
router.use("/jobs", publicJobsRouter);
router.use("/media", publicMediaRouter);
router.use("/site-settings", publicSiteSettingsRouter);
router.use("/hero-slides", publicHeroSlidesRouter);
router.use("/business-highlights", publicBusinessHighlightsRouter);
router.use("/client-logos", publicClientLogosRouter);
router.use("/site-config", publicSiteConfigRouter);
router.use("/career-content", publicCareerContentRouter);
router.use("/instagram", publicInstagramRouter);
router.use("/about-content", publicAboutContentRouter);

// ── Public form capture ───────────────────────────────────────────────────────
router.use("/leads", publicLeadsRouter);
router.use("/subscribe", subscribeRouter);
router.use("/careers", careersRouter);

export default router;
