/**
 * Setup Packet Generator
 *
 * Generates integration setup packets for Google Business, Meta, and QuickBooks.
 * Each packet contains all the business data needed to configure the integration.
 */

import { getDb } from "../db";
import { intakes } from "../db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// generateAllPackets
// ---------------------------------------------------------------------------

export async function generateAllPackets(
  intakeId: number,
): Promise<{
  google?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  quickbooks?: Record<string, unknown>;
}> {
  const db = await getDb();
  if (!db) {
    console.error("[setup-packets] Database not available");
    return {};
  }

  const [intake] = await db
    .select()
    .from(intakes)
    .where(eq(intakes.id, intakeId))
    .limit(1);

  if (!intake) {
    console.warn(`[setup-packets] Intake #${intakeId} not found`);
    return {};
  }

  const businessData = {
    name: intake.businessName,
    phone: intake.phone || "",
    email: intake.email,
    website: `https://${intake.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.launchbase.site`,
    address: (intake.serviceArea || []).join(", "),
    serviceArea: (intake.serviceArea || []).join(", "),
    services: intake.services || [],
    vertical: intake.vertical,
    tagline: intake.tagline || "",
    primaryCTA: intake.primaryCTA || "Contact Us",
  };

  return {
    google: generateGooglePacket(businessData),
    meta: generateMetaPacket(businessData),
    quickbooks: generateQuickBooksPacket(businessData),
  };
}

// ---------------------------------------------------------------------------
// generateSetupPacket (single integration)
// ---------------------------------------------------------------------------

export async function generateSetupPacket(
  intakeId: number,
  integration?: string,
): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  if (!db) return null;

  const [intake] = await db
    .select()
    .from(intakes)
    .where(eq(intakes.id, intakeId))
    .limit(1);

  if (!intake) return null;

  const businessData = {
    name: intake.businessName,
    phone: intake.phone || "",
    email: intake.email,
    website: `https://${intake.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.launchbase.site`,
    address: (intake.serviceArea || []).join(", "),
    serviceArea: (intake.serviceArea || []).join(", "),
    services: intake.services || [],
    vertical: intake.vertical,
    tagline: intake.tagline || "",
    primaryCTA: intake.primaryCTA || "Contact Us",
  };

  switch (integration) {
    case "google_business":
      return generateGooglePacket(businessData);
    case "meta":
      return generateMetaPacket(businessData);
    case "quickbooks":
      return generateQuickBooksPacket(businessData);
    default:
      return generateGooglePacket(businessData);
  }
}

// ---------------------------------------------------------------------------
// Google Business Profile Packet
// ---------------------------------------------------------------------------

function generateGooglePacket(data: any): Record<string, unknown> {
  const categoryMap: Record<string, string> = {
    trades: "Home Improvement",
    appointments: "Health & Wellness",
    professional: "Professional Services",
  };

  return {
    integration: "google_business",
    business: {
      name: data.name,
      phone: data.phone,
      website: data.website,
      address: data.address,
      serviceArea: data.serviceArea,
      hours: {
        monday: "8:00 AM - 5:00 PM",
        tuesday: "8:00 AM - 5:00 PM",
        wednesday: "8:00 AM - 5:00 PM",
        thursday: "8:00 AM - 5:00 PM",
        friday: "8:00 AM - 5:00 PM",
        saturday: "By Appointment",
        sunday: "Closed",
      },
    },
    positioning: {
      tone: "professional" as const,
      primaryCta: data.primaryCTA,
      oneLiner: data.tagline || `${data.name} - Quality ${data.vertical} services`,
    },
    services: (data.services || []).map((svc: string) => ({
      name: svc,
      description: `Professional ${svc.toLowerCase()} services`,
      priceHint: "Contact for quote",
    })),
    assetsNeeded: [
      { item: "Business logo (high-res PNG)", priority: "high" as const, note: "Min 250x250px" },
      { item: "Cover photo (1024x576px)", priority: "high" as const, note: "Shows your business" },
      { item: "Interior/exterior photos (3-5)", priority: "medium" as const, note: "Well-lit, recent" },
      { item: "Team/staff photo", priority: "low" as const, note: "Optional but recommended" },
    ],
    setupSteps: [
      { step: 1, title: "Verify business ownership", instructions: "Google will send a postcard or call to verify your address", deepLink: "https://business.google.com" },
      { step: 2, title: "Complete business information", instructions: "Fill in all business details including hours, categories, and description" },
      { step: 3, title: "Upload photos", instructions: "Add your logo, cover photo, and at least 3 business photos" },
      { step: 4, title: "Set service areas", instructions: "Define your service area by city, zip code, or radius" },
      { step: 5, title: "Enable messaging", instructions: "Turn on Google Messages for direct customer communication" },
    ],
    googleBusiness: {
      primaryCategory: categoryMap[data.vertical] || "Professional Services",
      secondaryCategories: [],
      shortDescription: `${data.name} provides ${data.vertical} services in ${data.serviceArea || "your area"}.`,
      longDescription: `${data.name} is a trusted ${data.vertical} service provider. ${data.tagline || ""} We serve ${data.serviceArea || "the local area"} with professional, reliable service. Contact us today for a free consultation.`,
      servicesFormatted: (data.services || []).map((s: string) => s),
      suggestedPhotos: ["logo", "storefront", "team", "work-sample-1", "work-sample-2"],
      reviewRequestTemplate: `Thank you for choosing ${data.name}! If you're satisfied with our service, we'd appreciate a review on Google.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Meta (Facebook/Instagram) Packet
// ---------------------------------------------------------------------------

function generateMetaPacket(data: any): Record<string, unknown> {
  return {
    integration: "meta",
    business: {
      name: data.name,
      phone: data.phone,
      website: data.website,
      address: data.address,
      serviceArea: data.serviceArea,
      hours: {
        monday: "8:00 AM - 5:00 PM",
        tuesday: "8:00 AM - 5:00 PM",
        wednesday: "8:00 AM - 5:00 PM",
        thursday: "8:00 AM - 5:00 PM",
        friday: "8:00 AM - 5:00 PM",
        saturday: "By Appointment",
        sunday: "Closed",
      },
    },
    positioning: {
      tone: "friendly" as const,
      primaryCta: data.primaryCTA,
      oneLiner: data.tagline || `${data.name} - Quality ${data.vertical} services`,
    },
    services: (data.services || []).map((svc: string) => ({
      name: svc,
      description: `Professional ${svc.toLowerCase()} services`,
      priceHint: "Contact for quote",
    })),
    assetsNeeded: [
      { item: "Profile picture (square, min 170x170px)", priority: "high" as const, note: "Usually your logo" },
      { item: "Cover photo (820x312px)", priority: "high" as const, note: "Showcase your business" },
      { item: "Service photos (5-10)", priority: "medium" as const, note: "For content posts" },
    ],
    setupSteps: [
      { step: 1, title: "Create or claim Facebook Business Page", instructions: "Go to facebook.com/pages/create", deepLink: "https://www.facebook.com/pages/create" },
      { step: 2, title: "Complete page info", instructions: "Add business details, hours, contact info, and about section" },
      { step: 3, title: "Upload branding", instructions: "Set your profile picture and cover photo" },
      { step: 4, title: "Connect to LaunchBase", instructions: "Grant page publishing permissions to LaunchBase" },
      { step: 5, title: "Publish first post", instructions: "Review and approve your first AI-generated post" },
    ],
    meta: {
      pageBio: `${data.name} | ${data.tagline || `Professional ${data.vertical} services`}`,
      aboutText: `${data.name} provides quality ${data.vertical} services in ${data.serviceArea || "your area"}. Contact us today!`,
      ctaButton: { text: data.primaryCTA || "Contact Us", url: data.website },
      starterPosts: [
        { content: `Excited to announce ${data.name} is now online! Visit our website to learn more. ${data.website}`, type: "announcement" },
        { content: `Looking for reliable ${data.vertical} services? ${data.name} is here to help. Give us a call!`, type: "promotional" },
        { content: `Thank you to all our amazing customers! ${data.name} is proud to serve the community.`, type: "engagement" },
      ],
      hashtags: ["#localbusiness", "#supportlocal", `#${data.vertical}`],
      coverPhotoGuidance: "Use a high-quality photo of your business, team, or best work. Dimensions: 820x312px.",
    },
  };
}

// ---------------------------------------------------------------------------
// QuickBooks Packet
// ---------------------------------------------------------------------------

function generateQuickBooksPacket(data: any): Record<string, unknown> {
  return {
    integration: "quickbooks",
    business: {
      name: data.name,
      phone: data.phone,
      website: data.website,
      address: data.address,
      serviceArea: data.serviceArea,
      hours: {},
    },
    positioning: {
      tone: "professional" as const,
      primaryCta: data.primaryCTA,
      oneLiner: data.tagline || `${data.name} - Professional invoicing`,
    },
    services: (data.services || []).map((svc: string) => ({
      name: svc,
      description: `${svc} service`,
      priceHint: "Set in QuickBooks",
    })),
    assetsNeeded: [
      { item: "Business tax ID (EIN)", priority: "high" as const, note: "For tax settings" },
      { item: "Bank account details", priority: "high" as const, note: "For payment processing" },
      { item: "Service pricing list", priority: "medium" as const, note: "For invoice items" },
    ],
    setupSteps: [
      { step: 1, title: "Sign up for QuickBooks", instructions: "Create your QuickBooks Online account", deepLink: "https://quickbooks.intuit.com/signup" },
      { step: 2, title: "Configure company settings", instructions: "Set up your company name, address, and tax information" },
      { step: 3, title: "Add service items", instructions: "Create invoice items for each service you offer" },
      { step: 4, title: "Connect bank account", instructions: "Link your bank account for payment processing" },
      { step: 5, title: "Connect to LaunchBase", instructions: "Authorize LaunchBase to sync customer data" },
    ],
    quickbooks: {
      customerTypeTags: ["website-lead", "referral", "walk-in"],
      serviceItems: (data.services || []).map((svc: string) => ({
        name: svc,
        slug: svc.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        rate: 0,
      })),
      invoiceDefaults: {
        terms: "Net 30",
        depositRules: "50% deposit required for projects over $500",
        lateFeePolicy: "1.5% monthly late fee after 30 days",
      },
    },
  };
}
