ALTER TABLE `intakes`
  ADD COLUMN `language` ENUM('en','es','pl') NOT NULL DEFAULT 'en' AFTER `email`,
  ADD COLUMN `audience` ENUM('biz','org') NULL AFTER `language`;
