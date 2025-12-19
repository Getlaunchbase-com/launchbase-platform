/**
 * LaunchBase Email Service
 * Production-ready email templates for the post-intake sequence
 */

import { getDb } from "./db";
import { emailLogs } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";

// Email template types
export type EmailType = 
  | "intake_confirmation"
  | "in_progress"
  | "ready_for_review"
  | "review_nudge"
  | "launch_confirmation"
  | "preview_followup"
  | "testimonial_request"
  | "founding_client_lockin"
  | "day7_checkin"
  | "day30_value";

interface EmailData {
  firstName: string;
  businessName: string;
  email: string;
  previewUrl?: string;
  liveUrl?: string;
  checkoutLink?: string;
}

interface EmailTemplate {
  subject: string;
  previewText: string;
  body: string;
}

// Generate email templates based on type and data
export function getEmailTemplate(type: EmailType, data: EmailData): EmailTemplate {
  const { firstName, businessName, previewUrl, liveUrl } = data;
  
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
        subject: "🚀 Your website is ready to review",
        previewText: "Take a look and let us know what you think.",
        body: `Hi ${firstName},

Your website is ready to review 🎉

👉 Preview your site:
${previewUrl || "[Preview URL]"}

Take a look and let us know:
• 👍 If you're happy and ready to launch
• ✏️ Or if you'd like any changes

Nothing goes live until you approve it.

If you have feedback, just reply to this email — a real person will take care of it.

—
LaunchBase`
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

    case "launch_confirmation":
      return {
        subject: "🎉 Your site is live!",
        previewText: "Welcome to LaunchBase.",
        body: `Hi ${firstName},

Your website is officially live 🎉

👉 View your site:
${liveUrl || "[Live URL]"}

From here:
• You can share it with customers
• Start sending traffic
• Request updates anytime

Thanks for trusting LaunchBase with your launch. We're excited to support you going forward.

—
LaunchBase`
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

    default:
      return {
        subject: "Update from LaunchBase",
        previewText: "You have a message from LaunchBase.",
        body: `Hi ${firstName},

Thank you for using LaunchBase.

—
LaunchBase`
      };
  }
}

// Send email and log it
export async function sendEmail(
  intakeId: number,
  type: EmailType,
  data: EmailData
): Promise<boolean> {
  const template = getEmailTemplate(type, data);
  
  try {
    // Log the email attempt
    const db = await getDb();
    if (!db) {
      console.error("[Email] Database not available");
      return false;
    }
    await db.insert(emailLogs).values({
      intakeId,
      emailType: type,
      recipientEmail: data.email,
      subject: template.subject,
      status: "sent",
    });

    // In production, integrate with SendGrid/Postmark/Resend here
    // For now, we'll use the built-in notification system to notify the owner
    // and log the email for tracking
    
    console.log(`[Email] Sent ${type} to ${data.email}`);
    console.log(`[Email] Subject: ${template.subject}`);
    
    // Notify owner about the email being sent (for monitoring)
    if (type === "intake_confirmation") {
      await notifyOwner({
        title: `New intake: ${data.businessName}`,
        content: `${data.firstName} (${data.email}) just completed an intake for ${data.businessName}. Ready for build plan generation.`,
      });
    }
    
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send ${type} to ${data.email}:`, error);
    
    // Log the failure
    const dbFail = await getDb();
    if (dbFail) {
      await dbFail.insert(emailLogs).values({
        intakeId,
        emailType: type,
        recipientEmail: data.email,
        subject: template.subject,
        status: "failed",
      });
    }
    
    return false;
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
