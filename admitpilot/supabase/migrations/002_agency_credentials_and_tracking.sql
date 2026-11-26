-- AdmitPilot AI: Agency Governance, Encrypted Student Credentials, Document Blobs & Application Pipeline
-- Migration: 002_agency_credentials_and_tracking.sql

-- 1. Decouple user_profiles.id from strict auth.users PK so invited/seeded agency teammates
--    can exist prior to Supabase Auth sign-in, while preserving optional auth_user_id link.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS profile_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id ON public.user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON public.user_profiles(auth_user_id);

-- 2. Extend organizations with agency governance metadata
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS settings_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Country-Wise Admission Desks (country_teams)
CREATE TABLE IF NOT EXISTS public.country_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    countries TEXT[] NOT NULL DEFAULT '{}'::text[],
    lead_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    description TEXT,
    intake_focus TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_country_teams_org_id ON public.country_teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_country_teams_lead_user_id ON public.country_teams(lead_user_id);

-- 4. Extend candidates with country desk routing and canonical dossier snapshot
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS country_team_id UUID REFERENCES public.country_teams(id) ON DELETE SET NULL;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS target_countries TEXT[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_candidates_country_team_id ON public.candidates(country_team_id);
CREATE INDEX IF NOT EXISTS idx_candidates_assigned_consultant_id ON public.candidates(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_candidate_education_candidate_id ON public.candidate_education(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_education_org_id ON public.candidate_education(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidate_language_tests_candidate_id ON public.candidate_language_tests(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_language_tests_org_id ON public.candidate_language_tests(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidate_employment_candidate_id ON public.candidate_employment(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_employment_org_id ON public.candidate_employment(organization_id);

-- 5. Consultant-Managed Student Dedicated Emails & University Portal Credentials
CREATE TABLE IF NOT EXISTS public.candidate_portal_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by_consultant_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    label TEXT NOT NULL,
    portal_type TEXT NOT NULL DEFAULT 'university_portal',
    portal_url TEXT,
    login_email TEXT NOT NULL,
    username TEXT,
    password_encrypted TEXT,
    recovery_email TEXT,
    recovery_phone TEXT,
    pin_or_security_note_encrypted TEXT,
    is_primary_student_email BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_credentials_candidate_id ON public.candidate_portal_credentials(candidate_id);
CREATE INDEX IF NOT EXISTS idx_portal_credentials_org_id ON public.candidate_portal_credentials(organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_credentials_consultant_id ON public.candidate_portal_credentials(created_by_consultant_id);

-- 6. Extend candidate_documents + add candidate_document_blobs for cloud binary persistence
ALTER TABLE public.candidate_documents ADD COLUMN IF NOT EXISTS portal_file_name TEXT;
ALTER TABLE public.candidate_documents ADD COLUMN IF NOT EXISTS disk_file_name TEXT;
ALTER TABLE public.candidate_documents ADD COLUMN IF NOT EXISTS extraction_method TEXT;
ALTER TABLE public.candidate_documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'verified';
ALTER TABLE public.candidate_documents ADD COLUMN IF NOT EXISTS conflicts JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.candidate_documents ADD COLUMN IF NOT EXISTS ocr_applied BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.candidate_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_candidate_documents_org_id ON public.candidate_documents(organization_id);

CREATE TABLE IF NOT EXISTS public.candidate_document_blobs (
    document_id UUID PRIMARY KEY REFERENCES public.candidate_documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    file_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_document_blobs_org_id ON public.candidate_document_blobs(organization_id);

-- 7. Extend applications for full admissions pipeline, checklists, offer conditions, fees & timeline
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS country_team_id UUID REFERENCES public.country_teams(id) ON DELETE SET NULL;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS portal_credential_id UUID REFERENCES public.candidate_portal_credentials(id) ON DELETE SET NULL;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS details_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_applications_country_team_id ON public.applications(country_team_id);
CREATE INDEX IF NOT EXISTS idx_applications_portal_credential_id ON public.applications(portal_credential_id);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_consultant_id ON public.applications(assigned_consultant_id);

-- 8. Extend ai_provider_settings with encrypted multi-provider configuration
ALTER TABLE public.ai_provider_settings ADD COLUMN IF NOT EXISTS settings_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 9. Update RLS helper & enable RLS on all new tables using (select ...) optimization
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID AS $$
    SELECT organization_id
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) OR auth_user_id = (SELECT auth.uid())
    LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

ALTER TABLE public.country_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_portal_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_document_blobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'country_teams' AND policyname = 'Org members can access country_teams'
    ) THEN
        CREATE POLICY "Org members can access country_teams"
            ON public.country_teams FOR ALL TO authenticated
            USING (organization_id = (SELECT public.current_user_org_id()))
            WITH CHECK (organization_id = (SELECT public.current_user_org_id()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'candidate_portal_credentials' AND policyname = 'Org members can access candidate_portal_credentials'
    ) THEN
        CREATE POLICY "Org members can access candidate_portal_credentials"
            ON public.candidate_portal_credentials FOR ALL TO authenticated
            USING (organization_id = (SELECT public.current_user_org_id()))
            WITH CHECK (organization_id = (SELECT public.current_user_org_id()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'candidate_document_blobs' AND policyname = 'Org members can access candidate_document_blobs'
    ) THEN
        CREATE POLICY "Org members can access candidate_document_blobs"
            ON public.candidate_document_blobs FOR ALL TO authenticated
            USING (organization_id = (SELECT public.current_user_org_id()))
            WITH CHECK (organization_id = (SELECT public.current_user_org_id()));
    END IF;
END $$;
