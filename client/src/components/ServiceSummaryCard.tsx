/**
 * ServiceSummaryCard
 * 
 * Displays itemized service summary in onboarding review and preview pages.
 * Single source of truth for "what you're getting" UI.
 */

import { SERVICE_CATALOG, getSocialServiceKey, type ServiceKey } from "../lib/serviceCatalog";

interface ServiceSummaryCardProps {
  serviceSelections: {
    website?: boolean;
    emailService?: boolean;
    socialMediaTier?: "SMALL" | "MEDIUM" | "LARGE" | null;
    googleBusiness?: boolean;
    quickBooksSync?: boolean;
    phoneService?: boolean;
  };
  pricingSummary: {
    setupTotalCents: number;
    monthlyTotalCents: number;
  };
  showNote?: boolean;
}

export function ServiceSummaryCard({ serviceSelections, pricingSummary, showNote = true }: ServiceSummaryCardProps) {
  const services: Array<{ key: ServiceKey; title: string; description: string }> = [];
  
  // Website
  if (serviceSelections.website) {
    const meta = SERVICE_CATALOG.website;
    services.push({
      key: "website",
      title: meta.title,
      description: meta.includes[0] // First "included" item
    });
  }
  
  // Email
  if (serviceSelections.emailService) {
    const meta = SERVICE_CATALOG.email;
    services.push({
      key: "email",
      title: meta.title,
      description: meta.includes[0]
    });
  }
  
  // Social Media
  if (serviceSelections.socialMediaTier) {
    const serviceKey = getSocialServiceKey(serviceSelections.socialMediaTier);
    if (serviceKey) {
      const meta = SERVICE_CATALOG[serviceKey];
      services.push({
        key: serviceKey,
        title: meta.title,
        description: meta.includes[0]
      });
    }
  }
  
  // Google Business
  if (serviceSelections.googleBusiness) {
    const meta = SERVICE_CATALOG.google_business;
    services.push({
      key: "google_business",
      title: meta.title,
      description: meta.includes[0]
    });
  }
  
  // QuickBooks
  if (serviceSelections.quickBooksSync) {
    const meta = SERVICE_CATALOG.quickbooks;
    services.push({
      key: "quickbooks",
      title: meta.title,
      description: meta.includes[0]
    });
  }
  
  // Phone
  if (serviceSelections.phoneService) {
    const meta = SERVICE_CATALOG.phone;
    services.push({
      key: "phone",
      title: meta.title,
      description: meta.includes[0]
    });
  }
  
  if (services.length === 0) {
    return null;
  }
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">Services You Selected</h3>
      
      <div className="space-y-3 mb-6">
        {services.map((service) => (
          <div key={service.key} className="flex items-start gap-3">
            <div className="w-2 h-2 bg-[#FF6A00] rounded-full mt-2 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">{service.title}</p>
              <p className="text-gray-400 text-sm">{service.description}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="pt-4 border-t border-white/10 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Setup Total</span>
          <span className="text-white font-bold">${(pricingSummary.setupTotalCents / 100).toFixed(0)}</span>
        </div>
        {pricingSummary.monthlyTotalCents > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Monthly Total</span>
            <span className="text-white font-bold">${(pricingSummary.monthlyTotalCents / 100).toFixed(0)}/mo</span>
          </div>
        )}
      </div>
      
      {showNote && (
        <p className="text-sm text-gray-500 mt-4 italic">
          This is exactly what you'll see at checkout.
        </p>
      )}
    </div>
  );
}
