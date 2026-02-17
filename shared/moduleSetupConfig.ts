/**
 * Module Setup Configurations
 *
 * Defines the available modules and their setup parameters
 * for the LaunchBase platform.
 */

export interface ModuleConfig {
  id: string;
  label: string;
  description: string;
  category: string;
  required: boolean;
  defaultEnabled: boolean;
  setupFields: Array<{
    key: string;
    label: string;
    type: "text" | "select" | "toggle" | "number" | "url";
    required: boolean;
    default?: unknown;
    options?: string[];
  }>;
}

export const moduleConfigs: ModuleConfig[] = [
  {
    id: "domain",
    label: "Custom Domain",
    description: "Configure a custom domain for your site",
    category: "infrastructure",
    required: false,
    defaultEnabled: false,
    setupFields: [
      { key: "domainName", label: "Domain Name", type: "text", required: true },
      { key: "sslEnabled", label: "Enable SSL", type: "toggle", required: false, default: true },
    ],
  },
  {
    id: "branding",
    label: "Branding",
    description: "Upload logos, set colors, and configure visual identity",
    category: "design",
    required: true,
    defaultEnabled: true,
    setupFields: [
      { key: "primaryColor", label: "Primary Color", type: "text", required: true, default: "#3B82F6" },
      { key: "logoUrl", label: "Logo URL", type: "url", required: false },
      { key: "fontFamily", label: "Font Family", type: "select", required: false, default: "Inter", options: ["Inter", "Roboto", "Open Sans", "Lato", "Poppins"] },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Track visitor behavior and site performance",
    category: "marketing",
    required: false,
    defaultEnabled: true,
    setupFields: [
      { key: "provider", label: "Analytics Provider", type: "select", required: true, default: "google", options: ["google", "plausible", "fathom", "mixpanel"] },
      { key: "trackingId", label: "Tracking ID", type: "text", required: true },
    ],
  },
  {
    id: "seo",
    label: "SEO",
    description: "Search engine optimization settings",
    category: "marketing",
    required: false,
    defaultEnabled: true,
    setupFields: [
      { key: "metaTitle", label: "Default Meta Title", type: "text", required: false },
      { key: "metaDescription", label: "Default Meta Description", type: "text", required: false },
      { key: "sitemapEnabled", label: "Generate Sitemap", type: "toggle", required: false, default: true },
    ],
  },
  {
    id: "blog",
    label: "Blog",
    description: "Add a blog section to your site",
    category: "content",
    required: false,
    defaultEnabled: false,
    setupFields: [
      { key: "postsPerPage", label: "Posts Per Page", type: "number", required: false, default: 10 },
      { key: "commentsEnabled", label: "Enable Comments", type: "toggle", required: false, default: false },
    ],
  },
  {
    id: "contact",
    label: "Contact Form",
    description: "Add a contact form with email notifications",
    category: "engagement",
    required: false,
    defaultEnabled: true,
    setupFields: [
      { key: "recipientEmail", label: "Recipient Email", type: "text", required: true },
      { key: "captchaEnabled", label: "Enable CAPTCHA", type: "toggle", required: false, default: true },
    ],
  },
  {
    id: "social",
    label: "Social Media Integration",
    description: "Connect and auto-post to social media accounts",
    category: "marketing",
    required: false,
    defaultEnabled: false,
    setupFields: [
      { key: "facebookPageId", label: "Facebook Page ID", type: "text", required: false },
      { key: "instagramHandle", label: "Instagram Handle", type: "text", required: false },
      { key: "autoPost", label: "Auto-post new content", type: "toggle", required: false, default: false },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Accept payments via Stripe or other processors",
    category: "commerce",
    required: false,
    defaultEnabled: false,
    setupFields: [
      { key: "processor", label: "Payment Processor", type: "select", required: true, default: "stripe", options: ["stripe", "square", "paypal"] },
      { key: "currency", label: "Currency", type: "select", required: true, default: "USD", options: ["USD", "EUR", "GBP", "CAD", "AUD"] },
      { key: "testMode", label: "Test Mode", type: "toggle", required: false, default: true },
    ],
  },
];
