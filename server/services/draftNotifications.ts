/**
 * Draft Notification Service
 * Sends notifications to owner when drafts are created, approved, or held
 */

import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { socialPosts, decisionLogs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

interface DraftNotificationData {
  draftId: number;
  content: string;
  postType?: string | null;
  whyWeWroteThis?: string | null;
  reasonChips?: string[] | null;
}

interface ApprovalNotificationData {
  draftId: number;
  content: string;
  status: "published" | "held";
  externalId?: string | null;
  reason?: string | null;
}

/**
 * Notify owner when a new draft is created and needs review
 */
export async function notifyDraftCreated(data: DraftNotificationData): Promise<boolean> {
  const { draftId, content, postType, whyWeWroteThis, reasonChips } = data;

  const title = `📝 New Draft Needs Review (#${draftId})`;
  
  let notificationContent = `**Draft Content:**
${content}

---

**Post Type:** ${postType || "General"}`;

  if (whyWeWroteThis) {
    notificationContent += `

**Why We Wrote This:**
${whyWeWroteThis}`;
  }

  if (reasonChips && reasonChips.length > 0) {
    notificationContent += `

**Reason Tags:** ${reasonChips.join(", ")}`;
  }

  notificationContent += `

---

**Action Required:** Review and approve this draft at /admin/drafts`;

  try {
    return await notifyOwner({ title, content: notificationContent });
  } catch (error) {
    console.error("[DraftNotification] Failed to notify on draft created:", error);
    return false;
  }
}

/**
 * Notify owner when a draft is approved and published
 */
export async function notifyDraftPublished(data: ApprovalNotificationData): Promise<boolean> {
  const { draftId, content, externalId } = data;

  const title = `✅ Draft Published (#${draftId})`;
  
  const notificationContent = `**Published Content:**
${content}

---

**Facebook Post ID:** ${externalId || "N/A"}

**Status:** Successfully published to Facebook Page`;

  try {
    return await notifyOwner({ title, content: notificationContent });
  } catch (error) {
    console.error("[DraftNotification] Failed to notify on draft published:", error);
    return false;
  }
}

/**
 * Notify owner when a draft is held (safety check triggered)
 */
export async function notifyDraftHeld(data: ApprovalNotificationData): Promise<boolean> {
  const { draftId, content, reason } = data;

  const title = `⏸️ Draft Held (#${draftId})`;
  
  const notificationContent = `**Draft Content:**
${content}

---

**Hold Reason:** ${reason || "Safety check triggered"}

**Status:** Draft was not published due to safety rules.

**Next Steps:** Review the hold reason and decide whether to:
- Wait until conditions are met (e.g., business hours)
- Override and publish manually
- Discard the draft`;

  try {
    return await notifyOwner({ title, content: notificationContent });
  } catch (error) {
    console.error("[DraftNotification] Failed to notify on draft held:", error);
    return false;
  }
}

/**
 * Get draft details and send appropriate notification
 */
export async function notifyOnDraftAction(
  draftId: number,
  action: "created" | "published" | "held",
  additionalData?: { externalId?: string; reason?: string }
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.error("[DraftNotification] Database unavailable");
    return false;
  }

  // Fetch draft details
  const [draft] = await db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.id, draftId))
    .limit(1);

  if (!draft) {
    console.error(`[DraftNotification] Draft ${draftId} not found`);
    return false;
  }

  switch (action) {
    case "created":
      return notifyDraftCreated({
        draftId,
        content: draft.content,
        postType: draft.postType,
        whyWeWroteThis: draft.whyWeWroteThis,
        reasonChips: draft.reasonChips,
      });

    case "published":
      return notifyDraftPublished({
        draftId,
        content: draft.content,
        status: "published",
        externalId: additionalData?.externalId,
      });

    case "held":
      return notifyDraftHeld({
        draftId,
        content: draft.content,
        status: "held",
        reason: additionalData?.reason,
      });

    default:
      return false;
  }
}
