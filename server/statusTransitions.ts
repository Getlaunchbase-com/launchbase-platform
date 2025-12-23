/**
 * Status Transition Enforcement
 * 
 * This module enforces valid status transitions for intakes.
 * The state machine ensures customers always see their preview
 * before payment, and payment is required before deployment.
 * 
 * Valid Flow:
 * new → review → ready_for_review → approved → paid → deployed
 *       ↓
 *   needs_info (can return to review)
 * 
 * Key Rules:
 * 1. Cannot skip ready_for_review (this generates previewToken)
 * 2. Cannot skip approved (requires customer clickwrap)
 * 3. Cannot skip paid (requires Stripe webhook)
 * 4. Only Stripe webhook can set "paid" status
 */

export type IntakeStatus = "new" | "review" | "needs_info" | "ready_for_review" | "approved" | "paid" | "deployed";

// Valid transitions from each status
export const VALID_TRANSITIONS: Record<IntakeStatus, IntakeStatus[]> = {
  new: ["review"],
  review: ["needs_info", "ready_for_review"],
  needs_info: ["review", "ready_for_review"],
  ready_for_review: ["approved", "needs_info"], // approved only after customer clickwrap
  approved: ["paid"], // paid only via Stripe webhook
  paid: ["deployed"],
  deployed: [], // terminal state
};

// Transitions that can only be triggered by specific actors
const RESTRICTED_TRANSITIONS: Record<string, { from: IntakeStatus; to: IntakeStatus; actor: "stripe" | "customer" | "system" }[]> = {
  stripe: [
    { from: "approved", to: "paid", actor: "stripe" },
  ],
  customer: [
    { from: "ready_for_review", to: "approved", actor: "customer" },
  ],
};

export interface TransitionResult {
  valid: boolean;
  error?: string;
  requiresPreviewToken?: boolean;
  requiresEmail?: boolean;
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  from: IntakeStatus,
  to: IntakeStatus,
  actor: "admin" | "stripe" | "customer" | "system" = "admin"
): TransitionResult {
  // Check if transition is in valid list
  const validNextStates = VALID_TRANSITIONS[from];
  if (!validNextStates.includes(to)) {
    return {
      valid: false,
      error: `Invalid transition: ${from} → ${to}. Valid next states: ${validNextStates.join(", ") || "none (terminal state)"}`,
    };
  }

  // Check for restricted transitions
  if (to === "paid" && actor !== "stripe") {
    return {
      valid: false,
      error: `Only Stripe webhook can set status to "paid". Current actor: ${actor}`,
    };
  }

  if (from === "ready_for_review" && to === "approved" && actor !== "customer" && actor !== "system") {
    return {
      valid: false,
      error: `Only customer approval (clickwrap) can transition from ready_for_review to approved. Use the customer preview page.`,
    };
  }

  // Determine if this transition requires preview token generation
  const requiresPreviewToken = to === "ready_for_review";
  const requiresEmail = to === "ready_for_review";

  return {
    valid: true,
    requiresPreviewToken,
    requiresEmail,
  };
}

/**
 * Get the valid next statuses for a given current status
 */
export function getValidNextStatuses(currentStatus: IntakeStatus, actor: "admin" | "stripe" | "customer" | "system" = "admin"): IntakeStatus[] {
  const allValid = VALID_TRANSITIONS[currentStatus];
  
  // Filter out restricted transitions based on actor
  return allValid.filter(nextStatus => {
    const result = isValidTransition(currentStatus, nextStatus, actor);
    return result.valid;
  });
}

/**
 * Get a human-readable label for admin UI
 */
export function getNextActionLabel(currentStatus: IntakeStatus): string {
  switch (currentStatus) {
    case "new":
      return "Start Review";
    case "review":
      return "Send Preview";
    case "needs_info":
      return "Resume Review";
    case "ready_for_review":
      return "Awaiting Customer Approval";
    case "approved":
      return "Awaiting Payment";
    case "paid":
      return "Deploy Site";
    case "deployed":
      return "Live";
    default:
      return "Unknown";
  }
}

/**
 * Get the primary action button config for admin UI
 */
export function getAdminActionConfig(currentStatus: IntakeStatus): {
  label: string;
  targetStatus: IntakeStatus | null;
  variant: "default" | "secondary" | "destructive" | "outline";
  disabled: boolean;
  disabledReason?: string;
} {
  switch (currentStatus) {
    case "new":
      return {
        label: "Start Review",
        targetStatus: "review",
        variant: "default",
        disabled: false,
      };
    case "review":
      return {
        label: "Send Preview to Customer",
        targetStatus: "ready_for_review",
        variant: "default",
        disabled: false,
      };
    case "needs_info":
      return {
        label: "Send Preview to Customer",
        targetStatus: "ready_for_review",
        variant: "default",
        disabled: false,
      };
    case "ready_for_review":
      return {
        label: "Awaiting Customer Approval",
        targetStatus: null,
        variant: "secondary",
        disabled: true,
        disabledReason: "Customer must approve via preview link before proceeding",
      };
    case "approved":
      return {
        label: "Awaiting Payment",
        targetStatus: null,
        variant: "secondary",
        disabled: true,
        disabledReason: "Customer must complete payment via Stripe before deployment",
      };
    case "paid":
      return {
        label: "Deploy Site",
        targetStatus: "deployed",
        variant: "default",
        disabled: false,
      };
    case "deployed":
      return {
        label: "Site is Live",
        targetStatus: null,
        variant: "outline",
        disabled: true,
      };
    default:
      return {
        label: "Unknown Status",
        targetStatus: null,
        variant: "outline",
        disabled: true,
      };
  }
}

/**
 * Validate that an intake has the required data for a transition
 */
export function validateTransitionRequirements(
  intake: { previewToken?: string | null; paidAt?: Date | null; stripePaymentIntentId?: string | null },
  from: IntakeStatus,
  to: IntakeStatus
): { valid: boolean; error?: string } {
  // Transitioning to approved requires previewToken to exist
  if (to === "approved" && !intake.previewToken) {
    return {
      valid: false,
      error: "Cannot approve: no preview token exists. Customer must receive preview first.",
    };
  }

  // Transitioning to deployed requires payment
  if (to === "deployed" && !intake.paidAt && !intake.stripePaymentIntentId) {
    return {
      valid: false,
      error: "Cannot deploy: payment not recorded. Customer must complete payment first.",
    };
  }

  return { valid: true };
}
