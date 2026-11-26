-- AdmitPilot AI: Comprehensive Multi-Tenant Database Schema with Supabase RLS
-- Migration: 001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('org_admin', 'manager', 'consultant', 'reviewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Candidates
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    assigned_consultant_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'on_hold')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Candidate Personal Details
CREATE TABLE IF NOT EXISTS candidate_personal_details (
    candidate_id UUID PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    legal_given_name VARCHAR(150) NOT NULL,
    middle_name VARCHAR(150),
    family_name VARCHAR(150) NOT NULL,
    preferred_name VARCHAR(150),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(50),
    nationality VARCHAR(100) NOT NULL,
    country_of_birth VARCHAR(100),
    city_of_birth VARCHAR(100),
    marital_status VARCHAR(50),
    national_id VARCHAR(100),
    citizenships TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Candidate Contacts
CREATE TABLE IF NOT EXISTS candidate_contacts (
    candidate_id UUID PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    alt_email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    alt_phone VARCHAR(50),
    whatsapp VARCHAR(50),
    current_address TEXT NOT NULL,
    permanent_address TEXT,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(50) NOT NULL,
    country VARCHAR(100) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Candidate Passports
CREATE TABLE IF NOT EXISTS candidate_passports (
    candidate_id UUID PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    passport_number VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    nationality VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    issuing_country VARCHAR(100) NOT NULL,
    place_of_issue VARCHAR(100),
    issue_date DATE,
    expiry_date DATE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Candidate Education
CREATE TABLE IF NOT EXISTS candidate_education (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    qualification_level VARCHAR(50) NOT NULL,
    degree_title VARCHAR(255) NOT NULL,
    major VARCHAR(255) NOT NULL,
    institution VARCHAR(255) NOT NULL,
    campus VARCHAR(255),
    country VARCHAR(100) NOT NULL,
    start_date DATE,
    end_date DATE,
    award_date DATE,
    gpa VARCHAR(50),
    grading_scale VARCHAR(50),
    percentage VARCHAR(50),
    obtained_marks VARCHAR(50),
    total_marks VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Candidate Language Tests
CREATE TABLE IF NOT EXISTS candidate_language_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    test_type VARCHAR(50) NOT NULL,
    test_date DATE NOT NULL,
    reference_number VARCHAR(100),
    overall_score VARCHAR(50) NOT NULL,
    listening VARCHAR(50),
    reading VARCHAR(50),
    writing VARCHAR(50),
    speaking VARCHAR(50),
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Candidate Employment
CREATE TABLE IF NOT EXISTS candidate_employment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    company VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    employment_type VARCHAR(50) DEFAULT 'Full-time',
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    responsibilities TEXT,
    location VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Candidate Documents (stored in private Supabase bucket 'candidate-documents')
CREATE TABLE IF NOT EXISTS candidate_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    extracted_text TEXT,
    extracted_fields JSONB DEFAULT '{}'::jsonb,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Candidate Field Evidence & Auditing
CREATE TABLE IF NOT EXISTS candidate_field_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    source_document_id UUID REFERENCES candidate_documents(id) ON DELETE SET NULL,
    page_number INT,
    snippet TEXT,
    confidence NUMERIC(4,3) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'extracted',
    verified_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Candidate Field Conflicts
CREATE TABLE IF NOT EXISTS candidate_field_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    value_a TEXT NOT NULL,
    source_a TEXT NOT NULL,
    value_b TEXT NOT NULL,
    source_b TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_value TEXT,
    resolved_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Applications
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    assigned_consultant_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    institution_name VARCHAR(255) NOT NULL,
    program_name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    intake VARCHAR(100),
    portal_url TEXT,
    reference_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft', 'preparing_documents', 'ready_for_review', 'in_progress',
        'submitted', 'under_review', 'conditional_offer', 'unconditional_offer',
        'rejected', 'withdrawn', 'enrolled'
    )),
    deadline DATE,
    submission_date DATE,
    notes TEXT,
    readiness_report JSONB,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Application Field Mappings History
CREATE TABLE IF NOT EXISTS application_field_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    field_id VARCHAR(100) NOT NULL,
    field_label VARCHAR(255) NOT NULL,
    candidate_field_key VARCHAR(100),
    filled_value TEXT,
    confidence VARCHAR(20) NOT NULL,
    reasoning TEXT,
    status VARCHAR(20) DEFAULT 'approved',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. AI Settings & Audit Logs
CREATE TABLE IF NOT EXISTS ai_provider_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'gemini',
    model VARCHAR(100) DEFAULT 'gemini-2.5-flash',
    api_key_encrypted TEXT,
    endpoint TEXT,
    privacy_mode BOOLEAN DEFAULT FALSE,
    temperature NUMERIC(3,2) DEFAULT 0.1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_personal_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_passports ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_language_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_field_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_field_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to fetch current user's organization id
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS UUID AS $$
    SELECT organization_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- RLS Policy: Candidates isolation
CREATE POLICY "Org members can view their organization candidates"
    ON candidates FOR SELECT
    USING (organization_id = current_user_org_id());

CREATE POLICY "Org members can insert candidates into their org"
    ON candidates FOR INSERT
    WITH CHECK (organization_id = current_user_org_id());

CREATE POLICY "Org members can update their org candidates"
    ON candidates FOR UPDATE
    USING (organization_id = current_user_org_id());

-- RLS Policy: Candidate Documents isolation
CREATE POLICY "Org members can view candidate documents"
    ON candidate_documents FOR SELECT
    USING (organization_id = current_user_org_id());

CREATE POLICY "Org members can insert candidate documents"
    ON candidate_documents FOR INSERT
    WITH CHECK (organization_id = current_user_org_id());

-- RLS Policy: Applications isolation
CREATE POLICY "Org members can access applications"
    ON applications FOR ALL
    USING (organization_id = current_user_org_id());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_candidate ON candidate_documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_org ON applications(organization_id);

