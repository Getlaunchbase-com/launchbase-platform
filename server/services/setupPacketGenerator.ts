/**
 * Setup Packet Generator
 * 
 * LaunchBase Rule:
 * We prepare first.
 * We automate second.
 * We always show our work.
 * 
 * Generates setup packets for integrations (Google Business Profile, Meta, QuickBooks)
 * that contain all the information needed to set up each platform.
 */

import { getDb } from "../db";
import { intakes, suiteApplications } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Integration types
export type IntegrationType = "google_business" | "meta" | "quickbooks";

// Common packet base structure
export interface PacketBase {
  business: {
    name: string;
    phone: string;
    website: string | null;
    address: string | null;
    serviceArea: string[];
    hours: string | null;
  };
  positioning: {
    tone: string;
    primaryCTA: string;
    oneLiner: string;
  };
  services: Array<{
    name: string;
    description: string;
    priceHint: string | null;
  }>;
  assetsNeeded: Array<{
    item: string;
    priority: "high" | "medium" | "low";
    note: string;
  }>;
  setupSteps: Array<{
    step: number;
    title: string;
    instructions: string;
    deepLink?: string;
  }>;
}

// Google Business Profile specific fields
export interface GoogleBusinessPacket extends PacketBase {
  integration: "google_business";
  specific: {
    primaryCategory: string;
    additionalCategories: string[];
    description: string; // 750 char max
    openingDate: string | null;
    attributes: string[];
    photoGuidelines: string[];
    reviewResponseTemplates: {
      positive: string;
      neutral: string;
      negative: string;
    };
  };
}

// Meta (Facebook/Instagram) specific fields
export interface MetaPacket extends PacketBase {
  integration: "meta";
  specific: {
    pageBio: string; // 255 char max
    aboutSection: string;
    ctaButton: {
      type: string;
      link: string;
    };
    pinnedPostDraft: string;
    profileImageSpec: string;
    coverImageSpec: string;
    postingCadence: string;
    toneNotes: string;
    hashtagStrategy: string[];
  };
}

// QuickBooks specific fields
export interface QuickBooksPacket extends PacketBase {
  integration: "quickbooks";
  specific: {
    customerTypes: Array<{
      name: string;
      description: string;
    }>;
    serviceItems: Array<{
      name: string;
      description: string;
      rate: number | null;
      taxable: boolean;
    }>;
    invoiceTemplate: {
      terms: string;
      dueDate: string;
      notes: string;
      footer: string;
    };
    paymentTerms: string;
    chartOfAccountsStarter: Array<{
      name: string;
      type: string;
      description: string;
    }>;
    taxCategories: Array<{
      name: string;
      rate: number | null;
    }>;
  };
}

export type SetupPacket = GoogleBusinessPacket | MetaPacket | QuickBooksPacket;

// Vertical to category mapping for Google Business
const verticalToGoogleCategory: Record<string, { primary: string; additional: string[] }> = {
  trades: { primary: "Home improvement store", additional: ["Contractor", "Handyman"] },
  appointments: { primary: "Health & wellness", additional: ["Spa", "Salon"] },
  professional: { primary: "Business service", additional: ["Consultant", "Professional service"] },
  health: { primary: "Medical clinic", additional: ["Healthcare provider"] },
  beauty: { primary: "Beauty salon", additional: ["Spa", "Nail salon"] },
  food: { primary: "Restaurant", additional: ["Food service", "Catering"] },
  cannabis: { primary: "Cannabis store", additional: ["Dispensary"] },
  fitness: { primary: "Gym", additional: ["Fitness center", "Personal trainer"] },
  automotive: { primary: "Auto repair shop", additional: ["Car dealer", "Auto parts store"] },
};

/**
 * Generate a setup packet for a specific integration
 */
export async function generateSetupPacket(
  intakeId: number,
  integration: IntegrationType
): Promise<SetupPacket | null> {
  const db = await getDb();
  if (!db) return null;

  // Get intake data
  const [intake] = await db
    .select()
    .from(intakes)
    .where(eq(intakes.id, intakeId))
    .limit(1);

  if (!intake) {
    console.error(`[SetupPacket] Intake ${intakeId} not found`);
    return null;
  }

  // Build common base
  const base: PacketBase = {
    business: {
      name: intake.businessName,
      phone: intake.phone || "",
      website: null, // Will be filled after deployment
      address: null,
      serviceArea: (intake.serviceArea as string[]) || [],
      hours: null,
    },
    positioning: {
      tone: "professional",
      primaryCTA: intake.primaryCTA || "Call Now",
      oneLiner: `${intake.businessName} - Professional ${intake.vertical} services`,
    },
    services: ((intake.services as string[]) || []).map((s) => ({
      name: s,
      description: `Professional ${s.toLowerCase()} services`,
      priceHint: null,
    })),
    assetsNeeded: [
      { item: "Business logo (high resolution)", priority: "high", note: "PNG or SVG, at least 500x500px" },
      { item: "Profile photo", priority: "high", note: "Square format, professional quality" },
      { item: "Cover/banner image", priority: "medium", note: "1200x630px recommended" },
      { item: "Service photos", priority: "medium", note: "At least 3-5 photos of your work" },
    ],
    setupSteps: [],
  };

  // Generate integration-specific packet
  switch (integration) {
    case "google_business":
      return generateGooglePacket(base, intake);
    case "meta":
      return generateMetaPacket(base, intake);
    case "quickbooks":
      return generateQuickBooksPacket(base, intake);
    default:
      return null;
  }
}

function generateGooglePacket(base: PacketBase, intake: any): GoogleBusinessPacket {
  const categoryInfo = verticalToGoogleCategory[intake.vertical] || verticalToGoogleCategory.professional;
  
  return {
    ...base,
    integration: "google_business",
    setupSteps: [
      {
        step: 1,
        title: "Create or claim your business",
        instructions: "Go to Google Business Profile and search for your business. If it exists, claim it. If not, create a new listing.",
        deepLink: "https://business.google.com/create",
      },
      {
        step: 2,
        title: "Enter business information",
        instructions: "Use the exact business name, address, and phone number provided in this packet.",
      },
      {
        step: 3,
        title: "Select categories",
        instructions: `Primary: "${categoryInfo.primary}". Add additional categories as relevant.`,
      },
      {
        step: 4,
        title: "Add description",
        instructions: "Copy the description from this packet (750 characters max).",
      },
      {
        step: 5,
        title: "Upload photos",
        instructions: "Add logo, cover photo, and at least 3 photos of your work or location.",
      },
      {
        step: 6,
        title: "Set business hours",
        instructions: "Enter your regular business hours. You can always update these later.",
      },
      {
        step: 7,
        title: "Verify your business",
        instructions: "Google will send a verification code via mail or phone. This usually takes 5-7 days.",
      },
    ],
    specific: {
      primaryCategory: categoryInfo.primary,
      additionalCategories: categoryInfo.additional,
      description: `${intake.businessName} provides professional ${intake.vertical} services. ${base.positioning.oneLiner}. Contact us today to learn more about how we can help you.`.slice(0, 750),
      openingDate: null,
      attributes: ["Wheelchair accessible", "Accepts credit cards"],
      photoGuidelines: [
        "Logo: Square format, clear and readable",
        "Cover: 1080x608px, shows your business or work",
        "Interior: If applicable, show your workspace",
        "Team: Professional photos of you/your team",
        "Work samples: Before/after, completed projects",
      ],
      reviewResponseTemplates: {
        positive: `Thank you so much for the kind words! We're thrilled you had a great experience with ${intake.businessName}. We look forward to serving you again!`,
        neutral: `Thank you for your feedback. We're always looking to improve and would love to hear more about how we can better serve you. Please reach out to us directly.`,
        negative: `We're sorry to hear about your experience. This isn't the standard we hold ourselves to. Please contact us directly so we can make this right.`,
      },
    },
  };
}

function generateMetaPacket(base: PacketBase, intake: any): MetaPacket {
  return {
    ...base,
    integration: "meta",
    setupSteps: [
      {
        step: 1,
        title: "Create a Facebook Business Page",
        instructions: "Go to Facebook and create a new Page for your business.",
        deepLink: "https://www.facebook.com/pages/create",
      },
      {
        step: 2,
        title: "Set up page info",
        instructions: "Add your business name, category, and contact information.",
      },
      {
        step: 3,
        title: "Add profile and cover photos",
        instructions: "Upload your logo as profile photo (170x170px) and a cover image (820x312px).",
      },
      {
        step: 4,
        title: "Write your About section",
        instructions: "Copy the About text from this packet.",
      },
      {
        step: 5,
        title: "Set up CTA button",
        instructions: "Add a Call to Action button (Call Now, Book Now, or Contact Us).",
      },
      {
        step: 6,
        title: "Create your first post",
        instructions: "Use the pinned post draft from this packet as your first post.",
      },
      {
        step: 7,
        title: "Connect Instagram (optional)",
        instructions: "Link your Instagram business account for cross-posting.",
        deepLink: "https://business.facebook.com/settings/instagram-accounts",
      },
    ],
    specific: {
      pageBio: `${intake.businessName} | ${base.positioning.oneLiner}`.slice(0, 255),
      aboutSection: `${intake.businessName} provides professional ${intake.vertical} services in ${(intake.serviceArea as string[])?.join(", ") || "your area"}. ${base.positioning.primaryCTA} to get started!`,
      ctaButton: {
        type: intake.primaryCTA === "Call Now" ? "CALL_NOW" : "CONTACT_US",
        link: intake.phone ? `tel:${intake.phone}` : "",
      },
      pinnedPostDraft: `🎉 Welcome to ${intake.businessName}!\n\nWe're excited to connect with you here. Whether you need ${((intake.services as string[]) || []).slice(0, 3).join(", ") || "our services"}, we're here to help.\n\n📞 ${base.positioning.primaryCTA}\n📍 Serving ${(intake.serviceArea as string[])?.join(", ") || "your area"}\n\n#${intake.businessName.replace(/\s+/g, "")} #${intake.vertical} #LocalBusiness`,
      profileImageSpec: "170x170px minimum, square format, your logo or professional headshot",
      coverImageSpec: "820x312px on desktop, 640x360px on mobile. Show your work or team.",
      postingCadence: "2-3 posts per week recommended for engagement",
      toneNotes: "Professional but approachable. Show personality while maintaining expertise.",
      hashtagStrategy: [
        `#${intake.businessName.replace(/\s+/g, "")}`,
        `#${intake.vertical}`,
        "#LocalBusiness",
        "#SmallBusiness",
        ...(intake.serviceArea as string[] || []).map((area: string) => `#${area.replace(/\s+/g, "")}`),
      ],
    },
  };
}

function generateQuickBooksPacket(base: PacketBase, intake: any): QuickBooksPacket {
  const services = (intake.services as string[]) || [];
  
  return {
    ...base,
    integration: "quickbooks",
    setupSteps: [
      {
        step: 1,
        title: "Create QuickBooks account",
        instructions: "Sign up for QuickBooks Online at the link below.",
        deepLink: "https://quickbooks.intuit.com/signup/",
      },
      {
        step: 2,
        title: "Set up company profile",
        instructions: "Enter your business name, address, and contact information.",
      },
      {
        step: 3,
        title: "Add services/products",
        instructions: "Create service items using the list in this packet.",
      },
      {
        step: 4,
        title: "Set up invoice template",
        instructions: "Customize your invoice with your logo and payment terms.",
      },
      {
        step: 5,
        title: "Add customer types",
        instructions: "Create customer categories to organize your clients.",
      },
      {
        step: 6,
        title: "Connect bank account",
        instructions: "Link your business bank account for automatic transaction import.",
      },
      {
        step: 7,
        title: "Set up payment processing",
        instructions: "Enable QuickBooks Payments to accept credit cards and ACH.",
      },
    ],
    specific: {
      customerTypes: [
        { name: "Residential", description: "Individual homeowners and renters" },
        { name: "Commercial", description: "Business and commercial clients" },
        { name: "Referral", description: "Clients referred by existing customers" },
      ],
      serviceItems: services.map((s) => ({
        name: s,
        description: `Professional ${s.toLowerCase()} service`,
        rate: null, // Customer will set their own rates
        taxable: true,
      })),
      invoiceTemplate: {
        terms: "Net 30",
        dueDate: "30 days from invoice date",
        notes: "Thank you for your business!",
        footer: `${intake.businessName} | ${intake.phone || "Contact us for questions"}`,
      },
      paymentTerms: "Net 30 - Payment due within 30 days of invoice date",
      chartOfAccountsStarter: [
        { name: "Service Revenue", type: "Income", description: "Revenue from services provided" },
        { name: "Materials & Supplies", type: "Expense", description: "Cost of materials used" },
        { name: "Vehicle Expenses", type: "Expense", description: "Fuel, maintenance, insurance" },
        { name: "Tools & Equipment", type: "Expense", description: "Tools and equipment purchases" },
        { name: "Marketing & Advertising", type: "Expense", description: "Advertising and promotion costs" },
        { name: "Insurance", type: "Expense", description: "Business insurance premiums" },
      ],
      taxCategories: [
        { name: "Sales Tax", rate: null }, // Varies by location
        { name: "Labor (Non-taxable)", rate: 0 },
      ],
    },
  };
}

/**
 * Generate all three packets for an intake
 */
export async function generateAllPackets(intakeId: number): Promise<{
  google: GoogleBusinessPacket | null;
  meta: MetaPacket | null;
  quickbooks: QuickBooksPacket | null;
}> {
  const [google, meta, quickbooks] = await Promise.all([
    generateSetupPacket(intakeId, "google_business"),
    generateSetupPacket(intakeId, "meta"),
    generateSetupPacket(intakeId, "quickbooks"),
  ]);

  return {
    google: google as GoogleBusinessPacket | null,
    meta: meta as MetaPacket | null,
    quickbooks: quickbooks as QuickBooksPacket | null,
  };
}
