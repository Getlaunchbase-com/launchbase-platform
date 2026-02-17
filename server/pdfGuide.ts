/**
 * PDF Guide Generator
 *
 * Generates a simple text-based PDF buffer for the platform guide.
 * Uses a minimal PDF 1.4 format without external dependencies.
 */

// ---------------------------------------------------------------------------
// generatePlatformGuidePDF
// ---------------------------------------------------------------------------

export async function generatePlatformGuidePDF(input: {
  businessName: string;
  contactName: string;
  vertical: string;
}): Promise<{ content: Buffer; filename: string }> {
  const { businessName, contactName, vertical } = input;

  const verticalTips: Record<string, string[]> = {
    trades: [
      "Highlight your service areas prominently on the homepage",
      "Include before/after project photos in a gallery",
      "Add a 'Request a Free Estimate' call-to-action button",
      "List all licenses and certifications",
      "Feature customer testimonials from recent jobs",
      "Ensure your phone number is click-to-call on mobile",
    ],
    appointments: [
      "Embed your online booking system on the homepage",
      "List your services with pricing (or 'starting from' ranges)",
      "Include your hours of operation prominently",
      "Add staff bios with photos",
      "Feature a cancellation/rescheduling policy",
      "Highlight any first-visit specials or promotions",
    ],
    professional: [
      "Lead with your unique value proposition",
      "Include case studies or portfolio samples",
      "Add a professional headshot and team page",
      "Feature client logos or testimonials",
      "Include a clear 'Schedule a Consultation' CTA",
      "List your credentials, certifications, and memberships",
    ],
  };

  const tips = verticalTips[vertical] || verticalTips.professional;
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build content lines
  const lines = [
    `LAUNCHBASE PLATFORM GUIDE`,
    `========================`,
    ``,
    `Prepared for: ${contactName}`,
    `Business: ${businessName}`,
    `Vertical: ${vertical}`,
    `Date: ${date}`,
    ``,
    ``,
    `GETTING STARTED`,
    `---------------`,
    ``,
    `Welcome to LaunchBase! This guide will help you make the most of`,
    `your new website. Here's what to expect:`,
    ``,
    `1. REVIEW YOUR PREVIEW`,
    `   Once your site preview is ready, you'll receive an email with`,
    `   a unique link. Review every page carefully and note any changes.`,
    ``,
    `2. REQUEST CHANGES`,
    `   Use the feedback form on your preview page to request any`,
    `   modifications. Our team typically implements changes within`,
    `   24-48 hours.`,
    ``,
    `3. APPROVE & PAY`,
    `   When you're happy with the preview, approve the build plan`,
    `   and complete payment to launch your site.`,
    ``,
    `4. GO LIVE`,
    `   After payment, your site goes live within 24 hours. You'll`,
    `   receive a launch confirmation email with your live URL.`,
    ``,
    ``,
    `TIPS FOR YOUR ${vertical.toUpperCase()} WEBSITE`,
    `${"=".repeat(15 + vertical.length + 8)}`,
    ``,
    ...tips.map((tip, i) => `  ${i + 1}. ${tip}`),
    ``,
    ``,
    `WHAT'S INCLUDED`,
    `---------------`,
    ``,
    `  - Mobile-responsive design`,
    `  - SEO optimization`,
    `  - Contact form integration`,
    `  - Google Maps integration`,
    `  - SSL security certificate`,
    `  - Performance optimization`,
    `  - Analytics tracking`,
    ``,
    ``,
    `NEED HELP?`,
    `----------`,
    ``,
    `Email: support@launchbase.com`,
    `Response time: Within 24 hours`,
    ``,
    `Thank you for choosing LaunchBase!`,
  ];

  const textContent = lines.join("\n");

  // Generate a minimal valid PDF
  const pdfBuffer = generateMinimalPDF(textContent);

  const safeBusinessName = businessName
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 40);
  const filename = `LaunchBase_Guide_${safeBusinessName}.pdf`;

  return { content: pdfBuffer, filename };
}

// ---------------------------------------------------------------------------
// Minimal PDF generator (PDF 1.4 spec, no external deps)
// ---------------------------------------------------------------------------

function generateMinimalPDF(text: string): Buffer {
  const lines = text.split("\n");

  // Escape special PDF characters in text
  const escapeText = (s: string): string =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  // Build page content stream with text
  const fontSize = 10;
  const leading = 14;
  const marginLeft = 50;
  const marginTop = 750;

  // Split into pages (approx 50 lines per page)
  const linesPerPage = 50;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }

  const objects: string[] = [];
  let objCounter = 0;

  const addObj = (content: string): number => {
    objCounter++;
    objects.push(`${objCounter} 0 obj\n${content}\nendobj`);
    return objCounter;
  };

  // Object 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`);

  // Object 2: Pages (will be updated after we know page count)
  const pagesObjIndex = objects.length;
  addObj(`<< /Type /Pages /Kids [] /Count 0 >>`); // placeholder

  // Object 3: Font
  addObj(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`,
  );

  // Generate page objects
  const pageObjIds: number[] = [];
  const streamObjIds: number[] = [];

  for (const pageLines of pages) {
    // Build stream content
    let stream = `BT\n/F1 ${fontSize} Tf\n${leading} TL\n${marginLeft} ${marginTop} Td\n`;
    for (const line of pageLines) {
      stream += `(${escapeText(line)}) Tj T*\n`;
    }
    stream += `ET`;

    const streamBytes = Buffer.from(stream, "utf-8");

    // Stream object
    const streamId = addObj(
      `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`,
    );
    streamObjIds.push(streamId);

    // Page object
    const pageId = addObj(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${streamId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    pageObjIds.push(pageId);
  }

  // Update Pages object
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  objects[pagesObjIndex] =
    `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIds.length} >>\nendobj`;

  // Build the PDF file
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += obj + "\n";
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += "xref\n";
  pdf += `0 ${objCounter + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += "trailer\n";
  pdf += `<< /Size ${objCounter + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF";

  return Buffer.from(pdf, "utf-8");
}
