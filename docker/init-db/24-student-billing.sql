-- =============================================================================
-- Per-Student Billing: ₹500 per student per academic year
-- Mirrors prisma/migrations/20260703_student_billing/migration.sql — prisma
-- migrate never runs in prod (P3005 baseline mismatch), so the table must be
-- created here for deploy.sh to apply it. Backs /api/superadmin/metrics/live,
-- /api/superadmin/metrics/dashboard and the billing pages.
-- =============================================================================

CREATE TABLE IF NOT EXISTS student_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    department VARCHAR(150),
    academic_year VARCHAR(9) NOT NULL,                 -- e.g. '2026-27'
    amount NUMERIC(10,2) NOT NULL DEFAULT 500.00,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',     -- pending | paid | waived
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(50),                        -- cash | upi | card | bank_transfer
    payment_ref VARCHAR(100),
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_student_academic_year UNIQUE (student_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_student_payments_college ON student_payments(college_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_student_payments_status ON student_payments(status);
CREATE INDEX IF NOT EXISTS idx_student_payments_department ON student_payments(college_id, department);
