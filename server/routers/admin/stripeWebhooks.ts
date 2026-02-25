/**
 * Stripe webhook handling — requires STRIPE_WEBHOOK_SECRET env variable.
 * Webhook events are processed via Express middleware in server/stripe/.
 */

import { router } from "../../_core/trpc";

export const adminStripeWebhooksRouter = router({});
