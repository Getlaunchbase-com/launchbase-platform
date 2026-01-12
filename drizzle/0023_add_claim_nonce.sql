-- Add claim_nonce column for precision-proof ownership guard
-- Replaces timestamp-equality guard which fails due to MySQL/TiDB timestamp rounding

ALTER TABLE `idempotency_keys`
  ADD COLUMN `claim_nonce` varchar(40) NULL AFTER `key_hash`;

CREATE INDEX `idempotency_keys_claim_nonce_idx`
  ON `idempotency_keys` (`tenant`, `scope`, `key_hash`, `claim_nonce`);
