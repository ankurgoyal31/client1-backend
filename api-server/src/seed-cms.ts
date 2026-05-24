import { db, pool } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  projectsTable,
  blogPostsTable,
  jobOpeningsTable,
  mediaArticlesTable,
  galleryImagesTable,
  teamMembersTable,
  siteStatsTable,
  milestonesTable,
  awardsTable,
  csrInitiativesTable,
  heroSlidesTable,
  businessHighlightsTable,
  clientLogosTable,
  siteConfigTable,
  careerPageContentTable,
  instagramPostsTable,
  aboutPageContentTable,
} from "@workspace/db/schema";

type HighlightObj = { title: string; description: string; image: string };

// Normalizes legacy `string[]` highlights or partial objects to the
// canonical `{ title, description, image }[]` shape that the public
// detail page renders as image+title+description cards.
function normHighlights(arr: unknown): HighlightObj[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    if (typeof item === "string") {
      return { title: item, description: "", image: "" };
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      return {
        title: typeof o.title === "string" ? o.title : "",
        description: typeof o.description === "string" ? o.description : "",
        image: typeof o.image === "string" ? o.image : "",
      };
    }
    return { title: "", description: "", image: "" };
  });
}

function withNormalizedHighlights<T extends { highlights?: unknown }>(p: T): T {
  return { ...p, highlights: normHighlights(p.highlights) } as T;
}

const IMG_BASE =
  "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=800&auto=format&fit=crop";
const IMG2 =
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=800&auto=format&fit=crop";
const IMG3 =
  "https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=800&auto=format&fit=crop";

// ────────────────────────────────────────────────────────────────────────────
// EXTRA dummy content (10 projects + 10 blog posts) appended to the seed so
// fresh databases come pre-populated with enough variety to make the public
// Projects and Journal pages feel full. All images are CDN-hosted (Unsplash)
// so no local image dependencies are introduced. Upserts are keyed on slug.
// ────────────────────────────────────────────────────────────────────────────
const EXTRA_PROJECTS = [
  {
    slug: "unique-aurora-heights",
    name: "Unique Aurora Heights",
    category: "RESIDENTIAL" as const,
    status: "ongoing" as const,
    address: "Sirsi Road, Vaishali Nagar Extension, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹1.15 Cr onwards",
    aboutDescription:
      "Unique Aurora Heights is a contemporary mid-rise residential development on Sirsi Road, offering 2.5 and 3 BHK homes designed around generous balconies, deep cross-ventilation and a quiet residents-only podium garden.",
    reraNumber: "RAJ/P/2024/0102",
    heroImage1:
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=1600&auto=format&fit=crop",
    heroImage2:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600&auto=format&fit=crop",
    heroImage3:
      "https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl:
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=1600&auto=format&fit=crop",
    isFeatured: true,
    featuredOrder: 4,
    featuredTabLabel: "AURORA HEIGHTS",
    featuredTitle: "Sunrise Living, Refined",
    featuredDescription:
      "Light-filled 2.5 and 3 BHK residences set above a private podium garden, designed for modern Jaipur families who want quiet, comfort and connection — without compromise.",
    bedrooms: "2.5 & 3 BHK",
    area: "1.8 Acres",
    price: "₹1.15 Cr+",
    amenities: [
      "Podium Garden",
      "Infinity Edge Pool",
      "Co-Working Lounge",
      "Yoga Pavilion",
      "Indoor Games Room",
      "Toddler Play Zone",
      "EV Charging",
      "24/7 Security",
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: [
      "Podium Garden",
      "Cross-Ventilated Plans",
      "Co-Working Lounge",
      "EV Charging Ready",
      "RERA Registered",
    ],
    faqs: [
      { question: "What unit configurations are available at Aurora Heights?", answer: "Aurora Heights offers 2.5 BHK and 3 BHK residences with deep balconies and cross-ventilation, ranging from 1,180 to 1,720 sq ft." },
      { question: "Where is the project located?", answer: "On Sirsi Road in the Vaishali Nagar Extension corridor of Jaipur, with strong connectivity to Vaishali Nagar, Ajmer Road and the upcoming Ring Road interchange." },
      { question: "Is the project RERA registered?", answer: "Yes — RERA Registration No. RAJ/P/2024/0102." },
      { question: "When is possession expected?", answer: "Phased possession is planned to begin in late 2027, with subsequent towers handed over through early 2028." },
    ],
    isActive: true,
    sortOrder: 10,
    updatedAt: new Date(),
  },
  {
    slug: "unique-azure-villas",
    name: "Unique Azure Villas",
    category: "RESIDENTIAL" as const,
    status: "completed" as const,
    address: "Bhankrota, Ajmer Road, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "Resale only",
    aboutDescription:
      "Unique Azure Villas is a fully delivered, gated villa community of 48 independent 4 BHK homes in Bhankrota — featuring private lawns, internal courtyards and a residents-only club along the central avenue.",
    reraNumber: "RAJ/P/2020/0067",
    heroImage1: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1600&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1519074069390-98277fc02a1f?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
    isFeatured: false,
    featuredOrder: 0,
    bedrooms: "4 BHK Villas",
    area: "8 Acres",
    price: "Resale only",
    amenities: ["Private Lawns", "Internal Courtyards", "Residents Club", "Swimming Pool", "Gated Security", "Solar Lighting", "Visitor Parking"],
    galleryImages: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1519074069390-98277fc02a1f?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: ["Fully Delivered", "48 Independent Villas", "Private Lawns", "Residents Club", "Active Community"],
    faqs: [
      { question: "Is Azure Villas a delivered project?", answer: "Yes — Azure Villas is a fully delivered and occupied villa community. Resale inventory is available through our resale desk." },
      { question: "What is the villa configuration?", answer: "48 independent 4 BHK villas with private lawns, internal courtyards and double-car parking." },
      { question: "Is there a residents club?", answer: "Yes — a 12,000 sq ft clubhouse with pool, gym, indoor games and a multi-purpose hall serves residents only." },
    ],
    isActive: true,
    sortOrder: 11,
    updatedAt: new Date(),
  },
  {
    slug: "unique-celestia-towers",
    name: "Unique Celestia Towers",
    category: "RESIDENTIAL" as const,
    status: "upcoming" as const,
    address: "C-Scheme Extension, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹2.95 Cr onwards",
    aboutDescription:
      "Unique Celestia Towers is an upcoming twin-tower luxury residential development on the C-Scheme Extension corridor, offering ultra-spacious 4 BHK skyhomes with private decks, double-height living rooms and a dedicated concierge floor.",
    reraNumber: "RAJ/P/2026/0027",
    heroImage1: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=1600&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1582268611958-ebfd161df9d8?q=80&w=1600&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=1600&auto=format&fit=crop",
    isFeatured: true,
    featuredOrder: 5,
    featuredTabLabel: "CELESTIA",
    featuredTitle: "Skyhomes Above C-Scheme",
    featuredDescription:
      "Twin towers. 4 BHK skyhomes. Double-height living rooms, private decks, and a residents-only sky concierge — at one of Jaipur's most coveted addresses.",
    bedrooms: "4 BHK Skyhomes",
    area: "2.4 Acres",
    price: "₹2.95 Cr+",
    amenities: ["Double-Height Living", "Private Sky Decks", "Sky Concierge Floor", "Infinity Pool", "Spa & Sauna", "Cigar Lounge", "Valet Parking"],
    galleryImages: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1582268611958-ebfd161df9d8?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: ["Twin-Tower Address", "4 BHK Skyhomes Only", "Sky Concierge", "Coming Soon", "RERA Application Filed"],
    faqs: [
      { question: "When is Celestia Towers launching?", answer: "Public launch is scheduled for Q3 2026. Pre-registration is open through our Contact page for priority allotment." },
      { question: "Are smaller units available?", answer: "Celestia is a single-configuration development — only 4 BHK skyhomes, designed to keep the community curated and the floor plate uncrowded." },
      { question: "What is the sky concierge?", answer: "A dedicated mid-tower floor with a residents lounge, a private dining room available on booking, and a 24/7 concierge desk." },
    ],
    isActive: true,
    sortOrder: 12,
    updatedAt: new Date(),
  },
  {
    slug: "unique-elite-residences",
    name: "Unique Elite Residences",
    category: "RESIDENTIAL" as const,
    status: "ongoing" as const,
    address: "Mahindra SEZ Road, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹78 L onwards",
    aboutDescription:
      "Unique Elite Residences is a contemporary 2 and 3 BHK community on Mahindra SEZ Road, designed for working professionals and young families seeking a fast commute, modern interiors and a strong amenities programme.",
    reraNumber: "RAJ/P/2024/0184",
    heroImage1: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1600&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1600&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1600&auto=format&fit=crop",
    isFeatured: false,
    featuredOrder: 0,
    bedrooms: "2 & 3 BHK",
    area: "3.2 Acres",
    price: "₹78 L+",
    amenities: ["Swimming Pool", "Fully-Equipped Gym", "Multi-Purpose Hall", "Co-Working Pods", "Cycling Track", "Toddler Zone", "Pet-Friendly Lawn", "24/7 Security"],
    galleryImages: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: ["Fast SEZ Commute", "Modular Kitchens", "Co-Working Pods", "Pet-Friendly Lawn", "RERA Registered"],
    faqs: [
      { question: "Who is Elite Residences designed for?", answer: "Elite Residences is designed primarily for working professionals and young families — units are sized and equipped for low-friction daily living." },
      { question: "How is connectivity to the SEZ?", answer: "The development sits within a 7-minute drive of the Mahindra SEZ gate, with shuttle pick-up planned at launch of possession." },
      { question: "Are kitchens delivered ready?", answer: "Yes — all units are delivered with modular kitchens and chimney/hob points pre-installed." },
    ],
    isActive: true,
    sortOrder: 13,
    updatedAt: new Date(),
  },
  {
    slug: "unique-corporate-square",
    name: "Unique Corporate Square",
    category: "COMMERCIAL" as const,
    status: "ongoing" as const,
    address: "JLN Marg, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹1.15 Cr onwards",
    aboutDescription:
      "Unique Corporate Square is a Grade-A commercial office development on JLN Marg, with full-floor plates, double-height entrance lobbies and an integrated retail concourse — built for headquarters-grade tenants.",
    reraNumber: "RAJ/P/2024/0211",
    heroImage1: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1600&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop",
    isFeatured: true,
    featuredOrder: 6,
    featuredTabLabel: "CORPORATE SQUARE",
    featuredTitle: "Grade-A. JLN Marg.",
    featuredDescription:
      "Full-floor plates, double-height lobbies and an integrated retail concourse — built to host the next generation of Jaipur's headquarters-grade businesses.",
    bedrooms: "Office Floors",
    area: "Grade-A Commercial",
    price: "₹1.15 Cr+",
    amenities: ["Full-Floor Plates", "High-Speed Elevators", "Double-Height Lobby", "Integrated Retail Concourse", "Conference Suites", "Power Backup", "Multi-Level Parking"],
    galleryImages: [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1531973576160-7125cd663d86?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: ["Headquarters-Grade", "Full-Floor Plates", "Integrated Retail", "Multi-Level Parking", "RERA Registered"],
    faqs: [
      { question: "What plate sizes are available?", answer: "Full-floor plates of approximately 18,000 sq ft, with the option to combine adjacent floors for headquarters-scale occupiers." },
      { question: "Is there retail on-site?", answer: "Yes — the ground and first floors host an integrated retail concourse with F&B, wellness and convenience tenants." },
      { question: "What is the parking ratio?", answer: "1.5 cars per 1,000 sq ft of leased area, distributed across three basement levels." },
    ],
    isActive: true,
    sortOrder: 14,
    updatedAt: new Date(),
  },
  {
    slug: "unique-trade-galleria",
    name: "Unique Trade Galleria",
    category: "COMMERCIAL" as const,
    status: "ongoing" as const,
    address: "Mansarovar, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹42 L onwards",
    aboutDescription:
      "Unique Trade Galleria is a high-footfall retail and showroom development in central Mansarovar — offering double-height shopfronts, anchor retail spaces and a curated F&B promenade.",
    reraNumber: "RAJ/P/2023/0291",
    heroImage1: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1600&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&auto=format&fit=crop",
    isFeatured: false,
    featuredOrder: 0,
    bedrooms: "Retail & Showroom Units",
    area: "1.6 Acres",
    price: "₹42 L+",
    amenities: ["Double-Height Shopfronts", "Anchor Retail Bays", "F&B Promenade", "Visitor Parking", "Service Lifts", "Power Backup", "CCTV Surveillance"],
    galleryImages: [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1531973576160-7125cd663d86?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: ["High-Footfall Mansarovar", "Double-Height Shopfronts", "Curated F&B Promenade", "RERA Registered"],
    faqs: [
      { question: "What unit sizes are available?", answer: "Retail units from 280 sq ft and showroom units up to 4,200 sq ft, with optional double-height frontages." },
      { question: "Is anchor retail booked?", answer: "Anchor leasing discussions are in progress; please reach out to our commercial leasing desk for the latest mix." },
      { question: "Is the project RERA registered?", answer: "Yes — RERA Registration No. RAJ/P/2023/0291. Possession of the retail concourse is targeted for late 2026." },
    ],
    isActive: true,
    sortOrder: 15,
    updatedAt: new Date(),
  },
  {
    slug: "unique-tech-park-91",
    name: "Unique Tech Park 91",
    category: "COMMERCIAL" as const,
    status: "upcoming" as const,
    address: "RIICO IT Park, Sitapura, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "Lease enquiries open",
    aboutDescription:
      "Unique Tech Park 91 is an upcoming IT/ITeS-grade business park in Sitapura, designed for technology and shared-services occupiers — with column-free floor plates, redundant power and a campus-style cafeteria.",
    reraNumber: "RAJ/P/2026/0034",
    heroImage1: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?q=80&w=1600&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1600&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?q=80&w=1600&auto=format&fit=crop",
    isFeatured: false,
    featuredOrder: 0,
    bedrooms: "Office Plates",
    area: "5.4 Acres",
    price: "On Request",
    amenities: ["Column-Free Plates", "Redundant Power Feed", "Campus Cafeteria", "Shuttle Bay", "EV Fleet Charging", "Bicycle Parking", "Wellness Lawn"],
    galleryImages: [
      "https://images.unsplash.com/photo-1531973576160-7125cd663d86?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: ["IT/ITeS Grade", "Column-Free Plates", "Campus Cafeteria", "EV Fleet Charging", "Coming Soon"],
    faqs: [
      { question: "Is the project lease-only?", answer: "At launch the park will be made available primarily on long-term lease. Strata-sale enquiries can be evaluated on a case-by-case basis." },
      { question: "When will fit-out begin?", answer: "Shell handover is targeted for late 2027; tenant fit-out windows will open from Q1 2028." },
      { question: "What is the power configuration?", answer: "A redundant 11 kV feed with on-site diesel generator backup ensures uninterrupted operation for IT/ITeS occupiers, with provision for a future on-site solar plant." },
    ],
    isActive: true,
    sortOrder: 16,
    updatedAt: new Date(),
  },
  {
    slug: "unique-vista-county",
    name: "Unique Vista County",
    category: "TOWNSHIP" as const,
    status: "ongoing" as const,
    address: "Kalwar Road, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹38 L onwards",
    aboutDescription:
      "Unique Vista County is an evolving plotted township on Kalwar Road, with thoughtfully planned plot sizes, wide arterial roads, a dedicated school plot, a community park and a retail high street.",
    reraNumber: "RAJ/P/2024/0156",
    heroImage1: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1600&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=1600&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1600&auto=format&fit=crop",
    isFeatured: false,
    featuredOrder: 0,
    bedrooms: "Plots: 120 - 350 sq yd",
    area: "22 Acres",
    price: "₹38 L+",
    amenities: ["Wide Arterial Roads", "Dedicated School Plot", "Community Park", "Retail High Street", "Underground Utilities", "Solar Street Lighting", "Gated Entry"],
    galleryImages: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: ["22-Acre Township", "School Plot Reserved", "Retail High Street", "Underground Utilities", "RERA Registered"],
    faqs: [
      { question: "What plot sizes are available?", answer: "Plots range from 120 sq yd starter sizes up to 350 sq yd premium corner plots, with most inventory in the 150-200 sq yd band." },
      { question: "Is a school confirmed inside the township?", answer: "A dedicated school plot has been reserved within the master plan. The operator selection is in progress and will be announced ahead of phase 2 sales." },
      { question: "Are utilities underground?", answer: "Yes — power, telecom and water lines are routed underground throughout the township." },
    ],
    isActive: true,
    sortOrder: 17,
    updatedAt: new Date(),
  },
  {
    slug: "unique-serene-acres",
    name: "Unique Serene Acres",
    category: "TOWNSHIP" as const,
    status: "completed" as const,
    address: "Jagatpura, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "Resale only",
    aboutDescription:
      "Unique Serene Acres is a fully delivered, plotted township in Jagatpura with mature landscaping, an active resident welfare association and an in-township amphitheatre that hosts community events through the year.",
    reraNumber: "RAJ/P/2018/0044",
    heroImage1: "https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=1600&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1600&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=1600&auto=format&fit=crop",
    isFeatured: false,
    featuredOrder: 0,
    bedrooms: "Plots & Built Homes",
    area: "16 Acres",
    price: "Resale only",
    amenities: ["Mature Landscaping", "Community Amphitheatre", "Resident Association", "Jogging Loop", "Children's Park", "Grocery Plaza", "Gated Security"],
    galleryImages: [
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: ["Fully Delivered", "Mature Landscaping", "Active Community", "Amphitheatre", "Grocery Plaza"],
    faqs: [
      { question: "Is fresh inventory available?", answer: "Serene Acres is sold out from the developer side. Resale plots and a small number of built homes are available — please contact our resale desk." },
      { question: "What community programming exists?", answer: "The resident welfare association runs a calendar of events through the year — Holi, Diwali, summer movie nights and a winter food bazaar." },
      { question: "Are visitor and amenity rules enforced?", answer: "Yes — the resident welfare association manages a published rule book covering visitor entry, amenity timings and noise hours, with on-site security supporting enforcement." },
    ],
    isActive: true,
    sortOrder: 18,
    updatedAt: new Date(),
  },
  {
    slug: "unique-emerald-county",
    name: "Unique Emerald County",
    category: "TOWNSHIP" as const,
    status: "ongoing" as const,
    address: "Bagru-Mahindra Road, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹52 L onwards",
    aboutDescription:
      "Unique Emerald County is a forward-looking integrated township off the Bagru-Mahindra Road corridor, blending plotted inventory with select villa clusters, a wellness centre, a sports zone and a planned commercial high street.",
    reraNumber: "RAJ/P/2024/0228",
    heroImage1: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1600&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=1600&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
    isFeatured: false,
    featuredOrder: 0,
    bedrooms: "Plots & Villas",
    area: "34 Acres",
    price: "₹52 L+",
    amenities: ["Wellness Centre", "Sports Zone", "Commercial High Street", "Co-Working Hub", "Sewage Treatment Plant", "Solar Street Lighting", "Gated Entry"],
    galleryImages: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1519074069390-98277fc02a1f?q=80&w=1600&auto=format&fit=crop",
    ],
    highlights: ["Integrated Township", "Wellness Centre", "Sports Zone", "Commercial High Street", "RERA Registered"],
    faqs: [
      { question: "Are villas part of the same gated community?", answer: "Yes — the plotted areas and the villa clusters share a single gated boundary, common amenities and the same resident security setup." },
      { question: "What is the sewage and water plan?", answer: "Emerald County will have an in-township Sewage Treatment Plant with treated water reused for landscape irrigation." },
      { question: "When will the commercial high street be ready?", answer: "The commercial high street is being built in the second phase, with anchor tenants targeted for opening alongside the first villa-cluster handovers in 2027." },
    ],
    isActive: true,
    sortOrder: 19,
    updatedAt: new Date(),
  },
];

// Build extra blog post fixtures with timestamps relative to seed run
const _extraPostsNow = new Date();
const _daysAgo = (n: number) => {
  const d = new Date(_extraPostsNow);
  d.setDate(d.getDate() - n);
  return d;
};

const EXTRA_BLOG_POSTS = [
  {
    slug: "vastu-tips-buying-home-jaipur",
    title: "Vastu Tips for Buying a Home in Jaipur",
    category: "Vastu",
    excerpt:
      "Vastu need not be intimidating. A handful of practical principles — direction, light and flow — will quietly improve almost any home you consider in Jaipur.",
    content:
      `<p>Vastu Shastra is often introduced as a long list of don'ts. In practice, the best Vastu decisions are usually the same decisions a thoughtful architect would make anyway: front the home to good light, plan a clear flow, and place the most-used rooms where the day's energy is best.</p><h2>Five practical principles to keep in mind</h2><ul><li><strong>Entrance:</strong> A north, east, or north-east entrance is traditionally considered most auspicious. More importantly, the entrance should open onto a clean, well-lit foyer — not directly into a kitchen or bathroom.</li><li><strong>Master bedroom:</strong> Plan the master bedroom in the south-west corner, with the bed positioned so the headboard rests against a solid south or west wall.</li><li><strong>Kitchen:</strong> The south-east is the classical zone for fire, and therefore the kitchen. Cooking should ideally face east.</li><li><strong>Living room:</strong> North or east-facing living rooms tend to receive softer light through the day and feel more open.</li><li><strong>Pooja room:</strong> Quiet, north-east corner; never directly above, below, or adjacent to a bathroom.</li></ul><h2>What matters more than perfect Vastu</h2><p>Real homes rarely satisfy every classical Vastu rule. Instead of optimising for the chart, optimise for daily life — natural light, cross-ventilation, and rooms positioned for how your family actually lives. A home that feels right will almost always read well on a Vastu chart too.</p><blockquote>Good Vastu and good design rarely disagree. Where they do, choose the home that feels right when you walk in.</blockquote>`,
    heroImage:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1600&auto=format&fit=crop"],
    author: "Editorial Team",
    publishedAt: _daysAgo(56),
    isPublished: true,
    readTime: "6 min read",
    sortOrder: 7,
    updatedAt: new Date(),
  },
  {
    slug: "nri-investing-jaipur-real-estate",
    title: "An NRI's Guide to Investing in Jaipur Real Estate",
    category: "NRI",
    excerpt:
      "From FEMA basics to the practicalities of remote site visits and rental management, here's a practical playbook for NRIs evaluating Jaipur.",
    content:
      `<p>Jaipur has emerged as one of the most actively-tracked Indian markets for non-resident buyers — driven by a stable rupee return, strong end-user demand and a maturing rental market in pockets like Mansarovar, Vaishali Nagar and Jagatpura.</p><h2>The legal essentials</h2><ul><li>NRIs and OCIs may freely purchase residential and commercial property in India, except agricultural land, plantation property and farmhouses.</li><li>Funds must flow through NRE / NRO / FCNR accounts, or via inward remittance through normal banking channels.</li><li>Repatriation is permitted on the sale of up to two residential properties, subject to FEMA limits.</li></ul><h2>Practical playbook</h2><ol><li><strong>Power of attorney:</strong> Set up a registered, project-specific PoA with a trusted family member or legal counsel before you book.</li><li><strong>Remote site visits:</strong> Insist on live walkthroughs and time-stamped construction photos, not curated marketing reels.</li><li><strong>Rental management:</strong> Engage a managed-rental partner from day one if you do not have local family — empty units depreciate quickly.</li><li><strong>Tax:</strong> Plan for TDS at the time of sale (typically 20% on long-term capital gains for NRIs) and budget for chartered accountant filings.</li></ol><h2>Where the demand is</h2><p>For end-user rentals, Mansarovar, Vaishali Nagar and Mahindra SEZ adjacencies remain the most reliable. For long-term capital appreciation, watch the Ring Road interchange micro-markets and the Jagatpura corridor.</p>`,
    heroImage:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1600&auto=format&fit=crop"],
    author: "Investment Desk",
    publishedAt: _daysAgo(48),
    isPublished: true,
    readTime: "8 min read",
    sortOrder: 8,
    updatedAt: new Date(),
  },
  {
    slug: "sustainable-construction-india",
    title: "Sustainable Construction: What Genuine Green Building Looks Like",
    category: "Sustainability",
    excerpt:
      "Beyond the labels and logos, sustainable construction is about three quiet decisions: less embodied carbon, less operational energy, and less water.",
    content:
      `<p>The phrase "green building" is now so commonly used that it has begun to lose meaning. In construction practice, only three things genuinely matter — and all three are decided long before the building is occupied.</p><h2>1. Embodied carbon</h2><p>The carbon spent in <em>making</em> a building (cement, steel, transport) often outweighs the carbon spent in operating it for the first 20 years. Substituting fly-ash blended cements, locally sourced stone and engineered timber reduces embodied carbon meaningfully — without compromising performance.</p><h2>2. Operational energy</h2><p>The biggest operational gains in Jaipur come from passive design: deep window reveals, light-coloured roofs, well-shaded west façades, and cross-ventilated plans that reduce dependence on air-conditioning through the year.</p><h2>3. Water</h2><p>A genuinely sustainable project recycles greywater, treats sewage on-site for landscape irrigation, and harvests every monsoon drop into the aquifer through recharge wells.</p><blockquote>The greenest building is the one whose first owner never has to retrofit it.</blockquote><p>Certifications like IGBC and GRIHA can help structure decisions, but the real test is the electricity bill, the water bill and the comfort of the residents three summers later.</p>`,
    heroImage:
      "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?q=80&w=1600&auto=format&fit=crop"],
    author: "Sustainability Desk",
    publishedAt: _daysAgo(42),
    isPublished: true,
    readTime: "7 min read",
    sortOrder: 9,
    updatedAt: new Date(),
  },
  {
    slug: "emi-vs-cash-home-purchase",
    title: "EMI or Cash? How to Think About Funding Your Home Purchase",
    category: "Investment",
    excerpt:
      "The cash-versus-loan decision is rarely a simple math problem. Here is a framework that factors in tax, opportunity cost, and the discipline of monthly payments.",
    content:
      `<p>For buyers with the option to either pay in full or take a substantial home loan, the decision is rarely a clean math problem. It is shaped by tax position, opportunity cost on the cash, and — perhaps most under-discussed — the behavioural discipline of a monthly EMI.</p><h2>Three lenses to evaluate</h2><ul><li><strong>The tax lens:</strong> Section 80C principal repayment and Section 24(b) interest deduction can together meaningfully reduce the effective cost of a home loan, especially for higher-tax-bracket buyers.</li><li><strong>The opportunity-cost lens:</strong> If your invested cash is realistically expected to compound at a higher rate than your post-tax loan rate, a partial loan often wins on paper.</li><li><strong>The behavioural lens:</strong> A monthly EMI imposes savings discipline. Buyers who pay cash often underestimate how easily liquid wealth gets reallocated to less productive uses.</li></ul><h2>A practical heuristic</h2><p>Most buyers do best with a 60-70% loan-to-value structure. It preserves liquidity for interiors, emergencies and future opportunities — while keeping the EMI well within 35% of monthly take-home income.</p><blockquote>The right answer is rarely "all cash" or "max loan". It is almost always somewhere in between.</blockquote>`,
    heroImage:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1600&auto=format&fit=crop"],
    author: "Investment Desk",
    publishedAt: _daysAgo(38),
    isPublished: true,
    readTime: "6 min read",
    sortOrder: 10,
    updatedAt: new Date(),
  },
  {
    slug: "interior-design-small-apartments",
    title: "Interior Design for Small Apartments: Make Every Square Foot Work",
    category: "Interiors",
    excerpt:
      "Compact apartments don't need clever gimmicks. They need light, restraint, vertical thinking — and a few honest rules about furniture scale.",
    content:
      `<p>Designing well for a 700–1,000 sq ft apartment is harder, not easier, than designing for a large home. Every choice carries weight. The good news is that the rules are well-understood — and most of them have nothing to do with clever folding furniture.</p><h2>Five rules that actually work</h2><ol><li><strong>Light first, furniture second.</strong> Maximise daylight before you place a single sofa. Sheer blinds beat heavy curtains in compact rooms.</li><li><strong>Pick a single material story.</strong> One floor, one wood tone, one accent metal. Visual consistency makes a small apartment feel larger.</li><li><strong>Think vertically.</strong> Floor-to-ceiling storage on one feature wall is almost always better than scattered low cabinets.</li><li><strong>Right-size the sofa.</strong> The single most common mistake in small apartments is an oversized sofa. A two-seater plus a single armchair almost always reads better than a sectional.</li><li><strong>Mirror with intent.</strong> One large, well-placed mirror opposite the brightest window doubles the perceived size of the room. A wall of small mirrors does the opposite.</li></ol><p>Small does not mean cramped. With restraint and a clear material language, a 750 sq ft apartment can feel more considered than a 2,500 sq ft one.</p>`,
    heroImage:
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=1600&auto=format&fit=crop"],
    author: "Design Desk",
    publishedAt: _daysAgo(32),
    isPublished: true,
    readTime: "5 min read",
    sortOrder: 11,
    updatedAt: new Date(),
  },
  {
    slug: "amenities-that-actually-add-value",
    title: "Which Amenities Actually Add Value? A Practical Ranking",
    category: "Lifestyle",
    excerpt:
      "Not all amenities are created equal. Some quietly transform daily life. Others look great in a brochure and gather dust by year three.",
    content:
      `<p>Walk through any contemporary launch and the amenities list reads like a wishlist for a five-star resort. The truth is that residents end up using a small fraction of them. Here is how the data — and our own resident surveys — actually rank them.</p><h2>The amenities residents actually use</h2><ul><li><strong>Reliable security and visitor management.</strong> The single most-used amenity, every day, in every project.</li><li><strong>A well-maintained pool.</strong> The keyword is <em>well-maintained</em>. A poorly-kept pool is worse than no pool.</li><li><strong>A real, equipped gym.</strong> Not a token gym with three treadmills.</li><li><strong>Children's play and toddler zones.</strong> Drives daily, multi-year usage from families.</li><li><strong>Co-working / quiet study room.</strong> Increasingly the second-most-requested amenity since 2022.</li></ul><h2>Amenities that quietly disappoint</h2><ul><li>Mini-theatres (booking friction kills usage).</li><li>Squash courts (low penetration outside metros).</li><li>Spa rooms (operating cost rarely sustains them).</li></ul><blockquote>Ask not how long the amenities list is. Ask how many of them will still work, and still be maintained, in year ten.</blockquote>`,
    heroImage:
      "https://images.unsplash.com/photo-1561049501-e1f96bdd98fd?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1561049501-e1f96bdd98fd?q=80&w=1600&auto=format&fit=crop"],
    author: "Editorial Team",
    publishedAt: _daysAgo(27),
    isPublished: true,
    readTime: "5 min read",
    sortOrder: 12,
    updatedAt: new Date(),
  },
  {
    slug: "monsoon-home-maintenance-checklist",
    title: "Monsoon Home Maintenance: A Practical Checklist for Jaipur",
    category: "Maintenance",
    excerpt:
      "The Jaipur monsoon is short but intense. A few hours of preventive work in June can save weeks of repair later.",
    content:
      `<p>Compared to coastal cities, Jaipur's monsoon is short. But when it arrives, it arrives with intensity — and homes that haven't been prepared show it within a week. Here is a checklist we share with every Unique Builders resident before the season.</p><h2>Roof and terrace</h2><ul><li>Clear all rooftop drains and downpipe inlets of leaves and debris.</li><li>Inspect the terrace waterproofing membrane for blisters or cracks; touch up immediately.</li><li>Re-grout any tile joints that have opened up over the year.</li></ul><h2>Walls and openings</h2><ul><li>Inspect external paint, particularly on the south-west elevation, for blistering or chalking.</li><li>Reseal window perimeters and balcony door thresholds with silicone where joints look tired.</li><li>Service or replace weather-stripping on main entrance doors.</li></ul><h2>Electricals and safety</h2><ul><li>Test all RCCBs and earth-leakage trips before the first heavy shower.</li><li>Inspect external light fixtures and CCTV housings for water ingress.</li></ul><blockquote>A two-hour monsoon prep walkthrough in June reliably prevents the three-week repair project in September.</blockquote>`,
    heroImage:
      "https://images.unsplash.com/photo-1503453363464-743ea7b1b51d?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1503453363464-743ea7b1b51d?q=80&w=1600&auto=format&fit=crop"],
    author: "Operations Desk",
    publishedAt: _daysAgo(22),
    isPublished: true,
    readTime: "4 min read",
    sortOrder: 13,
    updatedAt: new Date(),
  },
  {
    slug: "choosing-second-home-jaipur",
    title: "Choosing a Second Home Near Jaipur: What to Actually Evaluate",
    category: "Lifestyle",
    excerpt:
      "A second home is bought with the heart and lived in by the calendar. Here is a framework that helps the heart and the spreadsheet agree.",
    content:
      `<p>The second-home market around Jaipur — Sariska, Pushkar, the Aravalli foothills — has grown materially since 2021. The romance is real. The risk is buying a home you'll visit four times in the first year and twice every year after.</p><h2>Three honest questions</h2><ol><li><strong>Drive time:</strong> Be honest. Anything beyond 2.5 hours from your primary residence drops use rates dramatically. Map your real Friday evening.</li><li><strong>Maintenance plan:</strong> Who looks after the house when you are not there? A managed-resort model is the most reliable; an absent caretaker is the most common reason second homes deteriorate.</li><li><strong>Resale liquidity:</strong> Hill and resort property markets are thinner than city markets. Plan for at least a 9-12 month resale window, and price the illiquidity into your offer.</li></ol><h2>What to prioritise in the build</h2><ul><li>Robust waterproofing and a low-maintenance external palette.</li><li>Lock-and-leave plumbing — every fixture should be isolatable.</li><li>Reliable backup power; second homes are often in patchy-grid locations.</li></ul><blockquote>The best second home is the one you are still using, with joy, in year five.</blockquote>`,
    heroImage:
      "https://images.unsplash.com/photo-1519074069390-98277fc02a1f?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1519074069390-98277fc02a1f?q=80&w=1600&auto=format&fit=crop"],
    author: "Editorial Team",
    publishedAt: _daysAgo(17),
    isPublished: true,
    readTime: "6 min read",
    sortOrder: 14,
    updatedAt: new Date(),
  },
  {
    slug: "real-estate-tax-benefits-india-2026",
    title: "Real Estate Tax Benefits in India: What's Available in 2026",
    category: "Investment",
    excerpt:
      "A clean summary of the deductions that still matter under the prevailing tax regime — and the ones that quietly stopped mattering.",
    content:
      `<p>Tax law around residential property has been simplified — and in some places quietly trimmed — over the last few budgets. Here is what's actually still on the table for FY 2025-26, in plain language.</p><h2>For self-occupied properties</h2><ul><li><strong>Section 24(b):</strong> Deduction of up to ₹2,00,000 per year on home loan interest, available under the old tax regime.</li><li><strong>Section 80C:</strong> Principal repayment qualifies for the standard ₹1,50,000 ceiling alongside other Section 80C investments, again under the old regime.</li><li>The new tax regime largely removes these deductions for self-occupied property, in exchange for lower headline rates.</li></ul><h2>For let-out properties</h2><ul><li>Standard 30% deduction on net annual value of rent.</li><li>Full home-loan interest deduction with no ₹2 lakh cap (subject to set-off limits with other heads of income).</li><li>Municipal taxes paid are deductible from gross rent.</li></ul><h2>On sale</h2><ul><li>Long-term capital gains tax on residential property is currently 20% with indexation, with rollover exemption available under Sections 54 and 54EC.</li><li>Plan capital-gains exemption purchases carefully against the prescribed timelines.</li></ul><blockquote>Always model the regime <em>and</em> the property together. The right home in the wrong tax regime can quietly cost you a year's interest.</blockquote>`,
    heroImage:
      "https://images.unsplash.com/photo-1554224154-26032ffc0d07?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1554224154-26032ffc0d07?q=80&w=1600&auto=format&fit=crop"],
    author: "Investment Desk",
    publishedAt: _daysAgo(11),
    isPublished: true,
    readTime: "7 min read",
    sortOrder: 15,
    updatedAt: new Date(),
  },
  {
    slug: "courtyard-architecture-rajasthan",
    title: "The Quiet Genius of Courtyard Architecture in Rajasthan",
    category: "Architecture",
    excerpt:
      "Rajasthan's traditional courtyard home solved problems modern architecture is still wrestling with. We look at what it teaches today's design language.",
    content:
      `<p>Long before mechanical air-conditioning, the traditional Rajasthani <em>haveli</em> stayed cool through the worst of the summer using a single architectural device — the central courtyard. It is one of the most under-appreciated design ideas in Indian architecture, and it has more to teach the modern apartment than most contemporary trends.</p><h2>What the courtyard actually does</h2><ul><li><strong>Thermal:</strong> Hot air rises out of the open courtyard, drawing cooler shaded air through ground-floor rooms — a passive convection loop that runs every afternoon for free.</li><li><strong>Light:</strong> The courtyard introduces daylight deep into a plan that would otherwise be dark.</li><li><strong>Privacy:</strong> Outdoor life happens inside the home, away from the street — a fundamentally different model of "outdoor".</li><li><strong>Acoustic:</strong> The courtyard absorbs and softens external noise, creating a calm interior soundscape.</li></ul><h2>Why it still matters</h2><p>In contemporary projects, even a small "lightwell" courtyard between two flats can dramatically improve daylight, ventilation and acoustic comfort. Several Unique Builders projects experiment with this: a sky-open court at the centre of the floor plate, with bedrooms ventilating into it and corridors opening onto it.</p><blockquote>The courtyard is one of those rare design ideas that solves four problems at once. Modernity has not improved on it — it has only forgotten it.</blockquote>`,
    heroImage:
      "https://images.unsplash.com/photo-1518709268805-4e9042af2176?q=80&w=1600&auto=format&fit=crop",
    contentImages: ["https://images.unsplash.com/photo-1518709268805-4e9042af2176?q=80&w=1600&auto=format&fit=crop"],
    author: "Inside Unique",
    publishedAt: _daysAgo(4),
    isPublished: true,
    readTime: "6 min read",
    sortOrder: 16,
    updatedAt: new Date(),
  },
];

// ────────────────────────────────────────────────────────────────────────────
// PRIOR dummy content (4 projects + 6 blog posts) — mirrors entries that
// were previously inserted into the live DB via ad-hoc SQL and must also
// appear on a fresh seed run so that totals reach 18 projects + 22 blog
// posts on a clean DB. Intentionally kept as compact mirrors of those
// historical rows (lighter content depth than the EXTRA_* arrays); they
// are seeded with onConflictDoNothing so any later admin edits in the
// CMS are preserved and never overwritten on re-seed.
// ────────────────────────────────────────────────────────────────────────────
const PRIOR_PROJECTS = [
  {
    slug: "unique-the-address",
    name: "Unique The Address",
    category: "RESIDENTIAL" as const,
    status: "ongoing" as const,
    address: "Civil Lines, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹2.4 Cr onwards",
    aboutDescription:
      "Unique The Address is a flagship residential development in Civil Lines offering thoughtfully designed 3 and 4 BHK luxury apartments with panoramic city views and a curated set of premium amenities.",
    reraNumber: "RAJ/P/2024/0023",
    heroImage1: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1200&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1200&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1200&auto=format&fit=crop",
    isFeatured: true,
    featuredOrder: 7,
    featuredTabLabel: "Featured",
    featuredTitle: "A New Standard of Address",
    featuredDescription:
      "Spacious 3 and 4 BHK luxury homes set in one of Jaipur's most sought-after localities.",
    bedrooms: "3 & 4 BHK",
    area: "Luxury Residences",
    price: "₹2.4 Cr+",
    amenities: ["Concierge", "Infinity Pool", "Sky Lounge", "EV Charging", "24/7 Security", "Landscaped Gardens"],
    galleryImages: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1200&auto=format&fit=crop",
    ],
    highlights: ["Concierge Service", "Infinity Pool", "Sky Lounge", "EV Charging", "RERA Registered"],
    faqs: [
      { question: "Where is Unique The Address located?", answer: "In the heart of Civil Lines, Jaipur — a premium central locality with seamless city connectivity." },
      { question: "What unit configurations are available?", answer: "Spacious 3 BHK and 4 BHK luxury apartments with private balconies and city views." },
      { question: "Is the project RERA registered?", answer: "Yes. RERA Registration No: RAJ/P/2024/0023." },
    ],
    isActive: true,
    sortOrder: 20,
    updatedAt: new Date(),
  },
  {
    slug: "unique-business-park",
    name: "Unique Business Park",
    category: "COMMERCIAL" as const,
    status: "ongoing" as const,
    address: "Tonk Road, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹85 L onwards",
    aboutDescription:
      "Unique Business Park is a Grade-A commercial development on Tonk Road featuring premium office floors, retail spaces and built-to-suit options ideal for growing enterprises.",
    reraNumber: "RAJ/P/2024/0031",
    heroImage1: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1200&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
    isFeatured: true,
    featuredOrder: 8,
    featuredTabLabel: "Featured",
    featuredTitle: "Workspaces, Reimagined",
    featuredDescription: "A Grade-A commercial address designed for productivity, prestige and connectivity.",
    bedrooms: "Office floors",
    area: "Premium Commercial",
    price: "₹85 L+",
    amenities: ["High-Speed Elevators", "Power Backup", "Visitor Parking", "Cafeteria", "Conference Suites", "Rooftop Terrace"],
    galleryImages: [
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1531973576160-7125cd663d86?q=80&w=1200&auto=format&fit=crop",
    ],
    highlights: ["Grade-A Build Quality", "High-Speed Elevators", "Premium Cafeteria", "Ample Visitor Parking", "RERA Registered"],
    faqs: [
      { question: "What are the available unit sizes?", answer: "Office floors and retail units starting from compact suites to full floor plates." },
      { question: "Is parking available?", answer: "Yes — multi-level parking with dedicated visitor and tenant zones." },
      { question: "Is the project RERA registered?", answer: "Yes. RERA Registration No: RAJ/P/2024/0031." },
    ],
    isActive: true,
    sortOrder: 21,
    updatedAt: new Date(),
  },
  {
    slug: "unique-greens",
    name: "Unique Greens",
    category: "TOWNSHIP" as const,
    status: "completed" as const,
    address: "Ajmer Road, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "Sold Out",
    aboutDescription:
      "Unique Greens is a completed and fully delivered eco-conscious township on Ajmer Road, with thoughtfully landscaped community spaces, jogging trails and a vibrant resident community.",
    reraNumber: "RAJ/P/2021/0007",
    heroImage1: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1200&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=1200&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1200&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1200&auto=format&fit=crop",
    isFeatured: false,
    featuredOrder: 0,
    bedrooms: "Plots: 150 - 400 sq yd",
    area: "Eco Township",
    price: "Sold Out",
    amenities: ["Jogging Trails", "Community Park", "Solar Lighting", "Rainwater Harvesting", "Gated Security"],
    galleryImages: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1200&auto=format&fit=crop",
    ],
    highlights: ["Eco-Conscious Design", "Jogging Trails", "Community Park", "Solar Lighting", "Fully Sold Out"],
    faqs: [
      { question: "Is Unique Greens a delivered project?", answer: "Yes — Unique Greens is a fully delivered, occupied township with an active resident community." },
      { question: "Is fresh inventory available?", answer: "The township is sold out from the developer side. Resale plots and built homes occasionally come to market — please contact our resale desk." },
      { question: "What sustainability features are included?", answer: "Township-wide rainwater harvesting, solar street lighting and a recycled-water landscape irrigation system." },
    ],
    isActive: true,
    sortOrder: 22,
    updatedAt: new Date(),
  },
  {
    slug: "unique-sky-residences",
    name: "Unique Sky Residences",
    category: "RESIDENTIAL" as const,
    status: "upcoming" as const,
    address: "JLN Marg, Jaipur",
    location: "Jaipur, Rajasthan",
    priceRange: "₹1.6 Cr onwards",
    aboutDescription:
      "Unique Sky Residences is an upcoming high-rise residential development on JLN Marg with premium 2.5, 3 and 4 BHK skyhomes designed for the next generation of Jaipur living.",
    reraNumber: "RAJ/P/2026/0019",
    heroImage1: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=1200&auto=format&fit=crop",
    heroImage2: "https://images.unsplash.com/photo-1582268611958-ebfd161df9d8?q=80&w=1200&auto=format&fit=crop",
    heroImage3: "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?q=80&w=1200&auto=format&fit=crop",
    heroImageUrl: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=1200&auto=format&fit=crop",
    isFeatured: false,
    featuredOrder: 0,
    bedrooms: "2.5, 3 & 4 BHK",
    area: "High-Rise Skyhomes",
    price: "₹1.6 Cr+",
    amenities: ["Sky Garden", "Co-working Lounge", "Kids' Indoor Play", "Yoga Deck", "Smart Home Ready", "EV Charging"],
    galleryImages: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?q=80&w=1200&auto=format&fit=crop",
    ],
    highlights: ["High-Rise Tower", "Sky Garden", "Smart Home Ready", "Coming Soon", "RERA Application Filed"],
    faqs: [
      { question: "When will Unique Sky Residences launch?", answer: "The project is launching soon. Please register your interest via our Contact page to receive priority updates." },
      { question: "What unit configurations are planned?", answer: "Premium 2.5, 3 and 4 BHK skyhomes spanning the upper floors of a single high-rise tower." },
      { question: "What smart-home features are included?", answer: "Pre-wired automation for lighting, climate, and security, plus app-controlled visitor management at handover." },
    ],
    isActive: true,
    sortOrder: 23,
    updatedAt: new Date(),
  },
];

const PRIOR_BLOG_POSTS = [
  {
    slug: "understanding-rera-jaipur-buyer-guide",
    title: "Understanding RERA in Jaipur: A First-Time Buyer's Guide",
    category: "Buying Guide",
    excerpt:
      "A practical breakdown of what RERA registration means, how to verify it, and why it matters when shortlisting your first home in Jaipur.",
    content:
      `<p>The Real Estate (Regulation and Development) Act, 2016, commonly known as RERA, was introduced to bring transparency, accountability and timely delivery into India's real estate sector. For first-time buyers in Jaipur, understanding RERA is the single most important step before signing a booking form.</p><h2>What does RERA registration actually mean?</h2><p>A RERA-registered project is one that the developer has formally declared with the state regulator (RERA Rajasthan), including project plans, approvals, the promised completion date and the dedicated escrow account where buyer payments are deposited.</p><h2>How to verify a project</h2><ul><li>Visit the official RERA Rajasthan portal.</li><li>Search by project name or registration number — every promotional brochure must list it.</li><li>Check the promised possession date and any complaints filed.</li></ul><h2>Why this matters</h2><p>If a project is not RERA registered, the developer cannot legally advertise or accept bookings for it in Rajasthan. RERA also gives you well-defined recourse if delivery is delayed beyond the committed date.</p><blockquote>Always cross-check the RERA number printed in marketing material with the official RERA portal before paying any booking amount.</blockquote>`,
    heroImage: "https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=1200&auto=format&fit=crop",
    contentImages: [],
    author: "Editorial Team",
    publishedAt: _daysAgo(14),
    isPublished: true,
    readTime: "6 min read",
    sortOrder: 17,
    updatedAt: new Date(),
  },
  {
    slug: "design-trends-luxury-apartments-2026",
    title: "Design Trends Shaping Luxury Apartments in 2026",
    category: "Design",
    excerpt:
      "From sky lounges to biophilic interiors, the language of luxury living is evolving. Here are the trends defining premium apartments this year.",
    content:
      `<p>Luxury today is no longer about ornamentation — it is about restraint, daylight, and thoughtful materials. We're seeing a clear shift in how Jaipur's premium apartments are being conceived.</p><h2>1. Biophilic interiors</h2><p>Indoor planters, double-height green walls, and natural stone accents are replacing heavy decorative trims. The brief is calm, not loud.</p><h2>2. Sky lounges over rooftop pools</h2><p>Residents are asking for shared social spaces — lounges, libraries, co-working corners — that flatter the view rather than compete with it.</p><h2>3. Smart-home readiness</h2><p>Pre-wired lighting, climate, and security automation are becoming a baseline expectation rather than a paid upgrade.</p><h2>4. Considered material palettes</h2><p>Warm neutrals, micro-cement floors, fluted oak and brushed brass are quietly replacing high-gloss marble and chrome.</p>`,
    heroImage: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1200&auto=format&fit=crop",
    contentImages: [],
    author: "Design Desk",
    publishedAt: _daysAgo(9),
    isPublished: true,
    readTime: "5 min read",
    sortOrder: 18,
    updatedAt: new Date(),
  },
  {
    slug: "why-jaipur-is-indias-quiet-real-estate-story",
    title: "Why Jaipur Is India's Quiet Real Estate Story",
    category: "Market",
    excerpt:
      "A look at why Jaipur is increasingly being seen as one of India's most balanced markets — strong fundamentals, measured growth, and genuine end-user demand.",
    content:
      `<p>While the headlines have largely belonged to NCR, MMR and Bengaluru, Jaipur has been quietly building a reputation as one of India's most stable, end-user-led real estate markets.</p><h2>Strong end-user demand</h2><p>Unlike investor-driven micro-markets, Jaipur's growth has been propped up primarily by residents upgrading from older homes — which keeps prices grounded and supply meaningful.</p><h2>Infrastructure tailwinds</h2><p>The Ring Road, Metro Phase 2 and the JEN-Delhi Expressway are reshaping commute times and unlocking new residential corridors along Ajmer Road, Tonk Road and Mansarovar Extension.</p><h2>What buyers should track</h2><ul><li>RERA registration and possession history of the developer.</li><li>Distance to upcoming Metro / Ring Road interchanges.</li><li>Quality of community amenities, not just unit area.</li></ul>`,
    heroImage: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?q=80&w=1200&auto=format&fit=crop",
    contentImages: [],
    author: "Market Desk",
    publishedAt: _daysAgo(6),
    isPublished: true,
    readTime: "7 min read",
    sortOrder: 19,
    updatedAt: new Date(),
  },
  {
    slug: "rental-vs-buying-jaipur-2026",
    title: "Rental vs Buying in Jaipur: Which Makes Sense in 2026?",
    category: "Buying Guide",
    excerpt:
      "A balanced look at the rent-vs-buy question in Jaipur today, with a simple framework to help you decide based on your timeline and life stage.",
    content:
      `<p>The rent-vs-buy question is rarely a math question alone — it is just as much about life stage, mobility and the kind of city you want to plant roots in.</p><h2>The 5-year rule</h2><p>If you expect to stay in the same city for at least five years, buying typically wins on long-term cost. Below that, renting almost always wins because of registration, stamp duty and interest paid early in the EMI cycle.</p><h2>Hidden costs to factor in</h2><ul><li>Stamp duty and registration (~6% in Rajasthan).</li><li>Society maintenance charges, especially in premium projects.</li><li>Property tax and one-time interior fit-out.</li></ul><h2>The case for buying in Jaipur right now</h2><p>End-user driven prices, RERA-protected supply, and steady infrastructure improvements make this a more forgiving market than many of the metro alternatives.</p>`,
    heroImage: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1200&auto=format&fit=crop",
    contentImages: [],
    author: "Editorial Team",
    publishedAt: _daysAgo(3),
    isPublished: true,
    readTime: "6 min read",
    sortOrder: 20,
    updatedAt: new Date(),
  },
  {
    slug: "inside-our-design-philosophy",
    title: "Inside Our Design Philosophy: Calm, Crafted, Considered",
    category: "Inside Unique",
    excerpt:
      "A short note on the principles that guide how we plan, build and detail every Unique Builders project — from the master plan to the door handle.",
    content:
      `<p>Every Unique Builders project begins with three words: <em>calm, crafted, considered</em>. This is the design language we ask every architect, contractor and material partner to speak.</p><h2>Calm</h2><p>Spaces should reduce noise, not add to it. Natural light, clear sight lines and restrained material palettes are non-negotiable starting points.</p><h2>Crafted</h2><p>Detail wins long after delivery. We obsess over the joinery, the door handles, the way a stair meets a wall.</p><h2>Considered</h2><p>Every plan choice has a reason. We model daylight, wind direction, parking flow and even sound long before construction begins. Done right, you should never notice the design — only how the home feels.</p>`,
    heroImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop",
    contentImages: [],
    author: "Founders' Note",
    publishedAt: _daysAgo(20),
    isPublished: true,
    readTime: "4 min read",
    sortOrder: 21,
    updatedAt: new Date(),
  },
  {
    slug: "choosing-the-right-floor-plan",
    title: "Choosing the Right Floor Plan: A Buyer's Checklist",
    category: "Buying Guide",
    excerpt:
      "Floor plans look similar at first glance. Here is what experienced buyers quietly look for before committing to one.",
    content:
      `<p>It is easy to fall for a glossy 3D rendering. The floor plan, however, is where you really discover whether a home will work for you.</p><h2>1. Carpet vs super built-up</h2><p>Always compare carpet area, not super built-up. The difference can be 25% or more, and only carpet area is what you actually live in.</p><h2>2. Room shape and proportion</h2><p>Long, narrow rooms are harder to furnish than square ones — even at the same area. Look at the bedroom-to-window-wall ratio.</p><h2>3. Balcony and ventilation</h2><p>A cross-ventilated apartment with usable balconies will always feel larger than a deeper apartment with a single exposure.</p><h2>4. Common-area placement</h2><p>How close is the lift? Where do utility ducts run? These decide noise levels for the next 30 years.</p>`,
    heroImage: "https://images.unsplash.com/photo-1502672023488-70e25813eb80?q=80&w=1200&auto=format&fit=crop",
    contentImages: [],
    author: "Editorial Team",
    publishedAt: _daysAgo(1),
    isPublished: true,
    readTime: "5 min read",
    sortOrder: 22,
    updatedAt: new Date(),
  },
];

async function seedCms() {
  console.log("Seeding CMS tables...");

  // ── Projects ──────────────────────────────────────────────────────────────
  // All 3 featured projects (from FeaturedDevelopments.jsx) + city-unique-life base project.
  // FAQs for unique-green-meadows and unique-new-town taken from the shared
  // ProjectDetail*/Faq.jsx faqData[] array (both detail pages use identical Green Meadows FAQs).
  const GREEN_MEADOWS_FAQS = [
    {
      question: "What is Unique Green Meadows and where is it located? ",
      answer: "Unique Green Meadows is a residential project by Unique Builders. It is located on 200-ft Main Tonk Road, Shivdaspura / Choki Dhani area, Jaipur.   ",
    },
    {
      question: "What kinds of apartments are offered at Unique Green Meadows, and what are their sizes?  ",
      answer: "The project offers 1 BHK, 2 BHK and 3 BHK \u201cluxury\u201d apartments. Saleable areas are approximately: 1 BHK = 681 sq ft, 2 BHK = 1008 sq ft, 3 BHK = 1397 sq ft.",
    },
    {
      question: "What is the starting price of apartments at Unique Green Meadows? ",
      answer: "Prices start from around \u20b9 30 lakhs (as stated in the official overview).     ",
    },
    {
      question: "Is Unique Green Meadows registered with RERA? ",
      answer: "Yes, its RERA Registration Number is RAJ/P/2017/200  ",
    },
    {
      question: " What amenities does Unique Green Meadows provide?",
      answer: "Amenities include a clubhouse, landscaped open spaces (-2 lakh sq ft), kids\u2019 play area, cycling track, splash pool, yoga corner, gym, swimming pool, games room, senior-citizen corner, landscaped garden, and more. ",
    },
    {
      question: "What is the infrastructure / construction specification of apartments (flooring, structure etc.)? ",
      answer: "The structure is RCC framed. Interiors use vitrified / tile flooring; kitchens have granite tops with sinks; bathrooms have anti-skid tiles; balconies tiled with MS railings; corridors/lift lobbies have ceramic/vitrified or equivalent tile flooring; walls finished in oil-bound distemper. ",
    },
    {
      question: "What is the \u201cmaster plan\u201d or open-space / layout like?",
      answer: "The project claims - 2 lakh sq ft of open and landscaped area along with a grand clubhouse; spacious layout and significant open/green spaces. ",
    },
    {
      question: "What are the connectivity / nearby landmarks or conveniences? ",
      answer: "According to one listing: schools, airports (10\u201311 km), bus stands/transport links are reasonably accessible. ",
    },
    {
      question: " What is the current status of the project / construction (as per last update)?",
      answer: "As of the last noted construction status (on the project page), the date shown is 20-Sep-2022.  ",
    },
    {
      question: "Who is the developer / builder behind Unique Green Meadows?",
      answer: "The project is by Unique Builders a major real estate developer active in Jaipur and across Rajasthan. ",
    },
  ];

  // Project image paths (served from artifacts/unique-builders/public/img/projects/)
  const IS_PARADISE_PLANS = [
    "/img/projects/is-paradise-plan1.png",
    "/img/projects/is-paradise-plan2.png",
    "/img/projects/is-paradise-plan3.png",
    "/img/projects/is-paradise-plan4.png",
    "/img/projects/is-paradise-plan5.png",
    "/img/projects/is-paradise-plan6.png",
    "/img/projects/is-paradise-plan7.png",
  ];
  const IS_PARADISE_AMENITIES = [
    "/img/projects/is-paradise-amenities1.png",
    "/img/projects/is-paradise-amenities2.png",
    "/img/projects/project-amenities.png",
  ];
  const IS_PARADISE_CONSTRUCTION = [
    "/img/projects/is-paradise-construction1.png",
    "/img/projects/is-paradise-construction2.png",
    "/img/projects/is-paradise-construction3.png",
    "/img/projects/project-construction.jpg",
  ];
  const IS_PARADISE_GALLERY = [
    "/img/projects/is-paradise-gallery1.png",
    "/img/projects/is-paradise-gallery2.png",
    "/img/projects/is-paradise-gallery3.png",
    "/img/projects/project-gallery.png",
  ];

  // One-time data migration: convert any existing rows whose `highlights`
  // jsonb column still holds the legacy `string[]` shape into the new
  // `{ title, description, image }[]` object shape that the public detail
  // page renders. Idempotent — only touches rows that contain string
  // elements, so re-seeding never undoes admin-edited rich highlights.
  await db.execute(sql`
    UPDATE projects
    SET highlights = (
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN jsonb_typeof(elem) = 'string'
              THEN jsonb_build_object('title', elem #>> '{}', 'description', '', 'image', '')
            ELSE elem
          END
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(highlights) elem
    )
    WHERE jsonb_typeof(highlights) = 'array'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(highlights) e WHERE jsonb_typeof(e) = 'string'
      );
  `);

  // Bootstrap the 4 canonical projects. See the comment block below the
  // values array for the conflict-resolution strategy (RESEED_CORE escape
  // hatch).
  const coreProjectValues = [
      {
        slug: "city-unique-life",
        name: "City Unique Life",
        category: "TOWNSHIP",
        status: "ongoing",
        address: "Mansarovar Extension, Jaipur",
        location: "Jaipur, Rajasthan",
        priceRange: "₹45 L onwards",
        aboutDescription:
          "City Unique Life is a landmark township development offering modern plotting with world-class infrastructure and community amenities in the heart of Jaipur's fastest-growing corridor.",
        reraNumber: "RAJ/P/2024/0001",
        heroImage1: "/img/projects/project-intro.png",
        heroImage2: "/img/projects/project-about.png",
        heroImage3: "/img/projects/project-gallery.png",
        heroImageUrl: "/img/projects/project-intro.png",
        galleryImages: [
          "/img/projects/project-gallery.png",
          "/img/projects/project-about.png",
          "/img/projects/project-amenities.png",
        ],
        amenities: [
          "Gated Community",
          "24/7 Security",
          "Club House",
          "Landscaped Gardens",
          "Wide Internal Roads",
          "Children's Play Area",
        ],
        bedrooms: "Plots: 100 - 300 sq yd",
        area: "Modern Plotting Township",
        highlights: [
          "Gated Township",
          "24/7 Security",
          "Club House",
          "Landscaped Gardens",
          "Wide Internal Roads",
          "RERA Registered",
        ],
        faqs: [
          {
            question: "What is City Unique Life?",
            answer:
              "City Unique Life is a landmark township development by Unique Builders, offering modern plotting with world-class infrastructure and community amenities in the heart of Jaipur's fastest-growing corridor.",
          },
          {
            question: "Where is City Unique Life located?",
            answer:
              "The township is located in Mansarovar Extension, Jaipur — a rapidly developing residential corridor with strong connectivity to the city centre.",
          },
          {
            question: "Is City Unique Life RERA registered?",
            answer:
              "Yes. The RERA registration number for City Unique Life is RAJ/P/2024/0001.",
          },
          {
            question: "What kind of plots are available at City Unique Life?",
            answer:
              "City Unique Life offers a range of modern, ready-to-build plots in a fully gated township. Plot sizes are designed to suit a variety of family needs.",
          },
          {
            question: "What are the prices at City Unique Life?",
            answer:
              "Plots at City Unique Life start from ₹45 Lakhs onwards. Please contact our sales team for the current price list and availability.",
          },
          {
            question: "What amenities are available within the township?",
            answer:
              "The township offers a clubhouse, 24/7 security, landscaped gardens, wide internal roads, a children's play area and other community amenities expected of a premium gated township.",
          },
        ],
        isActive: true,
        sortOrder: 1,
        updatedAt: new Date(),
      },
      {
        slug: "is-paradise",
        name: "IS Paradise",
        category: "RESIDENTIAL",
        status: "ongoing",
        address: "200 Ft. Main Tonk Road, Jaipur",
        location: "Jaipur, Rajasthan",
        priceRange: "₹ 1.29* Cr onwards",
        aboutDescription:
          "IS Paradise reshapes city living through its rare 70:30 green-to-built ratio, expansive water features and thoughtfully created celebration spaces.",
        reraNumber: "RAJ/P/2019/0245",
        heroImage1: IS_PARADISE_GALLERY[0],
        heroImage2: IS_PARADISE_GALLERY[1],
        heroImage3: IS_PARADISE_GALLERY[2],
        amenities: ["Swimming Pool", "GYM", "Game Area", "Kids Play Area"],
        price: "₹ 1.29* Cr onwards",
        bedrooms: "2 & 3 BHK",
        area: "4.38 Acres",
        isFeatured: true,
        featuredOrder: 1,
        featuredTabLabel: "IS PARADISE",
        featuredTitle: "Where 70% of Life Feels Green",
        featuredDescription:
          "IS Paradise reshapes city living through its rare 70:30 green-to-built ratio, expansive water features and thoughtfully created celebration spaces. Spacious flat layouts, calm landscapes and refined planning come together to offer a living experience distinctly ahead of Jaipur's contemporary residential developments.",
        videoUrl: "/assets/IsParadise.mp4",
        reelUrl: "/assets/IsParadise.mp4",
        heroImageUrl: IS_PARADISE_GALLERY[0],
        galleryImages: IS_PARADISE_GALLERY,
        planImages: IS_PARADISE_PLANS,
        amenityImages: IS_PARADISE_AMENITIES,
        constructionImages: IS_PARADISE_CONSTRUCTION,
        masterPlanImage: IS_PARADISE_PLANS[0],
        floorPlanImage: IS_PARADISE_PLANS[1],
        locationImage: "/img/projects/project-location.png",
        googleMapsLink:
          "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3558.0416859980805!2d75.7742245!3d26.9021721!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x396db46efb1eaf25%3A0x70a50618b4db7a87!2sUnique%20IS%20Paradise!5e0!3m2!1sen!2sin!4v1777007476147!5m2!1sen!2sin",
        highlights: [
          "70:30 Green-to-Built Ratio",
          "Expansive Water Features",
          "Celebration Spaces",
          "Spacious Flat Layouts",
          "Calm Landscapes",
        ],
        // ProjectDetailIS/Faq.jsx faqData[] — component uses Green Meadows content
        faqs: GREEN_MEADOWS_FAQS,
        isActive: true,
        sortOrder: 2,
        updatedAt: new Date(),
      },
      {
        slug: "unique-green-meadows",
        name: "Unique Green Meadows",
        category: "RESIDENTIAL",
        status: "ongoing",
        address: "200-ft Main Tonk Road, Shivdaspura, Jaipur",
        location: "Jaipur, Rajasthan",
        priceRange: "₹ 30 Lakhs onwards",
        aboutDescription:
          "With fifteen acres of thoughtfully planned openness, Green Meadows offers space for children to play, adults to unwind and families to grow comfortably together.",
        reraNumber: "RAJ/P/2017/200",
        heroImage1: "/img/projects/project-intro.png",
        heroImage2: "/img/projects/project-about.png",
        heroImage3: "/img/projects/project-gallery.png",
        amenities: [
          "Swimming Pool",
          "GYM",
          "Game Area",
          "Kids Play Area",
          "Cycling Track",
          "Yoga Corner",
          "Senior Citizen Corner",
          "Clubhouse",
        ],
        price: "₹ 30 Lakhs onwards",
        bedrooms: "1, 2 & 3 BHK",
        area: "15 Acres",
        isFeatured: true,
        featuredOrder: 2,
        featuredTabLabel: "UNIQUE GREEN MEADOWS",
        featuredTitle: "More Life with More Amenities",
        featuredDescription:
          "With fifteen acres of thoughtfully planned openness, Green Meadows offers space for children to play, adults to unwind and families to grow comfortably together, supported by calm surroundings and smooth connectivity along the expanding 200-foot Tonk Road development corridor.",
        reelUrl: "/assets/Greenmeadow.mp4",
        heroImageUrl: "/img/projects/project-intro.png",
        galleryImages: [
          "/img/projects/project-gallery.png",
          "/img/projects/project-about.png",
          "/img/projects/project-amenities.png",
          "/img/projects/project-plan.png",
        ],
        highlights: [
          "15-Acre Development",
          "200-ft Tonk Road Connectivity",
          "Clubhouse",
          "Kids Play Area",
          "Cycling Track",
        ],
        // ProjectDetail/Faq.jsx faqData[] (10 items)
        faqs: GREEN_MEADOWS_FAQS,
        isActive: true,
        sortOrder: 3,
        updatedAt: new Date(),
      },
      {
        slug: "unique-new-town",
        name: "Unique New Town",
        category: "RESIDENTIAL",
        status: "ongoing",
        address: "New Township Road, Jaipur",
        location: "Jaipur, Rajasthan",
        priceRange: "₹ 30 Lakhs onwards",
        aboutDescription:
          "By dedicating each floor to a single family, Unique New Town brings a rare clarity to planning, emphasising quiet environments, spatial freedom and a premium sense of belonging.",
        reraNumber: "RAJ/P/2022/0388",
        heroImage1: "/img/projects/project-about.png",
        heroImage2: "/img/projects/project-intro.png",
        heroImage3: "/img/projects/project-gallery.png",
        amenities: ["Swimming Pool", "GYM", "Game Area", "Kids Play Area"],
        price: "₹ 30 Lakhs onwards",
        bedrooms: "1, 2 & 3 BHK",
        area: "5 Acres",
        isFeatured: true,
        featuredOrder: 3,
        featuredTabLabel: "UNIQUE NEW TOWN",
        featuredTitle: "A New Benchmarks of Low-Density Living",
        featuredDescription:
          "By dedicating each floor to a single family, the project brings a rare clarity to planning, emphasising quiet environments, spatial freedom and a premium sense of belonging. Its nearly five-acre total land area with curated clubhouse and thoughtfully designed outdoor spaces further strengthen its distinct residential character.",
        reelUrl: "/assets/Newtown.mp4",
        heroImageUrl: "/img/projects/project-about.png",
        galleryImages: [
          "/img/projects/project-about.png",
          "/img/projects/project-intro.png",
          "/img/projects/project-gallery.png",
          "/img/projects/project-amenities.png",
        ],
        highlights: [
          "Independent Floors",
          "Low-Density Living",
          "5-Acre Development",
          "Curated Clubhouse",
          "Thoughtfully Designed Outdoor Spaces",
        ],
        // ProjectDetailNewtown/Faq.jsx faqData[] — component uses Green Meadows content
        faqs: GREEN_MEADOWS_FAQS,
        isActive: true,
        sortOrder: 4,
        updatedAt: new Date(),
      },
    ].map(withNormalizedHighlights);

  // NOTE (Task #47, validated): The 4 core projects are bootstrap-only.
  // We deliberately use `onConflictDoNothing` so admin edits made via
  // the dashboard for these slugs are NEVER overwritten by re-running
  // `pnpm seed:cms`. Rationale:
  //   1. Once the admin Projects CRUD page shipped, the database became
  //      the source of truth for project content; re-applying the
  //      hard-coded canonical values would clobber legitimate edits
  //      and silently revert customer-facing changes.
  //   2. EXTRA_PROJECTS and PRIOR_PROJECTS already follow this
  //      "bootstrap once, then owned by admin" model — the 4 core
  //      projects now match that contract for consistency.
  //   3. Operators who genuinely need to re-sync the canonical seed
  //      values (e.g. restoring a corrupted environment) can set
  //      RESEED_CORE=1 in the env to force an upsert.
  const reseedCore = process.env.RESEED_CORE === "1";
  if (reseedCore) {
    // Re-sync ALL canonical content fields for the core 4. We deliberately
    // exclude id / slug / createdAt / isActive / sortOrder so admin-managed
    // ordering and visibility flags are preserved across reseeds.
    await db
      .insert(projectsTable)
      .values(coreProjectValues)
      .onConflictDoUpdate({
        target: projectsTable.slug,
        set: {
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          status: sql`excluded.status`,
          address: sql`excluded.address`,
          location: sql`excluded.location`,
          priceRange: sql`excluded.price_range`,
          aboutDescription: sql`excluded.about_description`,
          reraNumber: sql`excluded.rera_number`,
          heroImage1: sql`excluded.hero_image_1`,
          heroImage2: sql`excluded.hero_image_2`,
          heroImage3: sql`excluded.hero_image_3`,
          heroImageUrl: sql`excluded.hero_image_url`,
          bedrooms: sql`excluded.bedrooms`,
          area: sql`excluded.area`,
          highlights: sql`excluded.highlights`,
          amenities: sql`excluded.amenities`,
          galleryImages: sql`excluded.gallery_images`,
          updatedAt: new Date(),
        },
      });
    console.log("Re-synced 4 core projects (RESEED_CORE=1)");
  } else {
    await db
      .insert(projectsTable)
      .values(coreProjectValues)
      .onConflictDoNothing({ target: projectsTable.slug });
    console.log(
      "Bootstrapped 4 core projects (skip-on-conflict; set RESEED_CORE=1 to re-sync)",
    );
  }

  // ── Additional dummy projects (10) ────────────────────────────────────────
  // Variety: 4 Residential, 3 Commercial, 3 Township across ongoing /
  // completed / upcoming. All use Unsplash CDN images so they are safe to
  // re-seed in any environment without local image dependencies.
  // Use onConflictDoNothing so admin-edited content is never overwritten on
  // re-seed; these dummy entries are seeded once and remain editable in the
  // admin dashboard thereafter.
  await db.insert(projectsTable).values(EXTRA_PROJECTS.map(withNormalizedHighlights)).onConflictDoNothing({
    target: projectsTable.slug,
  });
  console.log(`Seeded ${EXTRA_PROJECTS.length} additional dummy projects (skip-on-conflict)`);

  // ── Prior dummy projects (4) — mirror of earlier ad-hoc inserts ──────────
  await db.insert(projectsTable).values(PRIOR_PROJECTS.map(withNormalizedHighlights)).onConflictDoNothing({
    target: projectsTable.slug,
  });
  console.log(`Seeded ${PRIOR_PROJECTS.length} prior dummy projects (skip-on-conflict)`);

  // ── Blog Posts ────────────────────────────────────────────────────────────
  // Uses upsert (onConflictDoUpdate) so existing rows are always updated to
  // the latest content, images, and metadata — even on re-runs.
  await db.insert(blogPostsTable).values([
      {
        slug: "designing-homes-that-feel-timeless",
        title: "Designing Homes That Feel Timeless",
        category: "Architecture",
        excerpt:
          "Timeless design is not about following trends — it is about creating spaces that remain beautiful and relevant across generations. At Unique Builders, every project begins with a question: will this still feel right in twenty years?",
        content:
          "Timeless design is not about following trends — it is about creating spaces that remain beautiful and relevant across generations. At Unique Builders, every project begins with a question: will this still feel right in twenty years? From material selection to spatial proportions, every decision is guided by durability, elegance, and purpose.\n\nThe most enduring homes share a common language: restraint in ornament, generosity in space, and honesty in material. Stone that ages with grace, wood that warms over decades, concrete that carries its own quiet dignity. These are not design choices made for a particular moment — they are commitments made to the people who will live in these homes long after the original trends have shifted.\n\nAt every Unique Builders project, the design team works with this long view in mind. Facades are studied not just for their immediate visual impact but for how they will weather, how they will absorb the light of each season, and how they will read from the street in ten, twenty, or thirty years. The result is architecture that asks to be lived in, not merely admired.",
        heroImage: "/img/blog/blogdetail1.png",
        contentImages: ["/img/blog/blogdetail1.png", "/img/blog/blogdetail2.png", "/img/blog/blogdetail3.png"],
        author: "Unique Builders Editorial",
        publishedAt: new Date("2025-04-10T10:00:00Z"),
        isPublished: true,
        readTime: "5 min read",
        sortOrder: 1,
        updatedAt: new Date(),
      },
      {
        slug: "how-natural-light-shapes-better-living-spaces",
        title: "How Natural Light Shapes Better Living Spaces",
        category: "Interior Design",
        excerpt:
          "The way light moves through a home defines how people feel in it. Good design makes natural light a feature, not an afterthought — transforming ordinary rooms into spaces that change with the day.",
        content:
          "The way light moves through a home defines how people feel in it. At Unique Builders, orientation studies, window placement, and reflective surfaces are core design decisions — not afterthoughts. Natural light reduces energy consumption, improves mood, and makes spaces feel larger and more connected to their environment.\n\nEvery floor plan begins with a sun study. Which rooms need morning light to ease the start of the day? Which spaces benefit from afternoon warmth? Where should light be filtered, diffused, or kept entirely indirect to create calm? These are not decorative questions — they are fundamental to the way a home feels at every hour.\n\nThe integration of courtyards, skylights, and deep window reveals allows Unique Builders projects to balance brightness with thermal comfort. In the Jaipur climate, this balance is essential. Homes that are flooded with unfiltered western light in summer become difficult to live in — but homes that are designed with precise orientation and shading remain comfortable, beautiful, and naturally lit through every season.",
        heroImage: "/img/blog/blogdetail2.png",
        contentImages: ["/img/blog/blogdetail2.png", "/img/blog/blogdetail3.png", "/img/blog/blogdetail4.png"],
        author: "Unique Builders Editorial",
        publishedAt: new Date("2025-03-24T10:00:00Z"),
        isPublished: true,
        readTime: "6 min read",
        sortOrder: 2,
        updatedAt: new Date(),
      },
      {
        slug: "details-that-elevate-everyday-residential-living",
        title: "Details That Elevate Everyday Residential Living",
        category: "Lifestyle",
        excerpt:
          "Premium living is not just about square footage. It is about the quality of every finish, fixture, and spatial transition that shapes daily life — the details that make a home feel right long after moving in.",
        content:
          "Premium living is not just about square footage. It is about the quality of every finish, fixture, and spatial transition that shapes daily life. Unique Builders sources materials from trusted suppliers, specifies anti-skid flooring in wet areas, and designs kitchens around actual cooking workflows — not just visual appeal.\n\nThe difference between a good home and a great one is felt most in the small things: the weight of a door handle, the depth of a kitchen counter, the way a tap sits flush with its surround. At Unique Builders, specification teams work with architects and interior consultants to ensure that every touchpoint meets a consistent standard of quality — from entrance lobby to private terrace.\n\nThis attention to detail extends to the invisible elements of a home as well. Electrical layouts that anticipate how a room will be used. Plumbing that is routed to allow for future fixture upgrades. Walls that are finished to a standard that permits paint, wallpaper, or panelling without preparation. These are the details that make daily life effortless.",
        heroImage: "/img/blog/blogdetail3.png",
        contentImages: ["/img/blog/blogdetail3.png", "/img/blog/blogdetail4.png", "/img/blog/blogdetail1.png"],
        author: "Unique Builders Editorial",
        publishedAt: new Date("2025-03-10T10:00:00Z"),
        isPublished: true,
        readTime: "4 min read",
        sortOrder: 3,
        updatedAt: new Date(),
      },
      {
        slug: "the-role-of-landscape-in-premium-communities",
        title: "The Role of Landscape in Premium Communities",
        category: "Township Planning",
        excerpt:
          "A well-planned landscape is not decorative — it shapes community identity, improves air quality, and creates spaces for real social connection. The best communities are defined as much by their open spaces as by the homes within them.",
        content:
          "A well-planned landscape is not decorative — it shapes community identity, improves air quality, and creates spaces for real social connection. Township projects by Unique Builders integrate native planting, walking paths, water features, and shaded gathering areas designed by specialist landscape architects.\n\nIn large-scale residential communities, the landscape is the shared living room. It is where children grow up, where neighbours become friends, and where residents experience the rhythm of seasons. At Unique Builders, landscape design begins alongside the first architectural drawings — not as an afterthought applied to leftover space, but as a primary ingredient in how a community feels.\n\nThe planting palette for each project is selected for the Rajasthan climate: species that thrive in dry heat, that provide real shade, that flower seasonally and attract birds and pollinators. Water is managed carefully, with retention systems and irrigation designed to minimise consumption. The result is landscape that grows richer and more beautiful with each passing year.",
        heroImage: "/img/blog/blogdetail4.png",
        contentImages: ["/img/blog/blogdetail4.png", "/img/blog/blogdetail1.png", "/img/blog/blogdetail2.png"],
        author: "Unique Builders Editorial",
        publishedAt: new Date("2025-02-20T10:00:00Z"),
        isPublished: true,
        readTime: "5 min read",
        sortOrder: 4,
        updatedAt: new Date(),
      },
      {
        slug: "materials-mood-and-the-character-of-a-home",
        title: "Materials, Mood, and the Character of a Home",
        category: "Interior Design",
        excerpt:
          "The materials inside a home do more than cover surfaces — they define its character, its warmth, and the way people connect with the space. Stone, wood, and metal each carry a different sensory weight.",
        content:
          "The materials inside a home do more than cover surfaces — they define its character, its warmth, and the way people connect with the space. Stone, wood, and metal each carry a different sensory weight. At Unique Builders, material palettes are assembled not just for aesthetics but for tactile quality, maintenance ease, and long-term durability.\n\nThe best material decisions are made when function and beauty are considered together. Vitrified tile that is easy to clean but visually rich. Granite countertops that resist staining and age gracefully under daily use. Timber that brings warmth to a space while being treated for moisture resistance. Each material in a Unique Builders home earns its place through performance, not just appearance.\n\nMood in a home is often traced back to material choices made before the furniture arrived. A room finished in pale stone feels calm and expansive. One lined with warm wood panelling feels anchored and intimate. At Unique Builders, the material language of each project is established early in the design process and held consistently from the entrance threshold to the innermost bedroom.",
        heroImage: "/img/blog/blogdetail2.png",
        contentImages: ["/img/blog/blogdetail2.png", "/img/blog/blogdetail4.png", "/img/blog/blogdetail3.png"],
        author: "Unique Builders Editorial",
        publishedAt: new Date("2025-02-05T10:00:00Z"),
        isPublished: true,
        readTime: "5 min read",
        sortOrder: 5,
        updatedAt: new Date(),
      },
      {
        slug: "creating-spaces-that-balance-elegance-and-function",
        title: "Creating Spaces That Balance Elegance and Function",
        category: "Architecture",
        excerpt:
          "True design excellence is measured by how well a space serves its occupants every day — not just how it photographs at launch. Elegance and function are not opposing forces; the best homes achieve both without compromise.",
        content:
          "True design excellence is measured by how well a space serves its occupants every day — not just how it photographs at launch. Unique Builders approaches every floor plan with the discipline of functional analysis: where does natural traffic flow, how does the kitchen relate to the dining area, how much privacy does each bedroom offer? Elegance follows from this foundation — it does not precede it.\n\nThe planning of a home is a series of relationships. The relationship between kitchen and dining room defines how families cook and eat together. The relationship between living room and terrace determines how interior and exterior life connect. The relationship between bedrooms and bathrooms shapes the morning rhythm of every resident. At Unique Builders, these relationships are examined and refined through multiple planning iterations before a single wall is positioned.\n\nElegance, when it is genuine, is the result of decisions made with integrity. A beautifully proportioned window that also ventilates effectively. A kitchen island that provides prep space, breakfast seating, and storage simultaneously. A corridor that is wide enough to feel generous without wasting floor area. This is design thinking that produces homes that are both beautiful and deeply livable.",
        heroImage: "/img/blog/blogdetail3.png",
        contentImages: ["/img/blog/blogdetail3.png", "/img/blog/blogdetail1.png", "/img/blog/blogdetail4.png"],
        author: "Unique Builders Editorial",
        publishedAt: new Date("2025-01-22T10:00:00Z"),
        isPublished: true,
        readTime: "6 min read",
        sortOrder: 6,
        updatedAt: new Date(),
      },
    ]).onConflictDoUpdate({
    target: blogPostsTable.slug,
    set: {
      title: sql`excluded.title`,
      category: sql`excluded.category`,
      excerpt: sql`excluded.excerpt`,
      content: sql`excluded.content`,
      heroImage: sql`excluded.hero_image`,
      contentImages: sql`excluded.content_images`,
      author: sql`excluded.author`,
      publishedAt: sql`excluded.published_at`,
      isPublished: sql`excluded.is_published`,
      readTime: sql`excluded.read_time`,
      sortOrder: sql`excluded.sort_order`,
      updatedAt: sql`excluded.updated_at`,
    },
  });
  console.log("Upserted 6 blog posts");

  // ── Additional dummy blog posts (10) ──────────────────────────────────────
  // Topics span Vastu, NRI investing, sustainability, EMI vs cash, small-
  // apartment interiors, amenities, monsoon maintenance, second homes, tax
  // benefits, and courtyard architecture. All hero images are CDN-hosted.
  // Use onConflictDoNothing so admin-edited content is never overwritten.
  await db.insert(blogPostsTable).values(EXTRA_BLOG_POSTS).onConflictDoNothing({
    target: blogPostsTable.slug,
  });
  console.log(`Seeded ${EXTRA_BLOG_POSTS.length} additional dummy blog posts (skip-on-conflict)`);

  // ── Prior dummy blog posts (6) — mirror of earlier ad-hoc inserts ────────
  await db.insert(blogPostsTable).values(PRIOR_BLOG_POSTS).onConflictDoNothing({
    target: blogPostsTable.slug,
  });
  console.log(`Seeded ${PRIOR_BLOG_POSTS.length} prior dummy blog posts (skip-on-conflict)`);

  // ── Job Openings ──────────────────────────────────────────────────────────
  const existingJobs = await db.select().from(jobOpeningsTable).limit(1);
  if (existingJobs.length === 0) {
    await db.insert(jobOpeningsTable).values([
      {
        title: "Sales Executive",
        department: "Sales",
        experience: "1 to 3 years",
        description:
          "Drive lead conversion, client engagement, and site visit coordination for residential projects.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "Channel Sales Manager",
        department: "Sales",
        experience: "4 to 7 years",
        description:
          "Manage channel partner networks, relationships, and partner-driven business development.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "CRM Executive",
        department: "Customer Relations",
        experience: "1 to 3 years",
        description:
          "Handle customer communication, follow-ups, documentation, and support across buyer journeys.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "Site Engineer",
        department: "Execution",
        experience: "2 to 5 years",
        description:
          "Supervise site activities, coordinate teams, and ensure quality and timeline adherence.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "Civil Engineer",
        department: "Construction",
        experience: "2 to 6 years",
        description:
          "Support structural execution, planning, site coordination, and material management.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "Architect",
        department: "Design",
        experience: "3 to 6 years",
        description:
          "Contribute to planning, design detailing, layout refinement, and project visualization.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "Project Manager",
        department: "Project Management",
        experience: "6 to 10 years",
        description:
          "Lead project timelines, teams, execution strategy, and cross-functional coordination.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "Marketing Executive",
        department: "Marketing",
        experience: "1 to 4 years",
        description:
          "Support campaigns, media coordination, branding initiatives, and project promotions.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "Accounts Executive",
        department: "Finance",
        experience: "1 to 4 years",
        description:
          "Handle billing, records, reconciliations, reporting, and finance-related documentation.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "Admin",
        department: "Administration",
        experience: "1 to 3 years",
        description:
          "Manage office administration, support operations, and maintain workflow coordination.",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "Other (Specify)",
        department: "General",
        experience: "Open",
        description:
          "Share your profile and area of expertise if you do not see a suitable role listed above.",
        isActive: true,
        updatedAt: new Date(),
      },
    ]);
    console.log("Inserted 11 job openings");
  } else {
    console.log("Job openings already seeded. Skipping.");
  }

  // ── Media Articles ────────────────────────────────────────────────────────
  const existingArticles = await db.select().from(mediaArticlesTable).limit(1);
  if (existingArticles.length === 0) {
    await db.insert(mediaArticlesTable).values([
      {
        title: "A New Standard of Contemporary Living in Jaipur",
        source: "Real Estate Today",
        category: "Press Release",
        excerpt:
          "Discover how thoughtful architecture, premium amenities, and prime urban connectivity are redefining the residential experience.",
        publishedDate: "12 Feb 2026",
        imageUrl: IMG_BASE,
        isPublished: true,
        updatedAt: new Date(),
      },
      {
        title: "Why Premium Real Estate Continues to Lead Buyer Interest",
        source: "Property Times",
        category: "Market Insight",
        excerpt:
          "From location value to long-term appreciation, premium projects continue to attract homebuyers seeking both comfort and confidence.",
        publishedDate: "18 Feb 2026",
        imageUrl: IMG2,
        isPublished: true,
        updatedAt: new Date(),
      },
      {
        title: "Design, Detail, and Delivery: What Shapes a Landmark Project",
        source: "Architecture Weekly",
        category: "Project Update",
        excerpt:
          "A closer look at the planning principles and construction priorities that influence truly distinguished developments.",
        publishedDate: "24 Feb 2026",
        imageUrl: IMG3,
        isPublished: true,
        updatedAt: new Date(),
      },
    ]);
    console.log("Inserted 3 media articles");
  } else {
    console.log("Media articles already seeded. Skipping.");
  }

  // ── Gallery Images ────────────────────────────────────────────────────────
  const existingGallery = await db.select().from(galleryImagesTable).limit(1);
  if (existingGallery.length === 0) {
    await db.insert(galleryImagesTable).values([
      { imageUrl: IMG_BASE, caption: "Project Launch Event", sortOrder: 1 },
      { imageUrl: IMG2, caption: "Site Progress Update", sortOrder: 2 },
      { imageUrl: IMG3, caption: "Brand Showcase", sortOrder: 3 },
      { imageUrl: IMG_BASE, caption: "Sales Gallery", sortOrder: 4 },
      { imageUrl: IMG2, caption: "Luxury Amenities Preview", sortOrder: 5 },
      { imageUrl: IMG3, caption: "Architectural Detail", sortOrder: 6 },
    ]);
    console.log("Inserted 6 gallery images");
  } else {
    console.log("Gallery images already seeded. Skipping.");
  }

  // ── Team Members ──────────────────────────────────────────────────────────
  const existingTeam = await db.select().from(teamMembersTable).limit(1);
  if (existingTeam.length === 0) {
    await db.insert(teamMembersTable).values([
      {
        name: "Mr. Abhishek Pal Singh",
        role: "Vice Chairman",
        imageUrl:
          "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=400&auto=format&fit=crop",
        bio: "Driving strategic direction with a strong focus on scale, trust, and long-term value creation, he plays a key role in shaping the group's growth while reinforcing its commitment to quality, credibility, and future-ready development.",
        section: "leadership",
        sortOrder: 1,
        updatedAt: new Date(),
      },
      {
        name: "Mr. Vibhishek Pal Singh",
        role: "Managing Director",
        imageUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=400&auto=format&fit=crop",
        bio: "With a vision rooted in innovation and execution, he leads the business with clarity and ambition, ensuring that every project reflects thoughtful planning, customer confidence, and the group's evolving leadership in real estate.",
        section: "leadership",
        sortOrder: 2,
        updatedAt: new Date(),
      },
      {
        name: "Mr. Alok Verma",
        role: "VP-Sales",
        imageUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop",
        bio: "Leads strategic operations with a focus on execution excellence, delivery discipline, and long-term organizational growth.",
        section: "management",
        sortOrder: 3,
        updatedAt: new Date(),
      },
      {
        name: "Mr. Chandramohan Sharma",
        role: "VP-Finance",
        imageUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop",
        bio: "Strengthens market presence through customer-first planning, brand positioning, and high-value business development.",
        section: "management",
        sortOrder: 4,
        updatedAt: new Date(),
      },
      {
        name: "Mr. Ritesh Raina",
        role: "AVP-Marketing",
        imageUrl:
          "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?q=80&w=400&auto=format&fit=crop",
        bio: "Oversees operational systems and interdepartmental alignment to ensure consistency across planning and delivery.",
        section: "management",
        sortOrder: 5,
        updatedAt: new Date(),
      },
      {
        name: "Mr. Sandeep Heda",
        role: "AVP-Customer Relations",
        imageUrl:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop",
        bio: "Brings focus to project execution, on-ground coordination, timelines, and quality benchmarks across developments.",
        section: "management",
        sortOrder: 6,
        updatedAt: new Date(),
      },
      {
        name: "Lokesh Kumar Soni",
        role: "GM-Human Resources",
        imageUrl:
          "https://images.unsplash.com/photo-1463453091185-61582044d556?q=80&w=400&auto=format&fit=crop",
        bio: "Enhances customer confidence by streamlining communication, service experience, and long-term relationship building.",
        section: "management",
        sortOrder: 7,
        updatedAt: new Date(),
      },
      {
        name: "Mr. Rohan Gupta",
        role: "Chief Engineer",
        imageUrl:
          "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?q=80&w=400&auto=format&fit=crop",
        bio: "Supports sustainable growth through financial planning, governance, compliance, and responsible resource management.",
        section: "management",
        sortOrder: 8,
        updatedAt: new Date(),
      },
    ]);
    console.log("Inserted 8 team members");
  } else {
    console.log("Team members already seeded. Skipping.");
  }

  // ── Site Stats ────────────────────────────────────────────────────────────
  const existingStats = await db.select().from(siteStatsTable).limit(1);
  if (existingStats.length === 0) {
    await db.insert(siteStatsTable).values([
      { label: "Landmarks Authored", value: 60, suffix: "+", sortOrder: 1, updatedAt: new Date() },
      { label: "Completed", value: 40, suffix: "+", sortOrder: 2, updatedAt: new Date() },
      { label: "Lives Transformed", value: 13000, suffix: "+", sortOrder: 3, updatedAt: new Date() },
      { label: "Years of Architectural Stewardship", value: 24, suffix: "", sortOrder: 4, updatedAt: new Date() },
      { label: "Million Sq.Ft. Of Meticulously Planned Space", value: 35, suffix: "+", sortOrder: 5, updatedAt: new Date() },
    ]);
    console.log("Inserted 5 site stats");
  } else {
    console.log("Site stats already seeded. Skipping.");
  }

  // ── Milestones ────────────────────────────────────────────────────────────
  // Source: artifacts/unique-builders/src/Components/HomePage/Elements/MilestonesSection.jsx
  // Descriptions preserve the exact bullet-point format (•) from the source milestones object
  const existingMilestones = await db.select().from(milestonesTable).limit(1);
  if (existingMilestones.length === 0) {
    await db.insert(milestonesTable).values([
      {
        year: "2002",
        title: "The Foundation",
        description:
          `• The Beginning of a Vision: Established with a commitment to quality and integrity.\n• My Haveli: Launched as our flagship project, setting the benchmark for community living.`,
        sortOrder: 1,
        updatedAt: new Date(),
      },
      {
        year: "2010",
        title: "Reaching New Heights",
        description:
          `• Iconic Landmarks: A landmark year featuring the development of Apex Tower, Golf, and Solitaire, defining the skyline with luxury and precision.`,
        sortOrder: 2,
        updatedAt: new Date(),
      },
      {
        year: "2011",
        title: "Revolutionizing Real Estate",
        description:
          `• Umang – Dreams for All: Launched one of Rajasthan's first truly affordable housing concepts. By introducing quality homes starting at just ₹5 lakhs, we turned the dream of homeownership into a reality for thousands.`,
        sortOrder: 3,
        updatedAt: new Date(),
      },
      {
        year: "2013",
        title: "Regional Expansion",
        description:
          `• Golf Estate (Jodhpur): Brought world-class leisure to the Sun City. It remains one of the only golf-based residential projects in Rajasthan, blending sport with sophisticated living.`,
        sortOrder: 4,
        updatedAt: new Date(),
      },
      {
        year: "2015",
        title: "Global Design Standards",
        description:
          `• IS Paradise: A fusion of international architectural aesthetics and modern comfort.\n• Iridium (Mumbai): Expanded our footprint into the Mumbai market with high-end elevations and cutting-edge design.`,
        sortOrder: 5,
        updatedAt: new Date(),
      },
      {
        year: "2018",
        title: "Strengthening the Core",
        description:
          `• Garden City (NCR/Neemrana): Solidified our presence in the National Capital Region (NCR) and Neemrana, catering to the growing industrial and residential demand in the corridor.`,
        sortOrder: 6,
        updatedAt: new Date(),
      },
      {
        year: "2024",
        title: "The Future of Urban Living",
        description:
          `• City Unique Life: Venturing into expansive plotting townships. We are creating curated spaces that offer the freedom of independent living within a structured, modern community.`,
        sortOrder: 7,
        updatedAt: new Date(),
      },
    ]);
    console.log("Inserted 7 milestones");
  } else {
    console.log("Milestones already seeded. Skipping.");
  }

  // ── Awards ────────────────────────────────────────────────────────────────
  const existingAwards = await db.select().from(awardsTable).limit(1);
  if (existingAwards.length === 0) {
    await db.insert(awardsTable).values([
      {
        year: "2024",
        title: "Best Township Developer",
        organization: "IMAN Real Estate Awards",
        sortOrder: 1,
      },
      {
        year: "2023",
        title: "Excellence in Residential Development",
        organization: "Rajasthan Realty Awards",
        sortOrder: 2,
      },
      {
        year: "2022",
        title: "Best Affordable Housing Project",
        organization: "India Property Awards",
        sortOrder: 3,
      },
      {
        year: "2021",
        title: "Customer Satisfaction Award",
        organization: "Real Estate India Awards",
        sortOrder: 4,
      },
    ]);
    console.log("Inserted 4 awards");
  } else {
    console.log("Awards already seeded. Skipping.");
  }

  // ── CSR Initiatives ───────────────────────────────────────────────────────
  // Source: artifacts/unique-builders/src/Components/CSR.jsx csrData[]
  // Images are the exact Unsplash URLs used in the frontend source array
  const existingCsr = await db.select().from(csrInitiativesTable).limit(1);
  if (existingCsr.length === 0) {
    await db.insert(csrInitiativesTable).values([
      {
        title: "Hunger & Health Support",
        description:
          "We organize regular Langar Seva to ensure no one goes hungry and hold Blood Donation camps to support local hospitals in saving lives.",
        imageUrl:
          "https://images.unsplash.com/photo-1522770179533-24471fcdba45?q=80&w=2070&auto=format&fit=crop",
        sortOrder: 1,
        updatedAt: new Date(),
      },
      {
        title: "Seasonal Care & Comfort",
        description:
          "Through our Blanket Distribution and Donation Drives, we provide essential warmth and resources to the underprivileged during the harshest times of the year.",
        imageUrl:
          "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=2070&auto=format&fit=crop",
        sortOrder: 2,
        updatedAt: new Date(),
      },
      {
        title: "Environmental Harmony",
        description:
          "Our Drop of Life initiative ensures food and water management for birds, while our Plantation Drives focus on growing a greener, healthier canopy for our cities.",
        imageUrl:
          "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=2070&auto=format&fit=crop",
        sortOrder: 3,
        updatedAt: new Date(),
      },
      {
        title: "Education & Awareness",
        description:
          "We believe in a brighter future through Education Drives for children and advocate for healthier lifestyles through our No Tobacco awareness campaigns.",
        imageUrl:
          "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=2070&auto=format&fit=crop",
        sortOrder: 4,
        updatedAt: new Date(),
      },
    ]);
    console.log("Inserted 4 CSR initiatives");
  } else {
    console.log("CSR initiatives already seeded. Skipping.");
  }

  // ── Featured Projects ─────────────────────────────────────────────────────
  // Data from FeaturedDevelopments.jsx (tab labels, titles, descriptions),
  // ProjectDetail3.jsx (IS Paradise price/beds/area), ProjectDetailIS/Faq.jsx
  // (Green Meadows price/beds/area), ProjectDetailNewtown/LuxuryTabs.jsx (amenities),
  // HeroSlider.jsx + GallerySlider.jsx (image paths), FeaturedDevelopments.jsx (mp4 refs)
  const featuredProjects = [
    {
      slug: "is-paradise",
      isFeatured: true,
      featuredOrder: 1,
      featuredTabLabel: "IS PARADISE",
      featuredTitle: "Where 70% of Life Feels Green",
      featuredDescription:
        "IS Paradise reshapes city living through its rare 70:30 green-to-built ratio, expansive water features and thoughtfully created celebration spaces. Spacious flat layouts, calm landscapes and refined planning come together to offer a living experience distinctly ahead of Jaipur's contemporary residential developments.",
      price: "₹ 1.29* Cr onwards",
      bedrooms: "2 & 3 BHK",
      area: "4.38 Acres",
      amenities: ["Swimming Pool", "GYM", "Game Area", "Kids Play Area"],
      reelUrl: "/assets/IsParadise.mp4",
      heroImageUrl: "/img/projects/is-paradise-gallery1.png",
      galleryImages: [
        "/img/projects/is-paradise-gallery1.png",
        "/img/projects/is-paradise-gallery2.png",
        "/img/projects/is-paradise-gallery3.png",
        "/img/projects/is-paradise-plan2.png",
        "/img/projects/is-paradise-plan1.png",
        "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1524813686514-a57563d77965?q=80&w=1920&auto=format&fit=crop",
      ],
      masterPlanImage: "/img/projects/is-paradise-plan1.png",
      floorPlanImage: "/img/projects/is-paradise-plan2.png",
      locationImage:
        "https://images.unsplash.com/photo-1524813686514-a57563d77965?q=80&w=1920&auto=format&fit=crop",
      exclusiveClubImage: "/img/projects/is-paradise-amenities1.png",
      facilitiesNearbyImage: "/img/projects/is-paradise-amenities2.png",
      constructionUpdateImage: "/img/projects/is-paradise-construction1.png",
      planImages: [
        "/img/projects/is-paradise-plan1.png",
        "/img/projects/is-paradise-plan2.png",
        "/img/projects/is-paradise-plan3.png",
        "/img/projects/is-paradise-plan4.png",
        "/img/projects/is-paradise-plan5.png",
        "/img/projects/is-paradise-plan6.png",
        "/img/projects/is-paradise-plan7.png",
      ],
      amenityImages: [
        "/img/projects/is-paradise-amenities1.png",
        "/img/projects/is-paradise-amenities2.png",
      ],
      constructionImages: [
        "/img/projects/is-paradise-construction1.png",
        "/img/projects/is-paradise-construction2.png",
        "/img/projects/is-paradise-construction3.png",
      ],
    },
    {
      slug: "unique-green-meadows",
      isFeatured: true,
      featuredOrder: 2,
      featuredTabLabel: "UNIQUE GREEN MEADOWS",
      featuredTitle: "More Life with More Amenities",
      featuredDescription:
        "With fifteen acres of thoughtfully planned openness, Green Meadows offers space for children to play, adults to unwind and families to grow comfortably together, supported by calm surroundings and smooth connectivity along the expanding 200-foot Tonk Road development corridor.",
      price: "₹ 30 Lakhs onwards",
      bedrooms: "1, 2 & 3 BHK",
      area: "15 Acres",
      amenities: [
        "Swimming Pool",
        "GYM",
        "Game Area",
        "Kids Play Area",
        "Cycling Track",
        "Yoga Corner",
        "Senior Citizen Corner",
        "Clubhouse",
      ],
      reelUrl: "/assets/Greenmeadow.mp4",
      heroImageUrl:
        "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1920&auto=format&fit=crop",
      galleryImages: [
        "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1524813686514-a57563d77965?q=80&w=1920&auto=format&fit=crop",
      ],
      masterPlanImage:
        "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1920&auto=format&fit=crop",
      floorPlanImage:
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=1920&auto=format&fit=crop",
      locationImage:
        "https://images.unsplash.com/photo-1524813686514-a57563d77965?q=80&w=1920&auto=format&fit=crop",
      exclusiveClubImage:
        "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1920&auto=format&fit=crop",
      facilitiesNearbyImage:
        "https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1920&auto=format&fit=crop",
      constructionUpdateImage:
        "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1920&auto=format&fit=crop",
    },
    {
      slug: "unique-new-town",
      isFeatured: true,
      featuredOrder: 3,
      featuredTabLabel: "UNIQUE NEW TOWN",
      featuredTitle: "A New Benchmarks of Low-Density Living",
      featuredDescription:
        "By dedicating each floor to a single family, the project brings a rare clarity to planning, emphasising quiet environments, spatial freedom and a premium sense of belonging. Its nearly five-acre total land area with curated clubhouse and thoughtfully designed outdoor spaces further strengthen its distinct residential character.",
      price: "₹ 30 Lakhs onwards",
      bedrooms: "1, 2 & 3 BHK",
      area: "5 Acres",
      amenities: ["Swimming Pool", "GYM", "Game Area", "Kids Play Area"],
      reelUrl: "/assets/Newtown.mp4",
      heroImageUrl:
        "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1920&auto=format&fit=crop",
      galleryImages: [
        "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1920&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1524813686514-a57563d77965?q=80&w=1920&auto=format&fit=crop",
      ],
      masterPlanImage:
        "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1920&auto=format&fit=crop",
      floorPlanImage:
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=1920&auto=format&fit=crop",
      locationImage:
        "https://images.unsplash.com/photo-1524813686514-a57563d77965?q=80&w=1920&auto=format&fit=crop",
      exclusiveClubImage:
        "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1920&auto=format&fit=crop",
      facilitiesNearbyImage:
        "https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1920&auto=format&fit=crop",
      constructionUpdateImage:
        "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1920&auto=format&fit=crop",
    },
  ];

  for (const fp of featuredProjects) {
    const existing = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.slug, fp.slug))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(projectsTable)
        .set({
          isFeatured: fp.isFeatured,
          featuredOrder: fp.featuredOrder,
          featuredTabLabel: fp.featuredTabLabel,
          featuredTitle: fp.featuredTitle,
          featuredDescription: fp.featuredDescription,
          price: fp.price,
          bedrooms: fp.bedrooms,
          area: fp.area,
          amenities: fp.amenities,
          reelUrl: fp.reelUrl,
          heroImageUrl: fp.heroImageUrl,
          galleryImages: fp.galleryImages,
          masterPlanImage: fp.masterPlanImage,
          floorPlanImage: fp.floorPlanImage,
          locationImage: fp.locationImage,
          exclusiveClubImage: fp.exclusiveClubImage,
          facilitiesNearbyImage: fp.facilitiesNearbyImage,
          constructionUpdateImage: fp.constructionUpdateImage,
          planImages: fp.planImages ?? [],
          amenityImages: fp.amenityImages ?? [],
          constructionImages: fp.constructionImages ?? [],
          updatedAt: new Date(),
        })
        .where(eq(projectsTable.slug, fp.slug));
      console.log(`Updated featured data for project: ${fp.slug}`);
    } else {
      console.warn(`Project slug not found, skipping featured update: ${fp.slug}`);
    }
  }

  // ── Ensure every project has non-null structured per-section image fields ──
  // Idempotent safety pass: any project still missing masterPlanImage /
  // floorPlanImage / locationImage / exclusiveClubImage /
  // facilitiesNearbyImage / constructionUpdateImage gets one of its existing
  // gallery URLs (or a stable Unsplash fallback) promoted into that slot, so
  // the public detail-page Project Showcase tabs always render — even after a
  // fresh `pnpm seed` against an empty database. Mirrors the logic in
  // src/scripts/repair-project-images.ts.
  {
    const F = {
      master:
        "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1920&auto=format&fit=crop",
      floor:
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=1920&auto=format&fit=crop",
      location:
        "https://images.unsplash.com/photo-1524813686514-a57563d77965?q=80&w=1920&auto=format&fit=crop",
      club: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1920&auto=format&fit=crop",
      facilities:
        "https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1920&auto=format&fit=crop",
      construction:
        "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1920&auto=format&fit=crop",
    } as const;
    const pickByKw = (urls: string[], kws: string[]) =>
      urls.find((u) => {
        const low = u.toLowerCase();
        return kws.some((k) => low.includes(k));
      });

    const allRows = await db.select().from(projectsTable);
    let promotedCount = 0;
    for (const row of allRows) {
      const gallery = (row.galleryImages ?? []) as string[];
      const planArr = (row.planImages ?? []) as string[];
      const amenityArr = (row.amenityImages ?? []) as string[];
      const constructionArr = (row.constructionImages ?? []) as string[];
      const patch: Partial<typeof projectsTable.$inferInsert> = {};
      if (!row.masterPlanImage)
        patch.masterPlanImage =
          pickByKw(gallery, ["master", "site"]) ??
          planArr[0] ??
          gallery[0] ??
          F.master;
      if (!row.floorPlanImage)
        patch.floorPlanImage =
          pickByKw(gallery, ["floor"]) ??
          planArr[1] ??
          planArr[0] ??
          gallery[1] ??
          F.floor;
      if (!row.locationImage)
        patch.locationImage =
          pickByKw(gallery, ["location", "map"]) ?? gallery[0] ?? F.location;
      if (!row.exclusiveClubImage)
        patch.exclusiveClubImage =
          pickByKw(gallery, ["club", "cp"]) ??
          amenityArr[0] ??
          gallery[2] ??
          F.club;
      if (!row.facilitiesNearbyImage)
        patch.facilitiesNearbyImage =
          pickByKw(gallery, ["amenit", "facilit"]) ??
          amenityArr[1] ??
          amenityArr[0] ??
          gallery[3] ??
          gallery[2] ??
          F.facilities;
      if (!row.constructionUpdateImage)
        patch.constructionUpdateImage =
          pickByKw(gallery, ["construction", "progress"]) ??
          constructionArr[0] ??
          F.construction;
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = new Date();
        await db
          .update(projectsTable)
          .set(patch)
          .where(eq(projectsTable.id, row.id));
        promotedCount += 1;
      }
    }
    console.log(
      `Ensured structured per-section image fields for ${promotedCount} of ${allRows.length} projects`,
    );
  }

  // ── Hero Slides ───────────────────────────────────────────────────────────
  // Data from HomeHeroNew.jsx slides[] (title, subtitle, description)
  const existingHeroSlides = await db.select().from(heroSlidesTable).limit(1);
  if (existingHeroSlides.length === 0) {
    await db.insert(heroSlidesTable).values([
      {
        title: "CRAFTING SPACES",
        subtitle: "THAT INSPIRE",
        description:
          "Unique Builders creates thoughtfully planned homes combining strong design, quality construction, and practical everyday living.",
        sortOrder: 1,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "BUILDING LANDMARKS.",
        subtitle: "SHAPING LIFESTYLES",
        description:
          "Unique Builders develops well-planned residences that balance smart design, reliable construction, and long-term value.",
        sortOrder: 2,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        title: "WHERE ARCHITECTURE MEETS",
        subtitle: "EVERYDAY LIVING",
        description:
          "Unique Builders delivers functional spaces through careful planning, dependable construction, and attention to everyday living.",
        sortOrder: 3,
        isActive: true,
        updatedAt: new Date(),
      },
    ]);
    console.log("Inserted 3 hero slides");
  } else {
    console.log("Hero slides already seeded. Skipping.");
  }

  // ── Business Highlights ───────────────────────────────────────────────────
  // Source: BusinessHighlights.jsx slides array
  // Images are local bundled assets (newtown2.png, sapphire3.png, haveli3.png)
  // and cannot be stored as URLs — imageUrl left null until hosted on CDN
  const existingHighlights = await db
    .select()
    .from(businessHighlightsTable)
    .limit(1);
  if (existingHighlights.length === 0) {
    // Data from BusinessHighlights.jsx slides[] (title, desc, img import path)
    await db.insert(businessHighlightsTable).values([
      {
        projectName: "Unique New Town",
        slug: "unique-new-town",
        description:
          "Modern luxury homes designed for comfort and privacy, offering spacious independent floors at an affordable, value-driven price.",
        imageUrl: "/img/newtown2.png",
        sortOrder: 1,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        projectName: "Unique Sapphire",
        slug: "unique-sapphire",
        description:
          "A refined lifestyle destination offering timeless elegance, premium comfort, and unmatched connectivity in a highly desirable location.",
        imageUrl: "/img/sapphire3.png",
        sortOrder: 2,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        projectName: "My Haveli",
        slug: "my-haveli",
        description:
          "One of Jaipur\u2019s largest residential projects, proudly recognized with a Guinness World Record for its massive groundbreaking ceremony.",
        imageUrl: "/img/haveli3.png",
        sortOrder: 3,
        isActive: true,
        updatedAt: new Date(),
      },
    ]);
    console.log("Inserted 3 business highlights");
  } else {
    console.log("Business highlights already seeded. Skipping.");
  }

  // ── Client Logos ──────────────────────────────────────────────────────────
  // Data from ProjectsPage.jsx demoLogos[] array (website urls) and import paths
  const existingLogos = await db.select().from(clientLogosTable).limit(1);
  if (existingLogos.length === 0) {
    const logoWebsites = [
      "https://www.microsoft.com",
      "https://www.amazon.com",
      "https://www.google.com",
      "https://www.netflix.com",
      "https://www.apple.com",
      ...Array(40).fill("https://www.spotify.com"),
    ];
    const logoEntries = logoWebsites.map((website, i) => ({
      name: `UB Client ${i + 1}`,
      website,
      imageUrl: `UB Logos/${i + 1}.png`,
      sortOrder: i + 1,
      isActive: true,
      updatedAt: new Date(),
    }));
    await db.insert(clientLogosTable).values(logoEntries);
    console.log("Inserted 45 client logos");
  } else {
    console.log("Client logos already seeded. Skipping.");
  }

  // ── Site Config ───────────────────────────────────────────────────────────
  // Data from Footer.jsx (contact details, social hrefs)
  const existingConfig = await db.select().from(siteConfigTable).limit(1);
  if (existingConfig.length === 0) {
    await db.insert(siteConfigTable).values([
      {
        key: "address",
        value:
          "Unique Builders, 4th Floor, Unique Destination, Laxmi Mandir Crossing, Tonk Road, Jaipur \u2013 302015 Rajasthan, India",
        label: "Office Address",
        updatedAt: new Date(),
      },
      {
        key: "phone",
        value: "+91 141 4090777",
        label: "Phone Number",
        updatedAt: new Date(),
      },
      {
        key: "email",
        value: "info@uniquebuilders.in",
        label: "Email Address",
        updatedAt: new Date(),
      },
      {
        key: "logo_url",
        value:
          "https://realestate.bizsquared.com/wp-content/uploads/2025/11/UB-logo-1.png",
        label: "Logo URL",
        updatedAt: new Date(),
      },
      {
        key: "social_facebook",
        value: "#",
        label: "Facebook URL",
        updatedAt: new Date(),
      },
      {
        key: "social_instagram",
        value: "#",
        label: "Instagram URL",
        updatedAt: new Date(),
      },
      {
        key: "social_linkedin",
        value: "#",
        label: "LinkedIn URL",
        updatedAt: new Date(),
      },
      {
        key: "social_youtube",
        value: "#",
        label: "YouTube URL",
        updatedAt: new Date(),
      },
      {
        key: "tagline",
        value:
          "Every structure we build is a promise of trust, innovation, and comfort \u2014 made to last for generations ahead.",
        label: "Brand Tagline",
        updatedAt: new Date(),
      },
    ]);
    console.log("Inserted 9 site config entries");
  } else {
    console.log("Site config already seeded. Skipping.");
  }

  // ── Career Page Content ───────────────────────────────────────────────────
  // Data from Career.jsx lifeAtUB[], whyJoin[], expectations[] arrays
  const existingCareerContent = await db
    .select()
    .from(careerPageContentTable)
    .limit(1);
  if (existingCareerContent.length === 0) {
    await db.insert(careerPageContentTable).values([
      // Life at UB — Section: life_at_ub
      {
        section: "life_at_ub",
        title: "Life",
        description:
          "A collaborative environment where teams across design, sales, and execution grow together while shaping meaningful real estate projects.",
        imageUrl:
          "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=2070&auto=format&fit=crop",
        sortOrder: 1,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        section: "life_at_ub",
        title: "Culture",
        description:
          "A culture built on trust, collaboration, and shared ambition, where people grow while contributing to impactful real estate projects.",
        imageUrl:
          "https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=2070&auto=format&fit=crop",
        sortOrder: 2,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        section: "life_at_ub",
        title: "Training",
        description:
          "Continuous development through real project exposure, planning discussions, site learning, and hands-on industry experience.",
        imageUrl:
          "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?q=80&w=2070&auto=format&fit=crop",
        sortOrder: 3,
        isActive: true,
        updatedAt: new Date(),
      },
      // Why Join — Section: why_join
      {
        section: "why_join",
        title: "Career Growth",
        description:
          "Long-term career growth opportunities with meaningful leadership exposure.",
        icon: "\u25a3",
        sortOrder: 1,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        section: "why_join",
        title: "Work Culture",
        description:
          "Collaborative and supportive teams driven by shared ambition and execution.",
        icon: "\u2726",
        sortOrder: 2,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        section: "why_join",
        title: "Learning & Development",
        description:
          "Continuous learning programs and professional development pathways.",
        icon: "\u25c8",
        sortOrder: 3,
        isActive: true,
        updatedAt: new Date(),
      },
      // Expectations — Section: expectation
      {
        section: "expectation",
        title: "Ownership",
        description:
          "People who take responsibility and move work forward with confidence.",
        sortOrder: 1,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        section: "expectation",
        title: "Integrity",
        description:
          "Professionals who value trust, ethics, and long-term credibility.",
        sortOrder: 2,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        section: "expectation",
        title: "Creativity",
        description:
          "Fresh thinkers who can solve challenges with smart practical ideas.",
        sortOrder: 3,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        section: "expectation",
        title: "Execution",
        description:
          "Individuals who believe in discipline, delivery, and consistency.",
        sortOrder: 4,
        isActive: true,
        updatedAt: new Date(),
      },
      {
        section: "expectation",
        title: "Collaboration",
        description:
          "Team players who communicate clearly and work well across functions.",
        sortOrder: 5,
        isActive: true,
        updatedAt: new Date(),
      },
    ]);
    console.log("Inserted 11 career page content entries (3 life_at_ub, 3 why_join, 5 expectation)");
  } else {
    console.log("Career page content already seeded. Skipping.");
  }

  // ── About Page Content ────────────────────────────────────────────────────
  // Source: About2.jsx — fully replaces hardcoded arrays/strings with DB rows.
  // Uses delete-and-reinsert so the seed is idempotent and content edits in
  // this file flow through on each run. Admin-edited rows should be managed
  // through the admin API, not this seed.
  // The delete + insert pair is wrapped in a transaction so a mid-seed failure
  // never leaves the table empty in production.
  const aboutRows: (typeof aboutPageContentTable.$inferInsert)[] = [
    // ── Hero / Banner ───────────────────────────────────────────────────────
    {
      section: "hero",
      eyebrow: "About Unique Builders",
      title: "A legacy of trust, ambition, and landmark development.",
      subtitle:
        "We create more than spaces—we build value, community, and lasting trust.",
      description: "Our Story",
      imageUrl: "/img/about/banner.png",
      sortOrder: 1,
      isActive: true,
      updatedAt: new Date(),
    },

    // ── Philosophy / Quote ──────────────────────────────────────────────────
    {
      section: "philosophy",
      eyebrow: "Philosophy",
      quote:
        "We do not just build projects. We create trust, shape communities, and leave behind a legacy people are proud to belong to.",
      sortOrder: 1,
      isActive: true,
      updatedAt: new Date(),
    },

    // ── Introduction ────────────────────────────────────────────────────────
    {
      section: "intro",
      eyebrow: "Introduction",
      title: "A group defined by scale, consistency, and long-term value.",
      body: "Founded with a vision to create meaningful developments, Unique Builders has grown into a trusted real estate name recognized for quality, strong planning, and customer confidence. Through the years, the group has strengthened its presence across multiple cities and project categories.",
      body2:
        "The group's USP lies in combining trust, design thinking, execution discipline, and long-term value creation. Its journey includes major developments, respected market presence, and collaborations that continue to reinforce its position in the industry.",
      imageUrl: "/img/about/intro.png",
      videoUrl: "/assets/about-us.mp4",
      sortOrder: 1,
      isActive: true,
      updatedAt: new Date(),
    },

    // ── Stakeholders / Top Leadership ───────────────────────────────────────
    {
      section: "stakeholder",
      role: "Leadership",
      name: "Mr. Abhishek Pal Singh",
      title: "Vice Chairman",
      body: "Driving strategic direction with a strong focus on scale, trust, and long-term value creation, he plays a key role in shaping the group's growth while reinforcing its commitment to quality, credibility, and future-ready development.",
      imageUrl: "/img/about/director1.png",
      sortOrder: 1,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "stakeholder",
      role: "Leadership",
      name: "Mr. Vibhishek Pal Singh",
      title: "Managing Director",
      body: "With a vision rooted in innovation and execution, he leads the business with clarity and ambition, ensuring that every project reflects thoughtful planning, customer confidence, and the group's evolving leadership in real estate.",
      imageUrl: "/img/about/director2.png",
      sortOrder: 2,
      isActive: true,
      updatedAt: new Date(),
    },

    // ── Wider Management Team ───────────────────────────────────────────────
    {
      section: "management",
      name: "Mr. Alok Verma",
      title: "VP-Sales",
      body: "Leads strategic operations with a focus on execution excellence, delivery discipline, and long-term organizational growth.",
      imageUrl: "/img/about/management1.jpg",
      sortOrder: 1,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "management",
      name: "Mr. Chandramohan Sharma",
      title: "VP-Finance",
      body: "Strengthens market presence through customer-first planning, brand positioning, and high-value business development.",
      imageUrl: "/img/about/management2.jpg",
      sortOrder: 2,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "management",
      name: "Mr. Ritesh Raina",
      title: "AVP- Marketing",
      body: "Oversees operational systems and interdepartmental alignment to ensure consistency across planning and delivery.",
      imageUrl: "/img/about/management1.jpg",
      sortOrder: 3,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "management",
      name: "Mr. Sandeep Heda",
      title: "AVP - Customer Relationship Manager",
      body: "Brings focus to project execution, on-ground coordination, timelines, and quality benchmarks across developments.",
      imageUrl: "/img/about/management2.jpg",
      sortOrder: 4,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "management",
      name: "Lokesh Kumar Soni",
      title: "GM- Human Resources",
      body: "Enhances customer confidence by streamlining communication, service experience, and long-term relationship building.",
      imageUrl: "/img/about/management1.jpg",
      sortOrder: 5,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "management",
      name: "Mr. Rohan Gupta",
      title: "Chief Engineer",
      body: "Supports sustainable growth through financial planning, governance, compliance, and responsible resource management.",
      imageUrl: "/img/about/management2.jpg",
      sortOrder: 6,
      isActive: true,
      updatedAt: new Date(),
    },

    // ── Values ──────────────────────────────────────────────────────────────
    {
      section: "value",
      title: "Integrity",
      body: "We believe in clarity, honesty, and accountability in everything we do.",
      icon: "✦",
      linkUrl: "/values",
      sortOrder: 1,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "value",
      title: "Innovation",
      body: "We adopt forward thinking and stronger systems to improve what we build.",
      icon: "◈",
      linkUrl: "/values",
      sortOrder: 2,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "value",
      title: "Quality",
      body: "We maintain high benchmarks in design, execution, and final delivery.",
      icon: "▣",
      linkUrl: "/values",
      sortOrder: 3,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "value",
      title: "Customer Focus",
      body: "We create spaces around people, needs, and long-term confidence.",
      icon: "◆",
      linkUrl: "/values",
      sortOrder: 4,
      isActive: true,
      updatedAt: new Date(),
    },

    // ── CSR ─────────────────────────────────────────────────────────────────
    {
      section: "csr",
      eyebrow: "CSR",
      title: "Creating impact beyond development.",
      body: "Our CSR vision reflects responsibility toward people, sustainability, and community growth. It is an extension of the same care, intent, and integrity that defines our work as a group.",
      imageUrl: "/img/about/csr1.png",
      imageUrl2: "/img/about/csr2.png",
      imageUrl3: "/img/about/csr3.png",
      linkUrl: "/csr",
      linkLabel: "View Initiatives",
      sortOrder: 1,
      isActive: true,
      updatedAt: new Date(),
    },

    // ── Certifications ──────────────────────────────────────────────────────
    {
      section: "certification",
      title: "Quality-driven execution standards",
      icon: "ShieldCheck",
      sortOrder: 1,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "certification",
      title: "Compliance-first project processes",
      icon: "Award",
      sortOrder: 2,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "certification",
      title: "Transparent documentation practices",
      icon: "BadgeCheck",
      sortOrder: 3,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "certification",
      title: "Responsible construction methodology",
      icon: "CheckCircle2",
      sortOrder: 4,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "certification",
      title: "Customer-centric delivery systems",
      icon: "FileCheck",
      sortOrder: 5,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      section: "certification",
      title: "Structured project governance",
      icon: "ShieldCheck",
      sortOrder: 6,
      isActive: true,
      updatedAt: new Date(),
    },
  ];

  await db.transaction(async (tx) => {
    await tx.delete(aboutPageContentTable);
    await tx.insert(aboutPageContentTable).values(aboutRows);
  });
  console.log(
    `Reseeded about page content (${aboutRows.length} rows: hero, philosophy, intro, 2 stakeholders, 6 management, 4 values, csr, 6 certifications)`,
  );

  // ── Instagram Posts ───────────────────────────────────────────────────────
  // Data from InstagramSection.jsx instagramPosts[] (image imports, link)
  const existingInstagram = await db
    .select()
    .from(instagramPostsTable)
    .limit(1);
  if (existingInstagram.length === 0) {
    const instagramPostData = [
      { postId: "1", imageUrl: "/img/instagram1.webp" },
      { postId: "2", imageUrl: "/img/instagram7.jpg" },
      { postId: "3", imageUrl: "/img/instagram3.webp" },
      { postId: "4", imageUrl: "/img/instagram4.webp" },
      { postId: "5", imageUrl: "/img/instagram5.webp" },
    ];
    await db.insert(instagramPostsTable).values(
      instagramPostData.map((p, i) => ({
        postId: p.postId,
        link: "https://www.instagram.com/uniquebuilders_jaipur/",
        altText: `Unique Builders Jaipur — post ${p.postId}`,
        imageUrl: p.imageUrl,
        sortOrder: i + 1,
        isActive: true,
        updatedAt: new Date(),
      })),
    );
    console.log("Inserted 5 instagram posts");
  } else {
    console.log("Instagram posts already seeded. Skipping.");
  }

  await pool.end();
  console.log("CMS seed complete!");
}

seedCms().catch((err) => {
  console.error("CMS seed failed:", err);
  process.exit(1);
});
