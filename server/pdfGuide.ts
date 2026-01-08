/**
 * LaunchBase PDF Guide Generator
 * Generates "The LaunchBase Platform Guide" PDF for new clients
 */

// PDF content for the LaunchBase Platform Guide
export function generatePlatformGuideContent(data: {
  businessName: string;
  contactName: string;
  vertical: string;
}): string {
  const { businessName, contactName, vertical } = data;
  const firstName = contactName.split(" ")[0];
  
  const verticalTips = {
    trades: `
## Tips for Trades & Contractors

Your website is optimized for service businesses like plumbers, electricians, HVAC technicians, and contractors.

**Key features included:**
- Click-to-call buttons prominently displayed
- Service area information
- Emergency service badges (if applicable)
- Before/after gallery sections
- Customer testimonial areas

**Best practices:**
- Add photos of your work as soon as possible
- Keep your service area information up to date
- Respond to leads within 1 hour for best conversion
`,
    appointments: `
## Tips for Appointment Businesses

Your website is optimized for appointment-based businesses like salons, spas, therapists, and coaches.

**Key features included:**
- Online booking integration
- Service menu display
- Testimonial sections
- Team/staff profiles
- Gallery sections

**Best practices:**
- Connect your booking system right away
- Add professional photos of your space
- Keep your service menu and pricing current
`,
    professional: `
## Tips for Professional Services

Your website is optimized for professional service providers like consultants, lawyers, accountants, and advisors.

**Key features included:**
- Consultation request forms
- Credential and certification display
- Case study sections
- Professional bio areas
- Trust badges

**Best practices:**
- Add your credentials and certifications
- Include case studies or success stories
- Maintain a professional, authoritative tone
`,
  };

  return `# The LaunchBase Platform Guide

**Prepared for:** ${businessName}
**Contact:** ${contactName}

---

## Welcome to LaunchBase, ${firstName}!

Thank you for choosing LaunchBase to build your professional website. This guide will help you understand what's included, what to expect, and how to get the most out of your new online presence.

---

## What's Included

### Website Build
- Custom-built professional website
- Industry-specific structure & layout
- Professional copywriting
- Mobile-responsive design
- Human review before launch

### Lead Capture
- Click-to-call buttons
- Contact forms
- Quote request forms
- Booking link integration
- Clear calls-to-action

### Hosting & Infrastructure
- Fast, reliable hosting
- SSL certificate (https)
- Domain setup assistance
- Uptime monitoring
- Security updates

### Ongoing Support
- Content updates on request
- LaunchBase dashboard access
- Email support
- Platform improvements over time
- Cancel anytime

---

## Timeline Expectations

| Stage | Timeline |
|-------|----------|
| Intake completion | ~5 minutes |
| Site build & review | 24-72 hours |
| Your review & feedback | At your pace |
| Launch after approval | Same day |

---

## The Build Process

### Step 1: Intake Complete ✓
You've already completed this step! We have all the information we need to build your site.

### Step 2: Site Build (24-72 hours)
Our system generates your custom website with professional copy, optimized for your specific business type.

### Step 3: Human Review
A real person reviews everything before it's ready — catching edge cases and ensuring quality.

### Step 4: Your Preview
You'll receive a preview link to review your site. Nothing launches until you're happy.

### Step 5: Launch
Once approved, your site goes live. We handle hosting, updates, and support going forward.

---

${verticalTips[vertical as keyof typeof verticalTips] || verticalTips.professional}

---

## Pricing Summary

### Founding Client Pricing

**$499** one-time setup
**$79**/month ongoing

This includes:
- Website build & deployment
- Hosting & infrastructure
- Ongoing updates and support
- Platform improvements over time

There are:
- No contracts
- No hidden fees
- No long-term commitments

**Founding client pricing is locked for as long as your account remains active.**

---

## Getting Help

### Email Support
support@launchbase.com

### Response Times
- General questions: Within 24 hours
- Urgent issues: Within 4 hours (business days)

### What We Can Help With
- Content updates and changes
- Technical issues
- Feature requests
- General questions

---

## Frequently Asked Questions

### How long does it take to launch?
Most sites are ready for review within 24-72 hours after intake completion.

### Can I make changes later?
Yes! You can request content updates anytime. We handle all changes for you.

### Do I own my website?
Yes. You own all the content. We handle hosting and maintenance.

### What if I don't like the first version?
We'll work with you until you're happy. Request changes during the preview phase.

### Can I cancel anytime?
Yes. No contracts, no cancellation fees.

---

## Thank You

We're excited to help ${businessName} grow online. If you have any questions, don't hesitate to reach out.

**The LaunchBase Team**

---

*This guide was generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*
`;
}

/**
 * Generate the PDF guide as a downloadable markdown file
 * (In production, this would generate an actual PDF using a library like puppeteer or pdfkit)
 */
export async function generatePlatformGuidePDF(data: {
  businessName: string;
  contactName: string;
  vertical: string;
}): Promise<{ content: string; filename: string }> {
  const content = generatePlatformGuideContent(data);
  const filename = `LaunchBase-Guide-${data.businessName.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
  
  return { content, filename };
}
