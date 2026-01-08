// Site Preview Template System
// Generates HTML preview based on intake data and inferred vertical

interface IntakeData {
  businessName: string;
  businessDescription: string;
  customerType: string;
  websiteGoals: string[];
  contactPreference: string;
  serviceArea: string;
  phone: string;
  email: string;
  brandFeel: string;
}

interface BuildPlan {
  vertical: string;
  tone: string;
  primaryCTA: string;
  confidence: number;
}

// Infer vertical from business description
export function inferVertical(description: string): string {
  const desc = description.toLowerCase();
  
  // Trades keywords
  const tradesKeywords = ['plumbing', 'plumber', 'hvac', 'heating', 'cooling', 'electrical', 'electrician', 
    'roofing', 'roofer', 'contractor', 'construction', 'handyman', 'painting', 'painter', 'landscaping',
    'lawn', 'tree', 'pest control', 'cleaning', 'pressure wash', 'flooring', 'carpentry', 'carpenter',
    'masonry', 'concrete', 'drywall', 'siding', 'gutters', 'windows', 'doors', 'garage door', 'fence',
    'deck', 'pool', 'septic', 'well', 'excavation', 'demolition', 'remodel', 'renovation'];
  
  // Appointments keywords
  const appointmentsKeywords = ['salon', 'spa', 'barber', 'hair', 'nail', 'massage', 'therapy', 'therapist',
    'chiropractor', 'dentist', 'dental', 'doctor', 'medical', 'clinic', 'veterinary', 'vet', 'pet grooming',
    'fitness', 'personal trainer', 'yoga', 'pilates', 'gym', 'studio', 'photography', 'photographer',
    'tattoo', 'piercing', 'aesthetics', 'botox', 'med spa', 'wellness', 'acupuncture', 'physical therapy'];
  
  // Professional services keywords
  const professionalKeywords = ['law', 'lawyer', 'attorney', 'legal', 'accounting', 'accountant', 'cpa',
    'tax', 'financial', 'advisor', 'consulting', 'consultant', 'marketing', 'agency', 'design', 'architect',
    'engineering', 'engineer', 'real estate', 'realtor', 'insurance', 'broker', 'mortgage', 'notary',
    'translation', 'tutoring', 'coaching', 'business', 'it services', 'tech support', 'web design'];
  
  const tradesScore = tradesKeywords.filter(k => desc.includes(k)).length;
  const appointmentsScore = appointmentsKeywords.filter(k => desc.includes(k)).length;
  const professionalScore = professionalKeywords.filter(k => desc.includes(k)).length;
  
  if (tradesScore >= appointmentsScore && tradesScore >= professionalScore) {
    return 'trades';
  } else if (appointmentsScore >= professionalScore) {
    return 'appointments';
  } else {
    return 'professional';
  }
}

// Infer tone from brand feel
export function inferTone(brandFeel: string): string {
  switch (brandFeel) {
    case 'clean': return 'Professional and trustworthy';
    case 'bold': return 'Bold and confident';
    case 'friendly': return 'Warm and approachable';
    default: return 'Professional and trustworthy';
  }
}

// Infer primary CTA from contact preference and goals
export function inferPrimaryCTA(contactPreference: string, goals: string[]): string {
  if (contactPreference === 'phone' || goals.includes('calls')) {
    return 'Call Now';
  } else if (contactPreference === 'booking' || goals.includes('appointments')) {
    return 'Book Appointment';
  } else if (goals.includes('leads') || goals.includes('quotes')) {
    return 'Get a Free Quote';
  } else {
    return 'Contact Us';
  }
}

// Generate build plan from intake
export function generateBuildPlan(intake: IntakeData): BuildPlan {
  const vertical = inferVertical(intake.businessDescription);
  const tone = inferTone(intake.brandFeel);
  const primaryCTA = inferPrimaryCTA(intake.contactPreference, intake.websiteGoals);
  
  // Calculate confidence based on completeness
  let confidence = 70;
  if (intake.businessDescription.length > 50) confidence += 10;
  if (intake.websiteGoals.length > 0) confidence += 10;
  if (intake.serviceArea) confidence += 5;
  if (intake.brandFeel && intake.brandFeel !== 'auto') confidence += 5;
  
  return {
    vertical,
    tone,
    primaryCTA,
    confidence: Math.min(confidence, 100)
  };
}

// Generate preview HTML
export function generatePreviewHTML(intake: IntakeData, buildPlan: BuildPlan, siteSlug?: string): string {
  const { businessName, businessDescription, serviceArea, phone, email } = intake;
  const { vertical, tone, primaryCTA } = buildPlan;
  
  // Color schemes by vertical
  const colorSchemes = {
    trades: { primary: '#FF6A00', secondary: '#1a1a2e', accent: '#FFB347' },
    appointments: { primary: '#6366F1', secondary: '#1e1b4b', accent: '#A5B4FC' },
    professional: { primary: '#0EA5E9', secondary: '#0c4a6e', accent: '#7DD3FC' }
  };
  
  const colors = colorSchemes[vertical as keyof typeof colorSchemes] || colorSchemes.trades;
  
  // Hero headlines by vertical
  const heroHeadlines = {
    trades: `Your Trusted Local ${getServiceType(businessDescription)}`,
    appointments: `Welcome to ${businessName}`,
    professional: `Expert ${getServiceType(businessDescription)} Services`
  };
  
  const heroSubtitles = {
    trades: `Reliable, professional service for ${serviceArea || 'your area'}. Licensed & insured.`,
    appointments: `Book your appointment today and experience the difference.`,
    professional: `Trusted by clients in ${serviceArea || 'the region'} for exceptional results.`
  };
  
  const headline = heroHeadlines[vertical as keyof typeof heroHeadlines] || heroHeadlines.trades;
  const subtitle = heroSubtitles[vertical as keyof typeof heroSubtitles] || heroSubtitles.trades;
  
  // Services section based on description
  const services = extractServices(businessDescription, vertical);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} - Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; }
    
    /* Header */
    .header {
      background: ${colors.secondary};
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo {
      color: white;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .nav { display: flex; gap: 2rem; }
    .nav a { color: rgba(255,255,255,0.8); text-decoration: none; font-size: 0.9rem; }
    .nav a:hover { color: white; }
    .header-cta {
      background: ${colors.primary};
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
    }
    
    /* Hero */
    .hero {
      background: linear-gradient(135deg, ${colors.secondary} 0%, ${adjustColor(colors.secondary, 20)} 100%);
      color: white;
      padding: 6rem 2rem;
      text-align: center;
    }
    .hero h1 {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 1rem;
      line-height: 1.2;
    }
    .hero p {
      font-size: 1.25rem;
      opacity: 0.9;
      max-width: 600px;
      margin: 0 auto 2rem;
    }
    .hero-cta {
      display: inline-block;
      background: ${colors.primary};
      color: white;
      padding: 1rem 2.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.1rem;
      transition: transform 0.2s;
    }
    .hero-cta:hover { transform: translateY(-2px); }
    
    /* Trust Bar */
    .trust-bar {
      background: #f8f9fa;
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: center;
      gap: 3rem;
      flex-wrap: wrap;
    }
    .trust-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #666;
      font-size: 0.9rem;
    }
    .trust-icon {
      width: 20px;
      height: 20px;
      background: ${colors.primary};
      border-radius: 50%;
    }
    
    /* Services */
    .services {
      padding: 5rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .services h2 {
      text-align: center;
      font-size: 2.25rem;
      margin-bottom: 3rem;
      color: ${colors.secondary};
    }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
    }
    .service-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
      transition: box-shadow 0.2s;
    }
    .service-card:hover {
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .service-icon {
      width: 60px;
      height: 60px;
      background: ${colors.primary}20;
      border-radius: 12px;
      margin: 0 auto 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .service-card h3 {
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
      color: ${colors.secondary};
    }
    .service-card p {
      color: #666;
      font-size: 0.95rem;
      line-height: 1.6;
    }
    
    /* About */
    .about {
      background: #f8f9fa;
      padding: 5rem 2rem;
    }
    .about-content {
      max-width: 800px;
      margin: 0 auto;
      text-align: center;
    }
    .about h2 {
      font-size: 2.25rem;
      margin-bottom: 1.5rem;
      color: ${colors.secondary};
    }
    .about p {
      font-size: 1.1rem;
      color: #555;
      line-height: 1.8;
    }
    
    /* CTA Section */
    .cta-section {
      background: ${colors.primary};
      color: white;
      padding: 4rem 2rem;
      text-align: center;
    }
    .cta-section h2 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    .cta-section p {
      font-size: 1.1rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }
    .cta-button {
      display: inline-block;
      background: white;
      color: ${colors.primary};
      padding: 1rem 2.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.1rem;
    }
    
    /* Footer */
    .footer {
      background: ${colors.secondary};
      color: white;
      padding: 3rem 2rem;
    }
    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2rem;
    }
    .footer h4 {
      font-size: 1rem;
      margin-bottom: 1rem;
      opacity: 0.9;
    }
    .footer p, .footer a {
      color: rgba(255,255,255,0.7);
      font-size: 0.9rem;
      line-height: 1.8;
      text-decoration: none;
    }
    .footer a {
      transition: color 0.2s;
    }
    .footer a:hover { color: white; }
    
    /* Preview Banner */
    .preview-banner {
      background: #FEF3C7;
      color: #92400E;
      padding: 0.75rem;
      text-align: center;
      font-size: 0.875rem;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="preview-banner">
    🎨 This is a preview of your website. Final version may vary slightly.
  </div>
  
  <header class="header">
    <div class="logo">${businessName}</div>
    <nav class="nav">
      <a href="#services">Services</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
    <a href="tel:${phone}" class="header-cta">${primaryCTA}</a>
  </header>
  
  <section class="hero">
    <h1>${headline}</h1>
    <p>${subtitle}</p>
    <a href="tel:${phone}" class="hero-cta">${primaryCTA} →</a>
  </section>
  
  <div class="trust-bar">
    <div class="trust-item">
      <div class="trust-icon"></div>
      <span>Licensed & Insured</span>
    </div>
    <div class="trust-item">
      <div class="trust-icon"></div>
      <span>Serving ${serviceArea || 'Your Area'}</span>
    </div>
    <div class="trust-item">
      <div class="trust-icon"></div>
      <span>5-Star Reviews</span>
    </div>
  </div>
  
  <section class="services" id="services">
    <h2>Our Services</h2>
    <div class="services-grid">
      ${services.map(service => `
        <div class="service-card">
          <div class="service-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="${colors.primary}">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
          </div>
          <h3>${service.name}</h3>
          <p>${service.description}</p>
        </div>
      `).join('')}
    </div>
  </section>
  
  <section class="about" id="about">
    <div class="about-content">
      <h2>About ${businessName}</h2>
      <p>${businessDescription}</p>
    </div>
  </section>
  
  <section class="cta-section" id="contact">
    <h2>Ready to Get Started?</h2>
    <p>Contact us today for a free consultation.</p>
    <a href="tel:${phone}" class="cta-button">${primaryCTA}</a>
  </section>
  
  <footer class="footer">
    <div class="footer-content">
      <div>
        <h4>${businessName}</h4>
        <p>${businessDescription.slice(0, 100)}${businessDescription.length > 100 ? '...' : ''}</p>
      </div>
      <div>
        <h4>Contact</h4>
        <p>Phone: ${phone}</p>
        <p>Email: ${email}</p>
        <p>Service Area: ${serviceArea || 'Contact for details'}</p>
      </div>
      <div>
        <h4>Hours</h4>
        <p>Monday - Friday: 8am - 6pm</p>
        <p>Saturday: 9am - 4pm</p>
        <p>Sunday: Closed</p>
      </div>
    </div>
    <div style="border-top: 1px solid rgba(255,255,255,0.2); margin-top: 2rem; padding-top: 1.5rem; text-align: center;">
      <p style="font-size: 0.85rem; opacity: 0.7;">
        <a href="${siteSlug ? `https://getlaunchbase.com/r/${siteSlug}` : 'https://getlaunchbase.com'}" target="_blank" rel="noopener" style="color: rgba(255,255,255,0.8); text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
          <span>Powered by</span>
          <strong style="color: white;">LaunchBase</strong>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline;">
            <path d="M12 2L15.09 8.26H22L17.55 12.5L19.64 18.76L12 14.01L4.36 18.76L6.45 12.5L2 8.26H8.91L12 2Z"/>
          </svg>
        </a>
      </p>
    </div>
  </footer>
</body>
</html>
`;
}

// Helper functions
function getServiceType(description: string): string {
  const desc = description.toLowerCase();
  const serviceTypes = [
    { keywords: ['plumb'], name: 'Plumber' },
    { keywords: ['hvac', 'heating', 'cooling', 'air condition'], name: 'HVAC' },
    { keywords: ['electric'], name: 'Electrician' },
    { keywords: ['roof'], name: 'Roofer' },
    { keywords: ['paint'], name: 'Painter' },
    { keywords: ['landscap', 'lawn'], name: 'Landscaper' },
    { keywords: ['clean'], name: 'Cleaning' },
    { keywords: ['salon', 'hair'], name: 'Salon' },
    { keywords: ['spa', 'massage'], name: 'Spa' },
    { keywords: ['dental', 'dentist'], name: 'Dental' },
    { keywords: ['law', 'attorney', 'legal'], name: 'Legal' },
    { keywords: ['account', 'tax', 'cpa'], name: 'Accounting' },
    { keywords: ['consult'], name: 'Consulting' },
  ];
  
  for (const type of serviceTypes) {
    if (type.keywords.some(k => desc.includes(k))) {
      return type.name;
    }
  }
  return 'Service';
}

function extractServices(description: string, vertical: string): { name: string; description: string }[] {
  const desc = description.toLowerCase();
  
  // Default services by vertical
  const defaultServices = {
    trades: [
      { name: 'Emergency Repairs', description: 'Fast response for urgent issues. Available when you need us most.' },
      { name: 'Installations', description: 'Professional installation services with quality workmanship guaranteed.' },
      { name: 'Maintenance', description: 'Regular maintenance to keep your systems running smoothly.' },
      { name: 'Inspections', description: 'Thorough inspections to identify issues before they become problems.' },
    ],
    appointments: [
      { name: 'Consultations', description: 'Personalized consultations to understand your needs.' },
      { name: 'Services', description: 'Professional services tailored to your preferences.' },
      { name: 'Packages', description: 'Value packages for regular clients.' },
      { name: 'Special Treatments', description: 'Premium treatments for special occasions.' },
    ],
    professional: [
      { name: 'Consultation', description: 'Initial consultation to understand your situation and goals.' },
      { name: 'Strategy', description: 'Customized strategies developed for your specific needs.' },
      { name: 'Implementation', description: 'Expert implementation of recommended solutions.' },
      { name: 'Ongoing Support', description: 'Continued support to ensure long-term success.' },
    ],
  };
  
  return defaultServices[vertical as keyof typeof defaultServices] || defaultServices.trades;
}

function adjustColor(hex: string, percent: number): string {
  // Simple color adjustment for gradients
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}
