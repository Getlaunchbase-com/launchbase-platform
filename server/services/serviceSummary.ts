/**
 * Canonical Service Summary Builder
 * 
 * Single source of truth for rendering itemized service summaries.
 * Used in checkout, emails, preview, and admin.
 */

import { SERVICE_CATALOG, getSocialServiceKey, type ServiceKey } from "./serviceCatalog";

export interface ServiceSummaryItem {
  key: ServiceKey;
  title: string;
  includes: string[];
  requires: string[];
  nextStep: string;
  setupPrice: number; // cents
  monthlyPrice: number; // cents
}

export interface ServiceSummary {
  items: ServiceSummaryItem[];
  setupTotal: number; // cents
  monthlyTotal: number; // cents
  setupDiscount: number; // cents (if bundle discount applied)
  notes: string[];
}

export interface ServiceSelections {
  website?: boolean;
  emailService?: boolean;
  socialMediaTier?: "SMALL" | "MEDIUM" | "LARGE" | null;
  googleBusiness?: boolean;
  quickBooksSync?: boolean;
  phoneService?: boolean;
}

export interface PricingSnapshot {
  setupLineItems: Array<{ key: string; label: string; amountCents: number }>;
  monthlyLineItems: Array<{ key: string; label: string; amountCents: number }>;
  setupTotalCents: number;
  monthlyTotalCents: number;
  setupDiscountCents: number;
  notes: string[];
}

/**
 * Build canonical service summary from selections and pricing
 */
export function buildServiceSummary(
  selections: ServiceSelections,
  pricing: PricingSnapshot
): ServiceSummary {
  const items: ServiceSummaryItem[] = [];
  
  // Helper to find price for a service
  const getSetupPrice = (key: string): number => {
    const item = pricing.setupLineItems.find(li => li.key === key);
    return item?.amountCents || 0;
  };
  
  const getMonthlyPrice = (key: string): number => {
    const item = pricing.monthlyLineItems.find(li => li.key === key);
    return item?.amountCents || 0;
  };
  
  // Website
  if (selections.website) {
    const meta = SERVICE_CATALOG.website;
    items.push({
      key: "website",
      title: meta.title,
      includes: meta.includes,
      requires: meta.requires,
      nextStep: meta.nextStep,
      setupPrice: getSetupPrice("website"),
      monthlyPrice: getMonthlyPrice("website")
    });
  }
  
  // Email
  if (selections.emailService) {
    const meta = SERVICE_CATALOG.email;
    items.push({
      key: "email",
      title: meta.title,
      includes: meta.includes,
      requires: meta.requires,
      nextStep: meta.nextStep,
      setupPrice: getSetupPrice("emailService"),
      monthlyPrice: getMonthlyPrice("emailService")
    });
  }
  
  // Social Media
  if (selections.socialMediaTier) {
    const serviceKey = getSocialServiceKey(selections.socialMediaTier);
    if (serviceKey) {
      const meta = SERVICE_CATALOG[serviceKey];
      items.push({
        key: serviceKey,
        title: meta.title,
        includes: meta.includes,
        requires: meta.requires,
        nextStep: meta.nextStep,
        setupPrice: getSetupPrice("socialMediaTier"),
        monthlyPrice: getMonthlyPrice("socialMediaTier")
      });
    }
  }
  
  // Google Business
  if (selections.googleBusiness) {
    const meta = SERVICE_CATALOG.google_business;
    items.push({
      key: "google_business",
      title: meta.title,
      includes: meta.includes,
      requires: meta.requires,
      nextStep: meta.nextStep,
      setupPrice: getSetupPrice("googleBusiness"),
      monthlyPrice: getMonthlyPrice("googleBusiness")
    });
  }
  
  // QuickBooks
  if (selections.quickBooksSync) {
    const meta = SERVICE_CATALOG.quickbooks;
    items.push({
      key: "quickbooks",
      title: meta.title,
      includes: meta.includes,
      requires: meta.requires,
      nextStep: meta.nextStep,
      setupPrice: getSetupPrice("quickBooksSync"),
      monthlyPrice: getMonthlyPrice("quickBooksSync")
    });
  }
  
  // Phone
  if (selections.phoneService) {
    const meta = SERVICE_CATALOG.phone;
    items.push({
      key: "phone",
      title: meta.title,
      includes: meta.includes,
      requires: meta.requires,
      nextStep: meta.nextStep,
      setupPrice: getSetupPrice("phoneService"),
      monthlyPrice: getMonthlyPrice("phoneService")
    });
  }
  
  return {
    items,
    setupTotal: pricing.setupTotalCents,
    monthlyTotal: pricing.monthlyTotalCents,
    setupDiscount: pricing.setupDiscountCents,
    notes: pricing.notes
  };
}

/**
 * Render service summary as plain text (for emails)
 */
export function renderServiceSummaryText(summary: ServiceSummary): string {
  let text = "YOUR SERVICES\n\n";
  
  summary.items.forEach((item, idx) => {
    text += `${idx + 1}. ${item.title}\n`;
    text += `   What's included:\n`;
    item.includes.forEach(inc => {
      text += `   • ${inc}\n`;
    });
    text += `   You'll need to provide:\n`;
    item.requires.forEach(req => {
      text += `   • ${req}\n`;
    });
    text += `   Next step: ${item.nextStep}\n`;
    
    if (item.setupPrice > 0) {
      text += `   Setup: $${(item.setupPrice / 100).toFixed(2)}\n`;
    }
    if (item.monthlyPrice > 0) {
      text += `   Monthly: $${(item.monthlyPrice / 100).toFixed(2)}/mo\n`;
    }
    text += `\n`;
  });
  
  if (summary.setupDiscount > 0) {
    text += `Bundle Discount: -$${(summary.setupDiscount / 100).toFixed(2)}\n`;
  }
  
  text += `\nTOTALS\n`;
  text += `Setup Total: $${(summary.setupTotal / 100).toFixed(2)}\n`;
  if (summary.monthlyTotal > 0) {
    text += `Monthly Total: $${(summary.monthlyTotal / 100).toFixed(2)}/mo\n`;
  }
  
  if (summary.notes.length > 0) {
    text += `\nNOTES\n`;
    summary.notes.forEach(note => {
      text += `• ${note}\n`;
    });
  }
  
  return text;
}

/**
 * Render service summary as HTML (for emails)
 */
export function renderServiceSummaryHTML(summary: ServiceSummary): string {
  let html = `<div style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">`;
  html += `<h3 style="margin-top: 0; color: #333;">Your Services</h3>`;
  
  summary.items.forEach((item, idx) => {
    html += `<div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0;">`;
    html += `<h4 style="margin: 0 0 10px 0; color: #FF6A00;">${idx + 1}. ${item.title}</h4>`;
    
    html += `<p style="margin: 5px 0; font-weight: bold; font-size: 14px;">What's included:</p>`;
    html += `<ul style="margin: 5px 0; padding-left: 20px;">`;
    item.includes.forEach(inc => {
      html += `<li style="margin: 3px 0;">${inc}</li>`;
    });
    html += `</ul>`;
    
    html += `<p style="margin: 10px 0 5px 0; font-weight: bold; font-size: 14px;">You'll need to provide:</p>`;
    html += `<ul style="margin: 5px 0; padding-left: 20px;">`;
    item.requires.forEach(req => {
      html += `<li style="margin: 3px 0;">${req}</li>`;
    });
    html += `</ul>`;
    
    html += `<p style="margin: 10px 0 5px 0; font-size: 14px;"><strong>Next step:</strong> ${item.nextStep}</p>`;
    
    if (item.setupPrice > 0 || item.monthlyPrice > 0) {
      html += `<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">`;
      if (item.setupPrice > 0) {
        html += `Setup: $${(item.setupPrice / 100).toFixed(2)}`;
      }
      if (item.monthlyPrice > 0) {
        if (item.setupPrice > 0) html += ` | `;
        html += `Monthly: $${(item.monthlyPrice / 100).toFixed(2)}/mo`;
      }
      html += `</p>`;
    }
    
    html += `</div>`;
  });
  
  // Totals
  html += `<div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #333;">`;
  
  if (summary.setupDiscount > 0) {
    html += `<p style="margin: 5px 0; color: #1ED760;"><strong>Bundle Discount:</strong> -$${(summary.setupDiscount / 100).toFixed(2)}</p>`;
  }
  
  html += `<p style="margin: 10px 0; font-size: 18px;"><strong>Setup Total:</strong> <span style="color: #FF6A00;">$${(summary.setupTotal / 100).toFixed(2)}</span></p>`;
  
  if (summary.monthlyTotal > 0) {
    html += `<p style="margin: 10px 0; font-size: 18px;"><strong>Monthly Total:</strong> <span style="color: #FF6A00;">$${(summary.monthlyTotal / 100).toFixed(2)}/mo</span></p>`;
  }
  
  html += `</div>`;
  
  if (summary.notes.length > 0) {
    html += `<div style="margin-top: 15px; padding: 10px; background: #fff3e0; border-left: 3px solid #FF6A00;">`;
    summary.notes.forEach(note => {
      html += `<p style="margin: 5px 0; font-size: 14px;">• ${note}</p>`;
    });
    html += `</div>`;
  }
  
  html += `</div>`;
  
  return html;
}
