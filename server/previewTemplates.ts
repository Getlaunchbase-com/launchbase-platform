/**
 * Preview Templates Module
 *
 * Generates real HTML preview pages from intake data and build plans.
 * Also generates build plans from intake data.
 */

// ---------------------------------------------------------------------------
// generatePreviewHTML
// ---------------------------------------------------------------------------

export function generatePreviewHTML(
  intakeData: Record<string, unknown>,
  buildPlan: Record<string, unknown>,
  siteSlug: string,
  opts?: { design?: unknown },
): string {
  const businessName = (intakeData.businessName as string) || "Your Business";
  const contactName = (intakeData.contactName as string) || "";
  const vertical = (intakeData.vertical as string) || "professional";
  const phone = (intakeData.phone as string) || "";
  const email = (intakeData.email as string) || "";
  const tagline = (intakeData.tagline as string) || getDefaultTagline(businessName, vertical);
  const services = (intakeData.services as string[]) || [];
  const serviceArea = (intakeData.serviceArea as string[]) || [];
  const primaryCTA = (intakeData.primaryCTA as string) || "Get Started";
  const bookingLink = (intakeData.bookingLink as string) || "#contact";
  const brandFeel = (intakeData.brandFeel as string) || "clean";

  // Extract build plan data
  const plan = (buildPlan.plan as any) || {};
  const brand = plan.brand || {};
  const copy = plan.copy || {};
  const features = plan.features || [];

  const primaryColor = brand.primaryColor || getDefaultColor(vertical);
  const secondaryColor = brand.secondaryColor || "#1e293b";
  const fontFamily = brand.fontFamily || "Inter, system-ui, sans-serif";

  const heroHeadline = copy.heroHeadline || tagline;
  const heroSubheadline = copy.heroSubheadline || `Professional ${vertical} services for your area.`;
  const ctaText = copy.ctaText || primaryCTA;

  // Design overrides from presentation pass
  const design = (opts?.design as Record<string, unknown>) || {};
  const heroStyle = (design.heroStyle as string) || "centered";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(businessName)} - Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${fontFamily}; color: #1e293b; line-height: 1.6; }
    .preview-banner { background: #fef3c7; color: #92400e; text-align: center; padding: 8px; font-size: 13px; font-weight: 500; }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);
      color: white;
      padding: 80px 24px;
      text-align: ${heroStyle === "left-aligned" ? "left" : "center"};
      max-width: 100%;
    }
    .hero h1 { font-size: clamp(28px, 5vw, 48px); font-weight: 800; margin-bottom: 16px; }
    .hero p { font-size: clamp(16px, 2.5vw, 20px); opacity: 0.9; max-width: 640px; ${heroStyle === "centered" ? "margin: 0 auto 24px;" : "margin-bottom: 24px;"} }
    .hero .cta-btn {
      display: inline-block;
      background: white;
      color: ${primaryColor};
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 16px;
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .hero .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

    /* Sections */
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .section { padding: 64px 0; }
    .section-title { font-size: 28px; font-weight: 700; margin-bottom: 12px; text-align: center; }
    .section-subtitle { font-size: 16px; color: #64748b; text-align: center; margin-bottom: 40px; }

    /* Services grid */
    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
    .service-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      transition: box-shadow 0.2s;
    }
    .service-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .service-card h3 { font-size: 18px; margin-bottom: 8px; color: ${primaryColor}; }
    .service-card p { color: #64748b; font-size: 14px; }

    /* Features */
    .features-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .feature-item { display: flex; align-items: center; gap: 12px; padding: 12px; }
    .feature-check { width: 24px; height: 24px; background: ${primaryColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; flex-shrink: 0; }

    /* Service area */
    .area-tags { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .area-tag { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 20px; padding: 6px 16px; font-size: 14px; }

    /* Contact */
    .contact-section { background: #f8fafc; }
    .contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; }
    .contact-info h3 { font-size: 20px; margin-bottom: 16px; }
    .contact-info p { color: #64748b; margin-bottom: 8px; }
    .contact-info a { color: ${primaryColor}; text-decoration: none; }
    .contact-form { display: flex; flex-direction: column; gap: 16px; }
    .contact-form input, .contact-form textarea {
      padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: inherit;
    }
    .contact-form textarea { min-height: 120px; resize: vertical; }
    .submit-btn {
      background: ${primaryColor}; color: white; padding: 14px; border: none; border-radius: 8px;
      font-weight: 600; font-size: 16px; cursor: pointer;
    }

    /* Footer */
    .footer { background: ${secondaryColor}; color: #94a3b8; padding: 32px 24px; text-align: center; font-size: 14px; }
    .footer a { color: #94a3b8; }

    /* Referral badge */
    .referral-badge {
      position: fixed; bottom: 16px; right: 16px; background: white; border: 1px solid #e2e8f0;
      border-radius: 8px; padding: 8px 16px; font-size: 12px; color: #64748b; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .referral-badge a { color: ${primaryColor}; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="preview-banner">
    This is a preview of your website. Review and approve to go live.
  </div>

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <h1>${escapeHtml(heroHeadline)}</h1>
      <p>${escapeHtml(heroSubheadline)}</p>
      <a href="${escapeHtml(bookingLink)}" class="cta-btn">${escapeHtml(ctaText)}</a>
    </div>
  </section>

  ${services.length > 0 ? `
  <!-- Services -->
  <section class="section">
    <div class="container">
      <h2 class="section-title">Our Services</h2>
      <p class="section-subtitle">Professional ${escapeHtml(vertical)} services tailored to your needs</p>
      <div class="services-grid">
        ${services.map((svc) => `
        <div class="service-card">
          <h3>${escapeHtml(svc)}</h3>
          <p>Expert ${escapeHtml(svc.toLowerCase())} services delivered with quality and care.</p>
        </div>`).join("")}
      </div>
    </div>
  </section>` : ""}

  ${features.length > 0 ? `
  <!-- Features -->
  <section class="section" style="background: #f8fafc;">
    <div class="container">
      <h2 class="section-title">Why Choose ${escapeHtml(businessName)}</h2>
      <div class="features-list">
        ${features.map((f: string) => `
        <div class="feature-item">
          <div class="feature-check">&#10003;</div>
          <span>${escapeHtml(f)}</span>
        </div>`).join("")}
      </div>
    </div>
  </section>` : ""}

  ${serviceArea.length > 0 ? `
  <!-- Service Area -->
  <section class="section">
    <div class="container">
      <h2 class="section-title">Areas We Serve</h2>
      <div class="area-tags">
        ${serviceArea.map((area) => `<span class="area-tag">${escapeHtml(area)}</span>`).join("")}
      </div>
    </div>
  </section>` : ""}

  <!-- Contact -->
  <section class="section contact-section" id="contact">
    <div class="container">
      <h2 class="section-title">Get In Touch</h2>
      <p class="section-subtitle">Ready to get started? Reach out today.</p>
      <div class="contact-grid">
        <div class="contact-info">
          <h3>${escapeHtml(businessName)}</h3>
          ${phone ? `<p>Phone: <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></p>` : ""}
          ${email ? `<p>Email: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>` : ""}
          ${serviceArea.length > 0 ? `<p>Serving: ${escapeHtml(serviceArea.join(", "))}</p>` : ""}
        </div>
        <form class="contact-form" onsubmit="return false;">
          <input type="text" placeholder="Your Name" required>
          <input type="email" placeholder="Your Email" required>
          <input type="tel" placeholder="Your Phone">
          <textarea placeholder="How can we help?"></textarea>
          <button type="submit" class="submit-btn">${escapeHtml(ctaText)}</button>
        </form>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(businessName)}. All rights reserved.</p>
    </div>
  </footer>

  <!-- Referral Badge -->
  <div class="referral-badge">
    Built by <a href="/?ref=${escapeHtml(siteSlug)}" target="_blank">LaunchBase</a>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// generateBuildPlan
// ---------------------------------------------------------------------------

export function generateBuildPlan(
  intakeData: Record<string, unknown>,
): Record<string, unknown> {
  const businessName = (intakeData.businessName as string) || "Business";
  const vertical = (intakeData.vertical as string) || "professional";
  const services = (intakeData.services as string[]) || [];
  const tagline = (intakeData.tagline as string) || getDefaultTagline(businessName, vertical);
  const primaryCTA = (intakeData.primaryCTA as string) || "Get Started";
  const brandColors = (intakeData.brandColors as { primary?: string; secondary?: string }) || {};

  const primaryColor = brandColors.primary || getDefaultColor(vertical);
  const secondaryColor = brandColors.secondary || "#1e293b";

  // Determine template based on vertical
  const templateMap: Record<string, string> = {
    trades: "contractor-pro",
    appointments: "booking-flow",
    professional: "modern-clean",
  };

  const templateId = templateMap[vertical] || "modern-clean";

  // Generate pages
  const pages = [
    {
      id: "home",
      title: "Home",
      slug: "/",
      sections: [
        { type: "hero", headline: tagline, cta: primaryCTA },
        { type: "services", items: services },
        { type: "contact" },
      ],
    },
    {
      id: "about",
      title: "About",
      slug: "/about",
      sections: [
        { type: "about-hero" },
        { type: "team" },
        { type: "values" },
      ],
    },
    {
      id: "services",
      title: "Services",
      slug: "/services",
      sections: [
        { type: "services-detail", items: services },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      slug: "/contact",
      sections: [
        { type: "contact-form" },
        { type: "map" },
      ],
    },
  ];

  // Generate features based on vertical
  const featureMap: Record<string, string[]> = {
    trades: [
      "Licensed & Insured",
      "Free Estimates",
      "Same-Day Service Available",
      "Satisfaction Guaranteed",
      "Experienced Team",
      "Competitive Pricing",
    ],
    appointments: [
      "Easy Online Booking",
      "Flexible Scheduling",
      "Professional Staff",
      "Clean & Safe Environment",
      "Affordable Pricing",
      "Walk-ins Welcome",
    ],
    professional: [
      "Industry Expertise",
      "Personalized Service",
      "Proven Results",
      "Responsive Communication",
      "Competitive Rates",
      "Trusted by Local Businesses",
    ],
  };

  return {
    templateId,
    plan: {
      pages,
      brand: {
        primaryColor,
        secondaryColor,
        fontFamily: "Inter, system-ui, sans-serif",
      },
      copy: {
        heroHeadline: tagline,
        heroSubheadline: `Professional ${vertical} services for your area.`,
        ctaText: primaryCTA,
      },
      features: featureMap[vertical] || featureMap.professional,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDefaultTagline(businessName: string, vertical: string): string {
  const taglines: Record<string, string> = {
    trades: `${businessName} - Your Trusted Local Contractor`,
    appointments: `${businessName} - Book Your Appointment Today`,
    professional: `${businessName} - Professional Services You Can Trust`,
  };
  return taglines[vertical] || `${businessName} - Quality Service, Every Time`;
}

function getDefaultColor(vertical: string): string {
  const colors: Record<string, string> = {
    trades: "#2563eb",
    appointments: "#7c3aed",
    professional: "#0f766e",
  };
  return colors[vertical] || "#2563eb";
}
