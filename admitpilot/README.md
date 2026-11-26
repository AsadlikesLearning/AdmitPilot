# AdmitPilot AI — Intelligent Admissions Agent
> **"One Candidate Profile. Every University Application."**

AdmitPilot AI is a production-oriented, AI-powered platform and Chrome Manifest V3 extension designed specifically for study abroad consultants and education agencies managing hundreds or thousands of international university applications.

---

## 🏛 Architecture Overview

AdmitPilot AI is architected as a clean, modular TypeScript monorepo:

```
admitpilot/
├── packages/
│   └── shared/                 # Shared schemas (Zod), types, date normalizers,
│                               # hybrid deterministic matcher, and MRZ parser
├── apps/
│   ├── dashboard/              # React + Vite + Tailwind CSS consultant dashboard
│   │                           # (Split-screen document review, candidate management,
│   │                           # application tracker, AI configuration & RBAC)
│   ├── backend/                # Node.js + Express REST API
│   │                           # (Document extractor with PDF.js, Mammoth & Tesseract OCR,
│   │                           # pluggable AI adapters: Gemini, Ollama, DeepSeek)
│   └── extension/              # Manifest V3 Chrome Extension
│                               # (React popup, persistent side panel, MV3 service worker,
│                               # content script & main-world controlled form filling engine)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Multi-tenant PostgreSQL schema with Row-Level Security
├── test-fixtures/
│   └── admission-portal.html   # Standalone university admissions test portal
├── tests/
│   └── integration.test.ts     # Automated integration test suite
└── README.md
```

---

## 🛡️ Core Product Principles

1. **Zero-Invention Guarantee**: The AI never guesses or invents legally significant candidate details (dates of birth, criminal declarations, passport numbers, sponsor affidavits, or grades).
2. **Explicit Confidence Policy**:
   - 🟢 **High Confidence (0.90 - 1.0)**: Verified candidate record with unambiguous field mapping.
   - 🟡 **Medium Confidence (0.60 - 0.89)**: Likely semantic match flagged for explicit consultant approval.
   - 🔴 **Low Confidence / Missing (< 0.60)**: Ambiguous field left blank with explicit reasoning provided.
3. **Strict Distinctions**:
   - *Country of Birth* is strictly distinguished from *Nationality/Citizenship*.
   - *Applicant Email* is strictly distinguished from *Agency/Consultant Email*.
   - *Passport Issue Date* is strictly distinguished from *Passport Expiration Date*.
4. **Controlled DOM Automation**:
   - Values are injected using native property setters (`HTMLInputElement.prototype.value`) and verified via dispatched `input`, `change`, and `blur` events for compatibility with React, Radix UI, and controlled frameworks.
5. **Human-in-the-Loop Review**:
   - Applications are never automatically submitted without the consultant personally reviewing the completed form.

---

## ⚡ Quick Start & Local Development

### 1. Prerequisites
- **Node.js**: v20+ or v26+ LTS (`node -v`)
- **npm**: v10+ or v11+ (`npm -v`)
- **Google Chrome** (for loading the extension)

### 2. Install Dependencies
From the repository root (`admitpilot/`):

```bash
cd admitpilot
npm install
```

### 3. Start the Backend REST API
In terminal 1:
```bash
npm run backend:dev
```
The backend API will start on **`http://localhost:3001`**.
- Pre-populated with verified student profiles (e.g. *Muhammad Ali Khan* with complete passport, NUST degree, and IELTS 7.5 report).
- Health check: `http://localhost:3001/api/health`

### 4. Start the Consultant Dashboard
In terminal 2:
```bash
npm run dashboard:dev
```
The React dashboard will start on **`http://localhost:5173`**.

---

## 🧩 Installing the Chrome Extension in Chrome

1. Build the extension package:
   ```bash
   npm run extension:build
   ```
2. Copy the manifest and icons (or run standard build):
   The build outputs an unpacked extension to:
   ```
   admitpilot/apps/extension/dist
   ```
3. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked**.
6. Select the folder:
   ```
   <PATH_TO_REPO>/admitpilot/apps/extension/dist
   ```
7. Click the **AdmitPilot AI** extension icon in your Chrome toolbar or use the persistent **Side Panel** (`chrome.sidePanel`) on any university admission page!

---

## 🤖 Configuring AI Providers

AdmitPilot AI features a pluggable AI adapter layer configurable directly from the dashboard (**AI Settings** tab):

### 1. Google Gemini (Recommended)
1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/).
2. In the dashboard navigate to **AI Settings** &rarr; Select **Google Gemini**.
3. Model: `gemini-2.5-flash` or `gemini-1.5-flash`.
4. Enter your API key and click **Save AI Configuration**.

### 2. Ollama (100% Private Local Inference)
1. Install [Ollama](https://ollama.com/) locally and run:
   ```bash
   ollama run llama3
   ```
2. In the dashboard navigate to **AI Settings** &rarr; Select **Ollama (Local)**.
3. Server URL: `http://localhost:11434`. Model: `llama3` (or `mistral`, `qwen2.5`).
4. Click **Test Provider Connection** &rarr; **Save AI Configuration**.
5. No tokens or candidate data ever leave your workstation!

### 3. DeepSeek API / OpenAI-Compatible
- Select **DeepSeek API** or **OpenAI-Compatible** and configure the endpoint (`https://api.deepseek.com/v1` or custom gateway) and bearer key.

---

## 🗄️ Database & Supabase PostgreSQL Setup

AdmitPilot AI includes a full multi-tenant schema with Row-Level Security (RLS) in `supabase/migrations/001_initial_schema.sql`.

### To apply to Supabase:
1. Open your [Supabase Project Dashboard](https://supabase.com/).
2. Navigate to the **SQL Editor**.
3. Paste the contents of `supabase/migrations/001_initial_schema.sql` and click **Run**.
4. All tables (`organizations`, `candidates`, `candidate_passports`, `candidate_documents`, `applications`, `audit_logs`) will be created with strict organization isolation policies.

> **Offline/Local Mode**: When running locally without Supabase credentials, the backend automatically uses its built-in JSON file store (`admitpilot_data.json`) with zero configuration required.

---

## 🧪 Testing & Verification

Run the full automated test suite (shared unit tests + integration tests):

```bash
npm test
```

### End-to-End Workflow Verification:
1. Open the dashboard at `http://localhost:5173`.
2. Inspect candidate **Muhammad Ali Khan** under **Candidate Profiles**.
3. Navigate to the **Document Review** tab &rarr; view the split-screen comparison between the raw passport PDF and extracted structured fields.
4. Open the **Form Fill Sandbox** tab (`http://localhost:5173` &rarr; Form Fill Sandbox) or open `test-fixtures/admission-portal.html` in Chrome.
5. In the extension Side Panel or Sandbox:
   - Click **Analyze Site** &rarr; inspect university requirements and readiness summary.
   - Click **Scan Form** &rarr; review the proposed field mappings and confidence scores.
   - Click **Fill Approved Fields** &rarr; watch the controlled inputs, selects, and date fields populate with native events verified!
