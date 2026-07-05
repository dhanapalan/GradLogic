-- Add is_active flags for Super Admin deactivate/activate pattern
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active) WHERE deleted_at IS NULL;
