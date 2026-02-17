/**
 * Status Transitions — State Machine
 *
 * Defines valid intake status transitions and enforces role-based access.
 *
 * Valid transitions:
 *   new -> review
 *   review -> needs_info, ready_for_review
 *   needs_info -> review
 *   ready_for_review -> approved
 *   approved -> paid
 *   paid -> deployed
 *
 * Admin can transition to any status.
 */

// ---------------------------------------------------------------------------
// Transition map
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ["review"],
  review: ["needs_info", "ready_for_review"],
  needs_info: ["review"],
  ready_for_review: ["approved"],
  approved: ["paid"],
  paid: ["deployed"],
  deployed: [], // terminal state for normal users
};

// All valid status values
const ALL_STATUSES = [
  "new",
  "review",
  "needs_info",
  "ready_for_review",
  "approved",
  "paid",
  "deployed",
];

// ---------------------------------------------------------------------------
// isValidTransition
// ---------------------------------------------------------------------------

export function isValidTransition(
  from: string,
  to: string,
  role?: string,
): { valid: boolean; error?: string } {
  // Validate that both statuses exist
  if (!ALL_STATUSES.includes(from)) {
    return { valid: false, error: `Unknown source status: "${from}"` };
  }
  if (!ALL_STATUSES.includes(to)) {
    return { valid: false, error: `Unknown target status: "${to}"` };
  }

  // Same status is a no-op, allow it
  if (from === to) {
    return { valid: true };
  }

  // Admin can transition to any status
  if (role === "admin") {
    return { valid: true };
  }

  // Check the transition map
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    return {
      valid: false,
      error: `Cannot transition from "${from}" to "${to}". Allowed transitions from "${from}": ${allowed?.length ? allowed.join(", ") : "none"}`,
    };
  }

  return { valid: true };
}
