-- Add Stripe webhook idempotency column and unique index to intakes table
-- This prevents duplicate payment processing when Stripe retries webhooks

ALTER TABLE intakes
  ADD COLUMN stripeSessionId VARCHAR(255) NULL;

CREATE UNIQUE INDEX uniq_intakes_stripeSessionId
  ON intakes (stripeSessionId);
