/**
 * Facebook Posting Policy
 *
 * Real rate-limit and policy enforcement for Facebook posts:
 * - Max 3 posts per day per page
 * - No posting between 11pm-6am
 * - Confidence-based gating for automated posts
 * - Mode-based rules (auto vs guided vs manual)
 */

// Rate limit tracking (in-memory; in production use Redis or DB)
const dailyPostCounts = new Map<string, { date: string; count: number }>();

// ---------------------------------------------------------------------------
// checkFacebookPostingPolicy
// ---------------------------------------------------------------------------

export function checkFacebookPostingPolicy(input: {
  customerId: string;
  pageId: string;
  mode: string;
  postType: string;
  confidence: number | null;
  now: Date;
}): {
  allowed: boolean;
  action: string;
  reasons: string[];
  retryAt?: Date;
} {
  const { customerId, pageId, mode, postType, confidence, now } = input;
  const reasons: string[] = [];

  // 0. Check if mode is blocked
  if (mode === "suspended" || mode === "disabled") {
    reasons.push(`Account mode "${mode}" is not allowed to post`);
    return { allowed: false, action: "BLOCK", reasons };
  }

  // 1. Quiet hours check: no posting between 11pm - 6am
  const hour = now.getHours();
  if (hour >= 23 || hour < 6) {
    const retryAt = new Date(now);
    if (hour >= 23) {
      retryAt.setDate(retryAt.getDate() + 1);
    }
    retryAt.setHours(6, 0, 0, 0);

    reasons.push(
      `Quiet hours: posting is not allowed between 11:00 PM and 6:00 AM. Next available: ${retryAt.toLocaleTimeString()}`,
    );

    return {
      allowed: false,
      action: "DEFER",
      reasons,
      retryAt,
    };
  }

  // 2. Rate limit: max 3 posts per day per page
  const dateStr = now.toISOString().split("T")[0];
  const dateKey = `${pageId}:${dateStr}`;
  const rateEntry = dailyPostCounts.get(dateKey);
  const currentCount = rateEntry?.date === dateStr ? rateEntry.count : 0;

  if (currentCount >= 3) {
    const retryAt = new Date(now);
    retryAt.setDate(retryAt.getDate() + 1);
    retryAt.setHours(6, 0, 0, 0);

    reasons.push(
      `Daily limit reached: ${currentCount}/3 posts today for this page. Resets tomorrow at 6:00 AM.`,
    );

    return {
      allowed: false,
      action: "DEFER",
      reasons,
      retryAt,
    };
  }

  // 3. Confidence check for automated posts
  if (mode === "auto" && confidence !== null) {
    if (confidence < 0.5) {
      reasons.push(
        `Low confidence (${(confidence * 100).toFixed(0)}%) - auto-post requires at least 50% confidence. Routing for human review.`,
      );
      return { allowed: false, action: "NEEDS_REVIEW", reasons };
    }

    if (confidence < 0.75) {
      reasons.push(
        `Medium confidence (${(confidence * 100).toFixed(0)}%) - post will be queued for approval.`,
      );
      return { allowed: false, action: "NEEDS_APPROVAL", reasons };
    }
  }

  // 4. Guided mode: always requires approval (except manual posts)
  if (mode === "guided" && postType !== "MANUAL" && postType !== "OTHER") {
    reasons.push(
      "Guided mode: all automated posts require customer approval before publishing.",
    );
    return { allowed: false, action: "NEEDS_APPROVAL", reasons };
  }

  // 5. Storm alert safety check
  if (postType === "ACTIVE_STORM" && mode === "auto") {
    if (confidence === null || confidence < 0.85) {
      reasons.push(
        "Storm alerts in auto mode require elevated confidence (85%+) or manual approval for safety.",
      );
      return { allowed: false, action: "NEEDS_APPROVAL", reasons };
    }
  }

  // All checks passed - increment rate counter and allow
  dailyPostCounts.set(dateKey, {
    date: dateStr,
    count: currentCount + 1,
  });

  return {
    allowed: true,
    action: "POST",
    reasons: [`Post approved. Daily count: ${currentCount + 1}/3.`],
  };
}
