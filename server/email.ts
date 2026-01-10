/**
 * LaunchBase Email Service
 * Production-ready email templates for the post-intake sequence
 */

import { getDb } from "./db";
import { emailLogs } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import { Resend } from "resend";
import { ENV } from "./_core/env";
import { getEmailCopy, interpolateEmail, type Language, type Audience, type WebsiteStatus } from "./emails/emailCopy";

// Error normalization helpers (FOREVER FIX)
function truncateOneLine(input: unknown, max = 1500): string {
  let s: string;
  try {
    s = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    s = String(input);
  }
  s = s.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function normalizeResendError(err: unknown): {
  message: string;
  name?: string;
  status?: number;
  code?: string;
  details?: unknown;
} {
  const e = err as any;

  const message =
    e?.message ||
    e?.error?.message ||
    e?.response?.data?.message ||
    e?.response?.message ||
    "Unknown error";

  const status =
    e?.statusCode ??
    e?.status ??
    e?.response?.status ??
    e?.response?.statusCode;

  const code =
    e?.code ||
    e?.error?.code ||
    e?.response?.data?.code;

  const details =
    e?.response?.data ||
    e?.error ||
    e;

  return {
    message: truncateOneLine(message),
    name: e?.name ? truncateOneLine(e.name, 120) : undefined,
    status: typeof status === "number" ? status : undefined,
    code: typeof code === "string" ? truncateOneLine(code, 120) : undefined,
    details,
  };
}

// Runtime Resend client (never cache at module level)
function getResendClient(): Resend | null {
  if (!ENV.resendApiKey) {
    console.log("[Email] No RESEND_API_KEY configured, will use notification fallback");
    return null;
  }
  return new Resend(ENV.resendApiKey);
}

// Email configuration - PRO SENDER ENFORCED (FOREVER)
// Professional sender identity for all emails - verified domain required
const FROM_EMAIL = "LaunchBase <support@getlaunchbase.com>";
const REPLY_TO_EMAIL = "support@getlaunchbase.com";

// Email template types
export type EmailType = 
  | "intake_confirmation"
  | "in_progress"
  | "ready_for_review"
  | "review_nudge"
  | "deployment_started"
  | "site_live"
  | "preview_followup"
  | "testimonial_request"
  | "founding_client_lockin"
  | "founder_welcome"
  | "day7_checkin"
  | "day30_value"
  | "contact_form_confirmation";

interface EmailData {
  firstName: string;
  businessName: string;
  email: string;
  previewUrl?: string;
  liveUrl?: string;
  checkoutLink?: string;
  language?: Language;
  audience?: Audience;
  websiteStatus?: WebsiteStatus;
  founderNumber?: string;
}

interface EmailTemplate {
  subject: string;
  previewText: string;
  body: string;
}

// Generate email templates based on type and data (LOCALIZED)
export function getEmailTemplate(type: EmailType, data: EmailData): EmailTemplate {
  const { firstName, businessName, previewUrl, liveUrl, founderNumber, language = "en", audience = "biz", websiteStatus } = data;
  
  // Get localized copy from emailCopy map
  const copy = getEmailCopy({ language, audience, emailType: type, websiteStatus });
  
  // Interpolate variables
  let body = interpolateEmail(copy.body, { firstName, businessName, previewUrl, liveUrl });
  let subject = copy.subject;
  if (founderNumber) {
    body = body.replace(/\{\{founderNumber\}\}/g, founderNumber);
    subject = subject.replace(/\{\{founderNumber\}\}/g, founderNumber);
  }
  
  return {
    subject,
    previewText: copy.previewText,
    body,
  };
  
  // Legacy fallback (should never reach here, but kept for safety)
  const legacyData = { firstName, businessName, previewUrl, liveUrl };
  
  switch (type) {
    // ========== POST-INTAKE SEQUENCE ==========
    
    case "intake_confirmation":
      return {
        subject: "✅ We're building your website",
        previewText: "Your LaunchBase site is officially in progress.",
        body: `Hi ${firstName},

Thanks for completing your LaunchBase intake.

We're now building your website based on the information you provided. Our system handles the structure, copy, and layout — and a real human reviews everything before it's ready.

What happens next:
• We build your site
• We review it for quality
• You'll receive a link to preview and approve

Estimated turnaround: 24–72 hours
(No payment required to review.)

If you have questions in the meantime, just reply to this email.

—
💰 Know someone who needs a website? Refer a friend and you'll both save $50.
https://getlaunchbase.com/referrals

—
LaunchBase
The operating system for launching service businesses`
      };

    case "in_progress":
      return {
        subject: "👷 Your site is in progress",
        previewText: "Just a quick update — everything is on track.",
        body: `Hi ${firstName},

Just a quick update — your website is currently being built.

Nothing is needed from you right now. We're assembling the layout, copy, and features based on your intake and reviewing everything before it's ready.

You'll receive another email as soon as your preview is available.

—
LaunchBase`
      };

    case "ready_for_review":
      return {
        subject: "Your site preview is ready",
        previewText: "Nothing is published yet — review your preview and let us know.",
        body: `Hi ${firstName},

Your LaunchBase preview is ready to review.

Nothing is published yet — this is your chance to confirm everything looks right.

👉 Review your preview:
${previewUrl || "[Preview URL]"}

If you want changes, reply to this email and we'll adjust it before launch.

—
LaunchBase
Workflows that give you back your life.`
      };

    case "review_nudge":
      return {
        subject: "Just checking in — your site is ready",
        previewText: "No rush, just making sure you saw it.",
        body: `Hi ${firstName},

Just checking in to make sure you saw your site preview.

👉 ${previewUrl || "[Preview URL]"}

There's no rush — we just want to be sure everything looks right before launch.

If you have questions or want changes, reply here and we'll take care of it.

—
LaunchBase`
      };

    case "deployment_started":
      return {
        subject: "We received payment — deployment has started",
        previewText: "Your site is being deployed now.",
        body: `Hi ${firstName},

We received your payment — thank you.

Your site is now being deployed. Here's what's happening:

1. Provisioning your template
2. Applying your branding
3. Publishing to the web
4. Connecting your domain (if applicable)

You'll receive another email as soon as your site is live.

—
LaunchBase
Workflows that give you back your life.`
      };

    case "site_live":
      return {
        subject: "Your site is live — and you don't need to manage it",
        previewText: "LaunchBase has taken over. Here's what that means.",
        body: `Hi ${firstName},

Your site is live — and you don't need to manage it.

👉 View your site:
${liveUrl || "[Live URL]"}

From this moment, LaunchBase is carrying:

• Monitoring — we're watching uptime, performance, and availability
• Decisions — we determine when action is safe and relevant
• Waiting — sometimes the right move is no move at all
• Protecting — safety rules are always enforced, without exception

Nothing happens silently.
Every action is visible in your dashboard.
Non-action is always safe.

You can stop thinking about this.

If you ever need changes or have questions, reply to this email. We're here.

—
LaunchBase
Workflows that give you back your life.`
      };

    // ========== FOUNDING CLIENT FOLLOW-UP ==========

    case "preview_followup":
      return {
        subject: "Just checking in — happy to make changes",
        previewText: "Take a look when you have a moment.",
        body: `Hi ${firstName},

Just checking in to see if you had a chance to review your site.

👉 ${previewUrl || "[Preview URL]"}

If you'd like any tweaks or changes, just reply here — happy to adjust anything before launch.

No rush at all.

—
LaunchBase`
      };

    case "testimonial_request":
      return {
        subject: "Quick question (2 minutes)",
        previewText: "Would love your feedback.",
        body: `Hi ${firstName},

Quick question — if LaunchBase saved you time or helped you get online faster, would you be open to sharing a short testimonial?

A sentence or two is perfect. Nothing formal.

It really helps as we open this up to more businesses.

Thanks either way — and let us know if you need anything.

—
LaunchBase`
      };

    case "founding_client_lockin":
      return {
        subject: "You're officially a LaunchBase founding client",
        previewText: "Your pricing is locked in.",
        body: `Hi ${firstName},

Quick note to say thank you.

As we prepare to open LaunchBase publicly, you're officially locked in as a Founding Client.

That means:
• Your pricing never changes
• You keep priority support
• Your feedback continues to shape the platform

We appreciate you trusting us early.

—
LaunchBase`
      };

    // ========== CUSTOMER SUCCESS ==========

    case "day7_checkin":
      return {
        subject: "Everything looking good?",
        previewText: "Just checking in on your site.",
        body: `Hi ${firstName},

Just checking in to make sure everything looks good with your site.

If you want any small tweaks or changes, feel free to reply here.

—
LaunchBase`
      };

    case "day30_value":
      return {
        subject: "Quick note from LaunchBase",
        previewText: "Your subscription covers hosting, updates, and support.",
        body: `Hi ${firstName},

Just a quick note — your LaunchBase subscription covers hosting, updates, and ongoing support for your site.

If you ever need changes or improvements, just reply here.

Thanks again for trusting us.

—
LaunchBase`
      };

    case "contact_form_confirmation":
      return {
        subject: "We received your message 👍",
        previewText: "Thanks for reaching out — we'll get back to you within 24 hours.",
        body: `Hi ${firstName},

Thanks for reaching out to ${businessName}.

We've received your message and will get back to you within 24 hours.

If this is urgent, you can reply directly to this email.

—
${businessName}`
      };

    default:
      return {
        subject: "Update from LaunchBase",
        previewText: "You have a message from LaunchBase.",
        body: `Hi ${legacyData.firstName},

Thank you for using LaunchBase.

—
LaunchBase`
      };
  }
}

// Send email and log it
// Send email with explicit provider logging (FOREVER FIX)
export async function sendEmail(
  intakeId: number,
  type: EmailType,
  data: EmailData
): Promise<{ ok: boolean; provider: "resend" | "notification"; error?: string; warning?: string }> {
  const template = getEmailTemplate(type, data);
  const recipientEmail = data.email;
  const subject = template.subject;
  
  // Derive tenant: priority order = intake.tenant > email domain > fallback
  const { getIntakeById } = await import("./db");
  const { deriveTenantFromEmail } = await import("./_core/tenant");
  const intake = await getIntakeById(intakeId);
  const tenant = intake?.tenant ?? deriveTenantFromEmail(recipientEmail);
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${template.body.split('\n').map((line: string) => 
        line.startsWith('•') 
          ? `<p style="margin: 8px 0; padding-left: 16px;">${line}</p>`
          : line === '' 
            ? '<br/>'
            : `<p style="margin: 16px 0; line-height: 1.6;">${line}</p>`
      ).join('')}
    </div>
  `;

  const db = await getDb();
  if (!db) {
    console.error("[Email] Database not available");
    return { ok: false, provider: "notification", error: "db_unavailable" };
  }

  // ---- Attempt 1: Resend ----
  let resendErrorMsg: string | null = null;

  try {
    if (!ENV.resendApiKey) throw new Error("RESEND_API_KEY missing");

    const resend = new Resend(ENV.resendApiKey);

    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject,
      html,
      text: template.body,
      replyTo: REPLY_TO_EMAIL,
      // Idempotency key prevents duplicate sends (Stripe pattern)
      headers: {
        "X-Entity-Ref-ID": `email/${type}/intake/${intakeId}`,
      },
    });

    // Some SDK versions return { error }, some throw. Handle both.
    if ((r as any)?.error) throw (r as any).error;

    // SUCCESS: Log with provider="resend"
    await db.insert(emailLogs).values({
      intakeId,
      tenant,
      emailType: type,
      recipientEmail,
      subject,
      status: "sent",
      deliveryProvider: "resend",
      errorMessage: null,
    });

    console.log(`[Email] ✅ Sent via Resend: ${type} to ${recipientEmail}`);

    // Additional owner notification for important events
    if (type === "intake_confirmation") {
      await notifyOwner({
        title: `🎉 New intake: ${data.businessName}`,
        content: `${data.firstName} (${recipientEmail}) just completed an intake for ${data.businessName}. Ready for build plan generation.`,
      });
    }

    return { ok: true, provider: "resend" };
  } catch (err) {
    const norm = normalizeResendError(err);
    resendErrorMsg = `resend_failed${norm.status ? `_${norm.status}` : ""}: ${norm.message}`;

    // IMPORTANT: Log the failure as FAILED (do not pretend "sent")
    await db.insert(emailLogs).values({
      intakeId,
      tenant,
      emailType: type,
      recipientEmail,
      subject,
      status: "failed",
      deliveryProvider: "resend",
      errorMessage: resendErrorMsg,
    });

    console.error("[Email] ❌ Resend failed:", norm);
  }

  // ---- Attempt 2: Fallback notification ----
  try {
    const emailContent = `
**To:** ${recipientEmail}
**Subject:** ${subject}

---

${template.body}
    `.trim();

    await notifyOwner({
      title: `📧 ${subject}`,
      content: emailContent,
    });

    // Log fallback success with provider="notification"
    await db.insert(emailLogs).values({
      intakeId,
      tenant,
      emailType: type,
      recipientEmail,
      subject,
      status: "sent",
      deliveryProvider: "notification",
      errorMessage: resendErrorMsg, // Keep the causal chain
    });

    console.log(`[Email] ✅ Sent via notification (fallback): ${type} to ${recipientEmail}`);

    // Additional owner notification for important events
    if (type === "intake_confirmation") {
      await notifyOwner({
        title: `🎉 New intake: ${data.businessName}`,
        content: `${data.firstName} (${recipientEmail}) just completed an intake for ${data.businessName}. Ready for build plan generation.`,
      });
    }

    return {
      ok: true,
      provider: "notification",
      warning: resendErrorMsg ?? "resend_failed",
    };
  } catch (fallbackErr) {
    const f = normalizeResendError(fallbackErr);
    const fallbackMsg = `notification_failed${f.status ? `_${f.status}` : ""}: ${f.message}`;

    // Log complete failure
    await db.insert(emailLogs).values({
      intakeId,
      tenant,
      emailType: type,
      recipientEmail,
      subject,
      status: "failed",
      deliveryProvider: "notification",
      errorMessage: [resendErrorMsg, fallbackMsg].filter(Boolean).join(" | "),
    });

    console.error("[Email] ❌ Notification fallback also failed:", f);

    return {
      ok: false,
      provider: "notification",
      error: [resendErrorMsg, fallbackMsg].filter(Boolean).join(" | "),
    };
  }
}

// Send admin notification
export async function sendAdminNotification(
  title: string,
  content: string
): Promise<boolean> {
  try {
    await notifyOwner({ title, content });
    return true;
  } catch (error) {
    console.error("[Admin Notification] Failed:", error);
    return false;
  }
}

// Admin notification helpers
export const AdminNotifications = {
  newIntake: (businessName: string, confidence: number) => 
    sendAdminNotification(
      "New intake received",
      `${businessName} — ready for build plan generation. Confidence: ${confidence}%`
    ),
  
  lowConfidence: (businessName: string, confidence: number) =>
    sendAdminNotification(
      "Intake requires clarification",
      `${businessName} has low confidence (${confidence}%). Review before building.`
    ),
  
  siteApproved: (businessName: string) =>
    sendAdminNotification(
      "Site approved",
      `${businessName} approved their site. Ready to deploy.`
    ),
  
  deploymentComplete: (businessName: string, url: string) =>
    sendAdminNotification(
      "Site deployed",
      `${businessName} is now live at ${url}`
    ),
};

/**
 * Send action request email (Ask → Understand → Apply → Confirm loop)
 * Hybrid format: buttons + reply-to
 */
export async function sendActionRequestEmail(data: {
  to: string;
  businessName: string;
  firstName: string;
  questionText: string;
  proposedValue: string;
  token: string;
  checklistKey: string;
  proposedPreviewToken?: string;
}): Promise<{ success: boolean; provider?: "resend" | "notification"; error?: string }> {
  const resend = getResendClient();
  
  const approveUrl = `${ENV.publicBaseUrl}/api/actions/${data.token}/approve`;
  const editUrl = `${ENV.publicBaseUrl}/api/actions/${data.token}/edit`;
  
  // Tokenized reply-to for inbound parsing
  const replyTo = `approvals+${data.token}@getlaunchbase.com`;
  
  const subject = `[LB:${data.token}] ${data.questionText}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.questionText}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 16px 0;
      color: #111827;
    }
    .proposed {
      background: #f3f4f6;
      border-left: 4px solid #ea580c;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .proposed-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .proposed-value {
      font-size: 18px;
      font-weight: 500;
      color: #111827;
    }
    .buttons {
      display: flex;
      gap: 12px;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      text-align: center;
      flex: 1;
    }
    .btn-approve {
      background: #16a34a;
      color: white;
    }
    .btn-preview {
      background: #3b82f6;
    }
      background: #ea580c;
      color: white;
    }
    .or-reply {
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      margin: 24px 0;
    }
    .reply-instructions {
      background: #fef3c7;
      border: 1px solid #fbbf24;
      padding: 16px;
      border-radius: 6px;
      font-size: 14px;
      color: #92400e;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${data.questionText}</h1>
    
    <p>Hi ${data.firstName},</p>
    
    <p>We've drafted this for ${data.businessName}:</p>
    
    <div class="proposed">
      <div class="proposed-label">We proposed:</div>
      <div class="proposed-value">${data.proposedValue}</div>
    </div>
    
    <div class="buttons">
      ${data.proposedPreviewToken ? `<a href="${ENV.publicBaseUrl}/preview/proposed/${data.proposedPreviewToken}" class="btn btn-preview">👁️ View Proposed Preview</a>` : ""}
      <a href="${approveUrl}" class="btn btn-approve">✅ Approve</a>
      <a href="${editUrl}" class="btn btn-edit">✏️ Edit</a>
    </div>
    
    <div class="or-reply">— OR —</div>
    
    <div class="reply-instructions">
      <strong>Reply to this email:</strong><br>
      • Type <strong>YES</strong> to approve<br>
      • Type your preferred version to edit<br>
      • Type <strong>NO</strong> if you want something different
    </div>
    
    <div class="footer">
      <p>This is part of your LaunchBase build process. Nothing goes live until you approve it.</p>
      <p>Questions? Reply to this email or contact support@getlaunchbase.com</p>
      <p style="font-size: 11px; color: #9ca3af; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
        Diagnostics: Token ...${data.token.slice(-6)} | Key: ${data.checklistKey} | Env: ${ENV.publicBaseUrl?.includes('localhost') ? 'dev' : 'prod'}
      </p>
    </div>
  </div>
</body>
</html>
  `;
  
  console.log("[Email] sendActionRequestEmail called");
  console.log("[Email] - To:", data.to);
  console.log("[Email] - Resend client exists:", !!resend);
  console.log("[Email] - ENV.resendApiKey exists:", !!ENV.resendApiKey);
  console.log("[Email] - ENV.resendApiKey length:", ENV.resendApiKey?.length || 0);
  
  const text = `
${data.questionText}

Hi ${data.firstName},

We've drafted this for ${data.businessName}:

${data.proposedValue}

${data.proposedPreviewToken ? `View proposed preview: ${ENV.publicBaseUrl}/preview/proposed/${data.proposedPreviewToken}

` : ""}
To approve: ${approveUrl}
To edit: ${editUrl}

Or reply to this email:
• Type YES to approve
• Type your preferred version to edit
• Type NO if you want something different

Questions? Reply to this email or contact support@getlaunchbase.com

Diagnostics: Token ...${data.token.slice(-6)} | Key: ${data.checklistKey}
  `.trim();
  
  try {
    if (resend) {
      console.log("[Email] Calling resend.emails.send()...");
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: data.to,
        replyTo: replyTo,
        subject,
        html,
        text,
      });
      
      console.log("[Email] ✅ Resend API call succeeded:", result);
      
      // Return Resend message ID for event logging
      return { 
        success: true, 
        provider: "resend",
        resendMessageId: result.id 
      };
    } else {
      // Fallback to notification
      console.log("[Email] ⚠️ No Resend client - falling back to notification");
      await notifyOwner({
        title: `Action Request: ${data.questionText}`,
        content: `To: ${data.to}\nProposed: ${data.proposedValue}\n\nApprove: ${approveUrl}\nEdit: ${editUrl}`
      });
      
      return { success: false, provider: "notification", error: "no_resend_client" };
    }
  } catch (err) {
    const normalized = normalizeResendError(err);
    console.error("[Email] Failed to send action request:", normalized);
    
    // TODO: Log failed email
    
    return { success: false, error: normalized.message };
  }
}

/**
 * Send confirmation email after action is applied
 */
export async function sendActionConfirmationEmail(data: {
  to: string;
  businessName: string;
  firstName: string;
  checklistKey: string;
  proposedPreviewToken?: string;
  appliedValue: string;
  previewUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResendClient();
  
  const subject = `✅ Applied: ${data.checklistKey}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Change Applied</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 16px 0;
      color: #16a34a;
    }
    .applied {
      background: #dcfce7;
      border-left: 4px solid #16a34a;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .applied-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #166534;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .applied-value {
      font-size: 18px;
      font-weight: 500;
      color: #111827;
    }
    .btn {
      display: inline-block;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      text-align: center;
      background: #ea580c;
      color: white;
      margin-top: 24px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✅ Change Applied</h1>
    
    <p>Hi ${data.firstName},</p>
    
    <p>We've updated ${data.businessName}:</p>
    
    <div class="applied">
      <div class="applied-label">${data.checklistKey} is now:</div>
      <div class="applied-value">${data.appliedValue}</div>
    </div>
    
    ${data.previewUrl ? `<a href="${data.previewUrl}" class="btn">View Preview</a>` : ''}
    
    <div class="footer">
      <p>You'll hear from us when the next item needs your approval.</p>
      <p>Questions? Reply to this email or contact support@getlaunchbase.com</p>
    </div>
  </div>
</body>
</html>
  `;
  
  const text = `
✅ Change Applied

Hi ${data.firstName},

We've updated ${data.businessName}:

${data.checklistKey} is now: ${data.appliedValue}

${data.previewUrl ? `View preview: ${data.previewUrl}` : ''}

You'll hear from us when the next item needs your approval.

Questions? Reply to this email or contact support@getlaunchbase.com
  `.trim();
  
  try {
    if (resend) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: data.to,
        replyTo: REPLY_TO_EMAIL,
        subject,
        html,
        text,
      });
      
      // TODO: Log email to emailLogs table
      
      return { success: true };
    } else {
      await notifyOwner({
        title: `Action Confirmed: ${data.checklistKey}`,
        content: `To: ${data.to}\nApplied: ${data.appliedValue}`
      });
      
      return { success: true };
    }
  } catch (err) {
    const normalized = normalizeResendError(err);
    console.error("[Email] Failed to send confirmation:", normalized);
    
    // TODO: Log failed email
    
    return { success: false, error: normalized.message };
  }
}
