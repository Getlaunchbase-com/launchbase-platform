-- Add language column to suite_applications
ALTER TABLE suite_applications ADD COLUMN IF NOT EXISTS language ENUM('en', 'es', 'pl') NOT NULL DEFAULT 'en';

-- Add vertical column to suite_applications
ALTER TABLE suite_applications ADD COLUMN IF NOT EXISTS vertical ENUM('trades', 'health', 'beauty', 'food', 'cannabis', 'professional', 'fitness', 'automotive');

-- Add industry column to suite_applications
ALTER TABLE suite_applications ADD COLUMN IF NOT EXISTS industry VARCHAR(64);

-- Make businessType nullable (legacy field)
ALTER TABLE suite_applications MODIFY COLUMN businessType ENUM('TRADES', 'FOOD', 'RETAIL', 'PRO', 'OTHER') NULL;
