/**
 * Proposed Change Preview Endpoint
 * 
 * GET /preview/proposed/:token
 * 
 * Shows customer what the change will look like BEFORE they approve.
 * In-memory overlay - no DB writes.
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import { actionRequests, intakes } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { logActionEvent } from "./action-request-events";

/**
 * Apply proposed value to preview data (in-memory overlay)
 */
function applyProposedValueToPreview(data: {
  intake: any;
  checklistKey: string;
  proposedValue: unknown;
}): any {
  const { intake, checklistKey, proposedValue } = data;
  
  // Clone intake to avoid mutation
  const preview = { ...intake };
  
  // Apply overlay based on checklistKey
  switch (checklistKey) {
    case "homepage.headline":
      preview.businessName = proposedValue as string;
      break;
      
    case "homepage.subheadline":
      preview.tagline = proposedValue as string;
      break;
      
    case "cta.primary":
    case "contact.cta":
      preview.primaryCTA = proposedValue as string;
      break;
      
    case "homepage.services":
    case "services.list":
      preview.services = proposedValue;
      break;
      
    case "gmb.category":
      preview.gmbCategory = proposedValue as string;
      break;
      
    case "contact.phone":
      preview.phone = proposedValue as string;
      break;
      
    case "contact.email":
      preview.email = proposedValue as string;
      break;
      
    case "contact.booking_link":
      preview.bookingLink = proposedValue as string;
      break;
      
    case "homepage.about":
      preview.about = proposedValue as string;
      break;
      
    case "branding.colors":
      preview.brandColors = proposedValue;
      break;
      
    default:
      // Unknown key - return null to trigger fallback
      return null;
  }
  
  return preview;
}

/**
 * Handle GET /preview/proposed/:token
 */
export async function handleProposedPreview(req: Request, res: Response) {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Invalid Preview Link</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Invalid Preview Link</h1>
          <p>This preview link is malformed. Please use the link from your email.</p>
        </body>
        </html>
      `);
    }
    
    const db = await getDb();
    if (!db) {
      return res.status(500).send("Database not available");
    }
    
    // Load action request by proposedPreviewToken
    const [actionRequest] = await db
      .select()
      .from(actionRequests)
      .where(eq(actionRequests.proposedPreviewToken, token))
      .limit(1);
    
    if (!actionRequest) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Preview Not Found</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Preview Not Found</h1>
          <p>This preview link doesn't exist or has been removed.</p>
        </body>
        </html>
      `);
    }
    
    // Check expiration
    if (actionRequest.proposedPreviewExpiresAt && new Date() > actionRequest.proposedPreviewExpiresAt) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Preview Expired</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Preview Expired</h1>
          <p>This preview link has expired. Please check your email for the latest action request.</p>
          <p style="color: #6b7280; font-size: 14px;">Expired on: ${actionRequest.proposedPreviewExpiresAt.toLocaleString()}</p>
        </body>
        </html>
      `);
    }
    
    // Load intake
    const [intake] = await db
      .select()
      .from(intakes)
      .where(eq(intakes.id, actionRequest.intakeId))
      .limit(1);
    
    if (!intake) {
      return res.status(404).send("Intake not found");
    }
    
    // Apply proposed value overlay (in-memory)
    const previewData = applyProposedValueToPreview({
      intake,
      checklistKey: actionRequest.checklistKey,
      proposedValue: actionRequest.proposedValue,
    });
    
    if (!previewData) {
      // Couldn't render preview for this checklistKey
      await logActionEvent({
        actionRequestId: actionRequest.id,
        intakeId: actionRequest.intakeId,
        eventType: "PROPOSED_PREVIEW_RENDER_FAILED",
        actorType: "system",
        reason: `Unknown checklistKey: ${actionRequest.checklistKey}`,
      });
      
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Preview Unavailable</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Preview Unavailable</h1>
          <p>We couldn't render the proposed change preview for <strong>${actionRequest.checklistKey}</strong>, but you can still approve or reply with edits.</p>
          <p style="margin-top: 32px;">
            <a href="/api/actions/${actionRequest.token}/approve" style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">✅ Approve Anyway</a>
            <a href="/api/actions/${actionRequest.token}/edit" style="background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-left: 12px;">✏️ Edit</a>
          </p>
        </body>
        </html>
      `);
    }
    
    // Log preview view event (optional tracking)
    await logActionEvent({
      actionRequestId: actionRequest.id,
      intakeId: actionRequest.intakeId,
      eventType: "PREVIEW_VIEWED",
      actorType: "customer",
      meta: {
        checklistKey: actionRequest.checklistKey,
        previewToken: token,
      },
    });
    
    // Render preview HTML with banner
    const html = renderProposedPreviewHTML({
      intake: previewData,
      actionRequest,
      originalIntake: intake,
    });
    
    return res.status(200).send(html);
  } catch (err) {
    console.error("[ProposedPreview] Error:", err);
    return res.status(500).send("Internal server error");
  }
}

/**
 * Render proposed preview HTML
 */
function renderProposedPreviewHTML(data: {
  intake: any;
  actionRequest: any;
  originalIntake: any;
}): string {
  const { intake, actionRequest, originalIntake } = data;
  
  // Simple preview HTML (you can enhance this with your actual template)
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposed Change Preview - ${intake.businessName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
    }
    .preview-banner {
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      color: #78350f;
      padding: 16px 20px;
      text-align: center;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .preview-banner-text {
      font-size: 14px;
      margin-bottom: 12px;
    }
    .preview-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
      transition: transform 0.2s;
    }
    .btn:hover {
      transform: translateY(-1px);
    }
    .btn-approve {
      background: #16a34a;
      color: white;
    }
    .btn-edit {
      background: #ea580c;
      color: white;
    }
    .hero {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 80px 20px;
      text-align: center;
    }
    .hero h1 {
      font-size: 48px;
      margin-bottom: 16px;
      font-weight: 700;
    }
    .hero p {
      font-size: 20px;
      opacity: 0.9;
      max-width: 600px;
      margin: 0 auto;
    }
    .content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 60px 20px;
    }
    .section {
      margin-bottom: 60px;
    }
    .section h2 {
      font-size: 32px;
      margin-bottom: 16px;
      color: #111827;
    }
    .services {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      margin-top: 32px;
    }
    .service-card {
      background: #f9fafb;
      padding: 24px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .service-card h3 {
      font-size: 18px;
      margin-bottom: 8px;
      color: #1f2937;
    }
    .cta-section {
      background: #f3f4f6;
      padding: 60px 20px;
      text-align: center;
    }
    .cta-button {
      display: inline-block;
      background: #ea580c;
      color: white;
      padding: 16px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
      margin-top: 24px;
    }
    .highlight {
      background: #fef3c7;
      border: 2px solid #fbbf24;
      padding: 4px 8px;
      border-radius: 4px;
    }
    @media (max-width: 768px) {
      .hero h1 { font-size: 32px; }
      .hero p { font-size: 16px; }
      .preview-actions { flex-direction: column; }
      .btn { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="preview-banner">
    <div class="preview-banner-text">
      📋 Previewing proposed change · Not live yet · This shows how "${actionRequest.checklistKey}" will look with your proposed change
    </div>
    <div class="preview-actions">
      <a href="/api/actions/${actionRequest.token}/approve" class="btn btn-approve">✅ Approve This Change</a>
      <a href="/api/actions/${actionRequest.token}/edit" class="btn btn-edit">✏️ Edit Instead</a>
    </div>
  </div>

  <div class="hero">
    <h1 class="${actionRequest.checklistKey === 'homepage.headline' ? 'highlight' : ''}">${intake.businessName}</h1>
    <p class="${actionRequest.checklistKey === 'homepage.subheadline' ? 'highlight' : ''}">${intake.tagline || 'Professional services you can trust'}</p>
  </div>

  <div class="content">
    ${intake.services && Array.isArray(intake.services) ? `
    <div class="section">
      <h2 class="${actionRequest.checklistKey === 'homepage.services' ? 'highlight' : ''}">Our Services</h2>
      <div class="services">
        ${intake.services.map((service: string) => `
          <div class="service-card">
            <h3>${service}</h3>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${intake.about ? `
    <div class="section">
      <h2>About Us</h2>
      <p class="${actionRequest.checklistKey === 'homepage.about' ? 'highlight' : ''}">${intake.about}</p>
    </div>
    ` : ''}
  </div>

  <div class="cta-section">
    <h2>Ready to Get Started?</h2>
    <a href="${intake.bookingLink || '#'}" class="cta-button ${actionRequest.checklistKey === 'cta.primary' ? 'highlight' : ''}">
      ${intake.primaryCTA || 'Contact Us'}
    </a>
    ${intake.phone ? `<p style="margin-top: 16px; color: #6b7280;" class="${actionRequest.checklistKey === 'contact.phone' ? 'highlight' : ''}">Call: ${intake.phone}</p>` : ''}
  </div>
</body>
</html>
  `.trim();
}
