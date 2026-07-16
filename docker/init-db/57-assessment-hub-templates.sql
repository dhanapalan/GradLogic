-- Assessment Hub Templates: reusable blueprint config on assessment_rule_templates
ALTER TABLE assessment_rule_templates
  ADD COLUMN IF NOT EXISTS hub_template_config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_art_hub_template_config
  ON assessment_rule_templates USING GIN (hub_template_config);
