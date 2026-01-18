-- Add tier and enginesSelected columns to intakes table
-- Migration for CI database schema sync

ALTER TABLE `intakes`
  ADD COLUMN `tier` enum('standard','growth','premium') AFTER `vertical`,
  ADD COLUMN `enginesSelected` json AFTER `tier`;
