// Client-side preview HTML generator
// Generates a full HTML page preview based on intake and build plan data

interface IntakeData {
  businessName: string;
  businessDescription?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email: string;
  serviceArea?: string[] | null;
  services?: string[] | null;
  vertical: string;
  tagline?: string | null;
}

interface BuildPlanData {
  plan?: {
    vertical?: string;
    tone?: string;
    primaryCTA?: string;
    copy?: {
      heroHeadline: string;
      heroSubheadline: string;
      ctaText?: string;
    };
    pages?: { id: string; title: string; slug?: string; sections?: unknown[] }[];
    brand?: {
      primaryColor?: string;
      secondaryColor?: string;
      fontFamily?: string;
    };
    features?: string[];
  } | null;
}

// Helper to extract service type from description
function getServiceType(description?: string): string {
  if (!description) return 'Service Provider';
  const desc = description.toLowerCase();
  
  const serviceTypes: Record<string, string> = {
    'plumb': 'Plumber',
    'hvac': 'HVAC Specialist',
    'electric': 'Electrician',
    'roof': 'Roofer',
    'paint': 'Painter',
    'landscap': 'Landscaper',
    'clean': 'Cleaning Service',
    'handyman': 'Handyman',
    'snow': 'Snow Removal',
    'plow': 'Snow Plow Service',
    'lawn': 'Lawn Care',
    'tree': 'Tree Service',
    'pest': 'Pest Control',
    'salon': 'Salon',
    'spa': 'Spa',
    'massage': 'Massage Therapist',
    'dental': 'Dentist',
    'chiro': 'Chiropractor',
    'law': 'Law Firm',
    'account': 'Accountant',
    'consult': 'Consultant',
    'real estate': 'Real Estate Agent',
  };
  
  for (const [keyword, type] of Object.entries(serviceTypes)) {
    if (desc.includes(keyword)) return type;
  }
  return 'Service Provider';
}

// Helper to adjust color brightness
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// Extract services from description
function extractServices(description?: string, vertical?: string): { name: string; description: string }[] {
  const defaultServices: Record<string, { name: string; description: string }[]> = {
    trades: [
      { name: 'Emergency Service', description: 'Available 24/7 for urgent needs' },
      { name: 'Residential', description: 'Complete home services' },
      { name: 'Commercial', description: 'Business and commercial solutions' },
      { name: 'Maintenance', description: 'Regular maintenance programs' },
    ],
    appointments: [
      { name: 'Consultations', description: 'Initial assessment and planning' },
      { name: 'Regular Sessions', description: 'Ongoing care and treatment' },
      { name: 'Special Packages', description: 'Bundled services at great value' },
      { name: 'Walk-ins Welcome', description: 'No appointment necessary' },
    ],
    professional: [
      { name: 'Consultation', description: 'Expert advice and guidance' },
      { name: 'Full Service', description: 'End-to-end solutions' },
      { name: 'Ongoing Support', description: 'Long-term partnership' },
      { name: 'Custom Solutions', description: 'Tailored to your needs' },
    ],
  };
  
  return defaultServices[vertical || 'trades'] || defaultServices.trades;
}

export function generatePreviewHTML(intake: IntakeData, buildPlan?: BuildPlanData): string {
  const businessName = intake.businessName || 'Your Business';
  const businessDescription = intake.businessDescription || '';
  const phone = intake.phone || '(555) 123-4567';
  const email = intake.email || 'contact@example.com';
  const serviceArea = intake.serviceArea?.join(', ') || 'Your Area';
  const vertical = buildPlan?.plan?.vertical || intake.vertical || 'trades';
  
  // Color schemes by vertical
  const colorSchemes: Record<string, { primary: string; secondary: string; accent: string }> = {
    trades: { primary: '#FF6A00', secondary: '#1a1a2e', accent: '#FFB347' },
    appointments: { primary: '#6366F1', secondary: '#1e1b4b', accent: '#A5B4FC' },
    professional: { primary: '#0EA5E9', secondary: '#0c4a6e', accent: '#7DD3FC' }
  };
  
  const colors = colorSchemes[vertical] || colorSchemes.trades;
  
  // Get hero copy from build plan or generate defaults
  const heroHeadline = buildPlan?.plan?.copy?.heroHeadline || 
    (vertical === 'trades' ? `Your Trusted Local ${getServiceType(businessDescription)}` :
     vertical === 'appointments' ? `Welcome to ${businessName}` :
     `Expert ${getServiceType(businessDescription)} Services`);
  
  const heroSubheadline = buildPlan?.plan?.copy?.heroSubheadline ||
    (vertical === 'trades' ? `Reliable, professional service for ${serviceArea}. Licensed & insured.` :
     vertical === 'appointments' ? `Book your appointment today and experience the difference.` :
     `Trusted by clients in ${serviceArea} for exceptional results.`);
  
  const primaryCTA = buildPlan?.plan?.primaryCTA || 'Call Now';
  
  // Get services
  const services = extractServices(businessDescription, vertical);
  
  // Generate pages navigation
  const pages = buildPlan?.plan?.pages || [
    { id: 'home', title: 'Home' },
    { id: 'services', title: 'Services' },
    { id: 'about', title: 'About' },
    { id: 'contact', title: 'Contact' },
  ];

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
      font-size: 1.1rem;
      margin-bottom: 1rem;
    }
    .footer p, .footer a {
      color: rgba(255,255,255,0.7);
      font-size: 0.9rem;
      line-height: 1.8;
      text-decoration: none;
    }
    .footer a:hover { color: white; }
    .footer-bottom {
      max-width: 1200px;
      margin: 2rem auto 0;
      padding-top: 2rem;
      border-top: 1px solid rgba(255,255,255,0.1);
      text-align: center;
      color: rgba(255,255,255,0.5);
      font-size: 0.85rem;
    }
    
    /* Preview Banner */
    .preview-banner {
      background: ${colors.primary};
      color: white;
      text-align: center;
      padding: 0.75rem;
      font-size: 0.9rem;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="logo">${businessName}</div>
    <nav class="nav">
      ${pages.map(p => `<a href="#${p.id}">${p.title}</a>`).join('\n      ')}
    </nav>
    <a href="tel:${phone.replace(/[^0-9]/g, '')}" class="header-cta">${primaryCTA}</a>
  </header>

  <!-- Hero Section -->
  <section class="hero" id="home">
    <h1>${heroHeadline}</h1>
    <p>${heroSubheadline}</p>
    <a href="tel:${phone.replace(/[^0-9]/g, '')}" class="hero-cta">${primaryCTA} →</a>
  </section>

  <!-- Trust Bar -->
  <section class="trust-bar">
    <div class="trust-item">
      <div class="trust-icon"></div>
      <span>Licensed & Insured</span>
    </div>
    <div class="trust-item">
      <div class="trust-icon"></div>
      <span>Free Estimates</span>
    </div>
    <div class="trust-item">
      <div class="trust-icon"></div>
      <span>Satisfaction Guaranteed</span>
    </div>
    <div class="trust-item">
      <div class="trust-icon"></div>
      <span>Serving ${serviceArea}</span>
    </div>
  </section>

  <!-- Services Section -->
  <section class="services" id="services">
    <h2>Our Services</h2>
    <div class="services-grid">
      ${services.map(s => `
      <div class="service-card">
        <div class="service-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${colors.primary}" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h3>${s.name}</h3>
        <p>${s.description}</p>
      </div>
      `).join('')}
    </div>
  </section>

  <!-- About Section -->
  <section class="about" id="about">
    <div class="about-content">
      <h2>About ${businessName}</h2>
      <p>${businessDescription || `We are a trusted local business serving ${serviceArea}. Our team is dedicated to providing exceptional service and ensuring complete customer satisfaction. Contact us today to learn more about how we can help you.`}</p>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta-section">
    <h2>Ready to Get Started?</h2>
    <p>Contact us today for a free consultation and estimate.</p>
    <a href="tel:${phone.replace(/[^0-9]/g, '')}" class="cta-button">${primaryCTA}</a>
  </section>

  <!-- Footer -->
  <footer class="footer" id="contact">
    <div class="footer-content">
      <div>
        <h4>${businessName}</h4>
        <p>Your trusted local service provider.</p>
      </div>
      <div>
        <h4>Contact</h4>
        <p>
          <a href="tel:${phone.replace(/[^0-9]/g, '')}">${phone}</a><br>
          <a href="mailto:${email}">${email}</a>
        </p>
      </div>
      <div>
        <h4>Service Area</h4>
        <p>${serviceArea}</p>
      </div>
      <div>
        <h4>Hours</h4>
        <p>Mon-Fri: 8am - 6pm<br>Sat: 9am - 4pm<br>Sun: Emergency Only</p>
      </div>
    </div>
    <div class="footer-bottom">
      © ${new Date().getFullYear()} ${businessName}. All rights reserved.
    </div>
  </footer>

  <!-- Preview Banner -->
  <div class="preview-banner">
    🚀 This is a preview of your website. Powered by LaunchBase.
  </div>
</body>
</html>
`;
}
