# PROJECT_CONTEXT.md — Admissions Form Filler AI

> Reference notes on the repo's structure, architecture, data model, APIs, and Supabase PostgreSQL persistence.
> Updated 2026-11-26 to reflect live Supabase PostgreSQL (`pg.Pool`) persistence, AES-256-GCM student credential vault, multi-file document extraction/preview/portal-upload pipeline, and upgraded admissions tracker.

---

## 1. What the repo is

The repo contains **AdmitPilot AI** (`admitpilot/`), an npm workspaces monorepo using TypeScript, React 18, Vite 5, Tailwind 3, Express 4, `pg` (Supabase PostgreSQL), and Chrome Manifest V3.
- **Product goal**: Save an applicant dossier once, manage their consultant-created dedicated admissions email & portal logins, verify & standardize documents (`Khan_MuhammadAli_Passport.pdf`), track multi-stage university applications, and autofill + attach documents into university portals with **zero invention**.
- **Author / license**: Asad Abdullah, 2026. Custom **Non-Commercial License** (`LICENSE`).

---

## 2. Directory map

```
Admissions-Form-Filler-AI-main/
├── README.md, LICENSE, .gitignore, PROJECT_CONTEXT.md
└── admitpilot/
    ├── package.json         # workspaces: packages/*, apps/*
    ├── tsconfig.base.json   # ES2022, NodeNext, strict
    ├── .env.example         # Template (.env is gitignored)
    ├── packages/shared/src/ # admitpilot-shared
    │   ├── types.ts         # CandidateProfile, CandidatePortalCredential, CandidateDocument, ApplicationRecord, FileFieldMapping, AISettings…
    │   ├── schemas.ts       # Zod schemas
    │   ├── matcher.ts       # Deterministic field matcher + buildPortalFileName + matchFileUploadFields
    │   ├── normalizer.ts    # cleanText, normalizeDate, normalizeComparable, nationalityToCountry
    │   ├── mrz-parser.ts    # ICAO 9303 TD3 passport MRZ parser + Modulo-10 (7-3-1) check-digit validation
    │   └── index.ts
    ├── apps/backend/src/    # admitpilot-backend (Express, port 3001)
    │   ├── config/env.ts    # Auto-loads admitpilot/.env
    │   ├── server.ts        # REST API (candidates, credentials, documents, applications, team, AI)
    │   ├── db/postgres.ts   # pg.Pool connection manager + auto-applies 002 migration
    │   ├── db/store.ts      # Live Supabase PostgreSQL store (with isolated local JSON mode for temp-dir tests)
    │   ├── utils/crypto.ts  # AES-256-GCM secret encryption/decryption + deterministic RFC-4122 UUID mapper
    │   ├── utils/pdf-seed.ts# Valid PDF 1.4 generator for seeded passport, transcript & IELTS files
    │   ├── services/ai-service.ts          # Gemini (Vision + JSON), DeepSeek (V3/R1), Ollama, OpenAI-compatible
    │   └── services/document-extractor.ts  # 10-category classifier, MRZ + regex + Tesseract OCR + Gemini Vision
    ├── apps/dashboard/src/  # admitpilot-dashboard (React + Vite, port 5173, Dark Graphite + Passport Brass UI)
    │   ├── App.tsx, api.ts, index.css
    │   └── components/ (Sidebar, Header, DashboardStats, CandidateList, CandidateDetail,
    │       CandidateFormModal, DocumentUploadModal, DocumentReview, ApplicationTracker,
    │       TestFormRunner, AISettingsView, OrganizationView, AdminProfileView, ui/Primitives)
    ├── apps/extension/      # admitpilot-extension (MV3 Side Panel + Content Bridge)
    │   ├── build.js         # Vite + esbuild IIFE bundler + bundle integrity validator
    │   └── src/ background/index.ts, content/index.ts, injected/page-funcs.ts,
    │            popup/index.tsx, sidepanel/index.tsx, lib/api.ts
    └── supabase/migrations/
        ├── 001_initial_schema.sql
        └── 002_agency_credentials_and_tracking.sql
```

---

## 3. Core Architecture & Capabilities

### 3.1 Live Supabase PostgreSQL Persistence (`apps/backend/src/db/postgres.ts` & `store.ts`)
- Connects directly via `process.env.DATABASE_URL` (`pg.Pool` with TLS) and automatically verifies/applies `002_agency_credentials_and_tracking.sql`.
- Persists 100% of agency workspace entities in Supabase PostgreSQL:
  - `organizations`, `user_profiles`, `country_teams`
  - `candidates` + normalized child tables (`candidate_personal_details`, `candidate_contacts`, `candidate_passports`, `candidate_education`, `candidate_language_tests`, `candidate_employment`)
  - `candidate_portal_credentials` (student dedicated emails & portal logins encrypted at rest with `AES-256-GCM`)
  - `candidate_documents` + `candidate_document_blobs` (`BYTEA` cloud binary storage so PDFs/scans survive container restarts without local disk dependency)
  - `applications` (full pipeline details, checklists, offer conditions, fees, scholarships, CAS/visa status, activity timeline)
  - `ai_provider_settings` (per-org encrypted Gemini, DeepSeek, and OpenAI-compatible API keys)
- All foreign keys are indexed and all new tables enforce Row Level Security (`(SELECT public.current_user_org_id())`).
- `GET /api/health` reports `storageEngine: "supabase_postgres"` and `databaseConnected: true`.

### 3.2 Consultant-Managed Student Emails & Portal Credentials
- Consultants create dedicated student application inboxes (e.g. `alikhan.admissions2027@gmail.com`) plus university/UCAS/Common App/uni-assist/visa portal accounts.
- Passwords and 2FA/security notes are encrypted with `AES-256-GCM` derived from `JWT_SECRET` (`utils/crypto.ts`).
- When marked `isPrimaryStudentEmail: true`, `candidate.contact.managedStudentEmail` is automatically synced and prioritized by `matchFormFields()` when filling portal email inputs.
- Accessible with masked view, explicit authenticated reveal (`GET /api/candidates/:id/credentials/:credId/reveal`), and 1-click copy in Candidate Detail, Application Tracker, and Chrome Extension Side Panel.

### 3.3 Document Upload, Parsing, Preview, Download & Portal File Attachment
- Multi-file drag-and-drop upload (`POST /api/candidates/:id/documents/upload`) with auto-category detection across 10 document types, ICAO 9303 Modulo-10 MRZ check-digit verification, structured regex parsing, Tesseract OCR fallback, and multimodal Gemini Vision extraction.
- Authenticated binary delivery (`GET /api/documents/:docId/download?mode=portal|original|inline|base64`) — no unauthenticated `/uploads` static exposure.
- Standardized portal filenames (`buildPortalFileName` → `Khan_MuhammadAli_Passport.pdf`).
- `matchFileUploadFields()` maps `<input type="file">` controls on university portals to candidate documents, and `admitpilotAttachFiles()` in the Chrome Extension attaches binary files directly via `DataTransfer` + synthetic `input`/`change` events.

### 3.4 Admissions Pipeline & Application Tracker (`ApplicationTracker.tsx`)
- Kanban Board view (5 stage columns) + Table view with search, destination country, and priority filters.
- Slide-over Application Workspace managing: stage, application fee status, scholarship status, linked student portal login (1-click copy email/password), per-application document submission checklist (with direct 1-click portal-ready downloads), conditional offer requirements, acceptance deposit tracking, CAS/I-20/CoE & student visa milestones, and chronological activity logs.

### 3.5 Design System (`/unslop`)
- **Dark Graphite** surface ramp (`#0f0f10` sidebar, `#141415` page, `#19191b` card, `#232325` raised, `8%` hairlines), **IBM Plex Sans + IBM Plex Mono** (`tabular-nums`), off-white (`#ededed`) primary actions, **Passport Brass (`#d4a853`)** accent, `16px` `1.5`-stroke `lucide-react` icons, sentence-case labels, and monospace `VerificationStamp` indicators across both Dashboard and Extension.
