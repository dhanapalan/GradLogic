-- =============================================================================
-- 29-auth-rbac.sql
-- Authentication hardening + full RBAC foundation.
--  * Reconciles users columns used by the auth flows (drift with Prisma).
--  * Adds refresh_tokens table (rotation + reuse detection).
--  * Adds 2FA + password-reset columns.
--  * Expands the permission catalog and grants permissions per role.
-- Idempotent: safe to run repeatedly and on fresh volumes.
-- Must run AFTER 13-phase2-admin-schema.sql (roles/permissions/role_permissions).
-- =============================================================================

-- ── 1. users: auth/security columns ──────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_type VARCHAR(40) NOT NULL DEFAULT 'Email_Password';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_temp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- ── 2. refresh_tokens: rotating opaque tokens (stored hashed) ─────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,                 -- sha256 hex of the raw token
  family_id    UUID NOT NULL,                 -- rotation family (reuse detection)
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  replaced_by  UUID,                          -- id of the token that rotated this one
  user_agent   TEXT,
  ip_address   VARCHAR(64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user     ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash     ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family   ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires  ON refresh_tokens(expires_at);

-- ── 3. Expand the permission catalog ─────────────────────────────────────────
INSERT INTO permissions (name, description, category)
SELECT v.name, v.description, v.category
FROM (VALUES
  ('dashboard_view',       'View dashboards',                 'general'),
  ('users_view',           'View users',                      'users'),
  ('users_manage',         'Create, update, delete users',    'users'),
  ('users_reset_password', 'Reset user passwords',            'users'),
  ('users_assign_role',    'Assign roles to users',           'users'),
  ('roles_view',           'View roles',                      'roles'),
  ('roles_manage',         'Create, update, delete roles',    'roles'),
  ('permissions_view',     'View permission matrix',          'roles'),
  ('permissions_manage',   'Manage role permissions',         'roles'),
  ('colleges_view',        'View colleges',                   'colleges'),
  ('colleges_manage',      'Manage colleges',                 'colleges'),
  ('modules_view',         'View feature modules',            'modules'),
  ('modules_manage',       'Manage feature modules',          'modules'),
  ('students_view',        'View students',                   'students'),
  ('students_manage',      'Manage students',                 'students'),
  ('assessments_view',     'View assessments',                'assessments'),
  ('assessments_manage',   'Manage assessments',              'assessments'),
  ('workflows_view',       'View workflows',                  'workflows'),
  ('workflows_manage',     'Manage workflows',                'workflows'),
  ('analytics_view',       'View analytics dashboards',       'analytics'),
  ('audit_view',           'View audit trail',                'audit'),
  ('audit_export',         'Export audit logs',               'audit'),
  ('settings_view',        'View settings',                   'settings'),
  ('settings_manage',      'Manage settings',                 'settings'),
  ('billing_view',         'View billing',                    'billing'),
  ('billing_manage',       'Manage billing',                  'billing'),
  ('notifications_view',   'View notifications',              'notifications'),
  ('notifications_manage', 'Send notifications',              'notifications')
) AS v(name, description, category)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name AND p.deleted_at IS NULL);

-- Ensure the college_admin / tpo / mentor / student roles exist (13 seeds them,
-- but guard here so this migration is self-contained on partial DBs).
INSERT INTO roles (name, description, is_system)
SELECT v.name, v.description, true
FROM (VALUES
  ('super_admin',   'Full platform administration'),
  ('college_admin', 'College administration'),
  ('tpo',           'Training & Placement Officer'),
  ('mentor',        'Mentor / trainer'),
  ('student',       'Student')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = v.name AND r.deleted_at IS NULL);

-- ── 4. Grant permissions per role ────────────────────────────────────────────
-- super_admin: everything.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'super_admin' AND r.deleted_at IS NULL AND p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- college_admin + tpo: scoped campus management.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.name = ANY (ARRAY[
  'dashboard_view','students_view','students_manage',
  'assessments_view','assessments_manage','analytics_view',
  'modules_view','settings_view','notifications_view','notifications_manage'
])
WHERE r.name IN ('college_admin','tpo') AND r.deleted_at IS NULL AND p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- mentor: read-focused.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.name = ANY (ARRAY[
  'dashboard_view','students_view','assessments_view','analytics_view'
])
WHERE r.name = 'mentor' AND r.deleted_at IS NULL AND p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- student: personal access only.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.name = ANY (ARRAY['dashboard_view'])
WHERE r.name = 'student' AND r.deleted_at IS NULL AND p.deleted_at IS NULL
ON CONFLICT DO NOTHING;
