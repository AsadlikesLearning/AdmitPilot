import './config/env.js';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { InMemoryStore } from './db/store.js';
import { DocumentExtractorService, FIELD_TARGET_MAP } from './services/document-extractor.js';
import { AIService } from './services/ai-service.js';
import {
  matchFormFields,
  matchFileUploadFields,
  buildPortalFileName,
  CandidateProfile,
  CandidateDocument,
  DocumentCategory,
  FormField,
  ApplicationRecord,
} from 'admitpilot-shared';
import jwt from 'jsonwebtoken';
import { authenticateJWT, AuthRequest, JWT_SECRET } from './middleware/auth.js';
import { setStoreContext } from './middleware/store-context.js';
import { DEFAULT_ADMIN_UUID, DEFAULT_ORG_UUID, toUuid } from './utils/crypto.js';
import { buildZipBuffer, ZipEntry } from './utils/zip.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Upload directory configuration (local fast cache alongside Supabase Postgres blobs)
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '15mb' }));

// Initialize services & data store (auto-connects to Supabase PostgreSQL via DATABASE_URL)
const store = new InMemoryStore();
const docExtractor = new DocumentExtractorService();
const aiService = new AIService();

// Hydrate store & AIService at startup
store
  .init()
  .then(() => store.getAISettings())
  .then((persisted) => {
    if (persisted) aiService.updateSettings(persisted);
  })
  .catch((err) => {
    console.warn('[AdmitPilot] Initial store hydration warning:', err.message);
  });

// Health endpoint is public - must be before authentication middleware
app.get('/api/health', async (_req, res) => {
  await store.init().catch(() => {});
  const storageInfo = store.getStorageInfo();
  res.json({
    status: 'ok',
    service: 'AdmitPilot AI Backend',
    version: '1.1.0',
    storageEngine: storageInfo.engine,
    databaseConnected: storageInfo.connected,
    databaseHost: storageInfo.host,
    timestamp: new Date().toISOString(),
  });
});

// Real multi-user login endpoint (verifies email + scrypt password in Supabase user_profiles)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await store.authenticateUser(String(email), String(password));
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This team account has been suspended by the agency owner' });
    }
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organizationId,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Self-serve Multi-Tenant Agency Sign-Up (creates isolated organization + org_admin owner)
app.post('/api/auth/register-agency', async (req, res) => {
  try {
    const {
      agencyName,
      fullName,
      email,
      password,
      headquarters,
      defaultIntake,
      operatingCountries,
    } = req.body || {};

    if (!agencyName || !fullName || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Agency name, full name, work email, and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { organization, user } = await store.registerAgency({
      agencyName: String(agencyName),
      fullName: String(fullName),
      email: String(email),
      password: String(password),
      headquarters: headquarters ? String(headquarters) : undefined,
      defaultIntake: defaultIntake ? String(defaultIntake) : undefined,
      operatingCountries: Array.isArray(operatingCountries) ? operatingCountries : undefined,
    });

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        organization_id: organization.id,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.status(201).json({ token, user, organization });
  } catch (err: any) {
    const status = err.message?.includes('already exists') ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
});

// Local development session bootstrap (disabled in production)
app.post('/api/auth/dev-session', (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const token = jwt.sign(
    {
      sub: DEFAULT_ADMIN_UUID,
      email: 'consultant@admitpilot.ai',
      organization_id: DEFAULT_ORG_UUID,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({
    token,
    user: {
      id: DEFAULT_ADMIN_UUID,
      email: 'consultant@admitpilot.ai',
      organizationId: DEFAULT_ORG_UUID,
    },
  });
});

// Apply JWT authentication to all other endpoints
app.use(authenticateJWT);

// Set store context from authenticated user's organization
app.use((req, _res, next) => {
  (req as any).store = store;
  setStoreContext(req as any, _res as any, next);
});

const requireOrgAdmin = async (req: AuthRequest, res: express.Response): Promise<boolean> => {
  if (req.user?.id) {
    const profile = await store.getUserProfile(req.user.id);
    if (profile?.role === 'org_admin') return true;
  }
  res.status(403).json({ error: 'Admin access required' });
  return false;
};

const filterCandidatesForUser = async (req: AuthRequest, candidates: any[]) => {
  if (!req.user?.id) return candidates;
  const actor = await store.getUserProfile(req.user.id);
  if (!actor || actor.role === 'org_admin') return candidates;
  const teamIds = new Set(actor.countryTeamIds || []);
  return candidates.filter((c) => {
    if (c.assignedConsultantId === actor.id) return true;
    if (actor.role === 'manager' && c.countryTeamId && teamIds.has(c.countryTeamId)) return true;
    if (!c.assignedConsultantId && c.countryTeamId && teamIds.has(c.countryTeamId)) return true;
    return false;
  });
};

// -------------------------------------------------------------
// Candidate Management Endpoints
// -------------------------------------------------------------
app.get('/api/candidates', async (req: AuthRequest, res) => {
  try {
    const { search, nationality, status, consultantId, includeArchived } = req.query;
    const candidates = await store.getCandidates({
      search: search ? String(search) : undefined,
      nationality: nationality ? String(nationality) : undefined,
      status: status ? String(status) : undefined,
      consultantId: consultantId ? String(consultantId) : undefined,
      includeArchived: includeArchived === 'true',
    });
    res.json(await filterCandidatesForUser(req, candidates));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/candidates/:id/archive', async (req, res) => {
  try {
    const success = await store.archiveCandidate(req.params.id as string);
    if (!success) return res.status(404).json({ error: 'Candidate not found' });
    res.json({ success, status: 'archived' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/candidates/:id/restore', async (req, res) => {
  try {
    const success = await store.restoreCandidate(req.params.id as string);
    if (!success) return res.status(404).json({ error: 'Candidate not found' });
    res.json({ success, status: 'active' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/candidates/:id', async (req, res) => {
  try {
    const cand = await store.getCandidate(req.params.id as string);
    if (!cand) return res.status(404).json({ error: 'Candidate not found' });
    res.json(cand);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/candidates', async (req: AuthRequest, res) => {
  try {
    const candidateData: CandidateProfile = {
      ...req.body,
      id: req.body.id ? toUuid(req.body.id) : crypto.randomUUID(),
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Auto-route to matching Country Desk & least-loaded consultant if enabled
    const org = await store.getOrganization();
    const targetCountries =
      candidateData.targetCountries || candidateData.additional?.preferredCountries || [];
    if (org?.autoAssignByCountry && targetCountries.length > 0) {
      const countryTeams = await store.listCountryTeams();
      const matchedDesk =
        (candidateData.countryTeamId
          ? countryTeams.find((t) => t.id === toUuid(candidateData.countryTeamId))
          : undefined) ||
        countryTeams.find((t) =>
          t.countries.some((c) =>
            targetCountries.some((tc) => tc.toLowerCase() === c.toLowerCase())
          )
        );

      if (matchedDesk) {
        if (!candidateData.countryTeamId) {
          candidateData.countryTeamId = matchedDesk.id;
        }
        if (!candidateData.assignedConsultantId) {
          const members = await store.listTeamMembers();
          const allCandidates = await store.getCandidates({ includeArchived: false });
          const deskConsultants = members.filter(
            (m) =>
              m.status !== 'suspended' &&
              m.status !== 'on_leave' &&
              (m.countryTeamIds || []).includes(matchedDesk.id)
          );
          if (deskConsultants.length > 0) {
            deskConsultants.sort((a, b) => {
              const loadA = allCandidates.filter((c) => c.assignedConsultantId === a.id).length;
              const loadB = allCandidates.filter((c) => c.assignedConsultantId === b.id).length;
              return loadA - loadB;
            });
            candidateData.assignedConsultantId = deskConsultants[0].id;
          } else if (matchedDesk.leadUserId) {
            candidateData.assignedConsultantId = matchedDesk.leadUserId;
          }
        }
      }
    }

    const saved = await store.saveCandidate(candidateData);

    // If a dedicated student email was supplied during candidate creation, auto-create primary credential record
    if (saved.contact?.managedStudentEmail?.trim()) {
      await store.saveCredential({
        candidateId: saved.id,
        label: 'Dedicated Student Admissions Email',
        portalType: 'dedicated_email',
        loginEmail: saved.contact.managedStudentEmail.trim(),
        password: req.body.managedStudentEmailPassword || undefined,
        isPrimaryStudentEmail: true,
        createdByConsultantId: req.user?.id ? toUuid(req.user.id) : undefined,
        notes: 'Created alongside candidate profile',
      });
    }

    res.status(201).json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/candidates/:id', async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await store.getCandidate(id);
    if (!existing) return res.status(404).json({ error: 'Candidate not found' });
    const updated = await store.saveCandidate({
      ...existing,
      ...req.body,
      id: existing.id,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/candidates/:id', async (req, res) => {
  try {
    const success = await store.deleteCandidate(req.params.id as string);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Student Dedicated Email & Portal Credentials Vault Endpoints
// -------------------------------------------------------------
app.get('/api/candidates/:id/credentials', async (req, res) => {
  try {
    const list = await store.listCredentials(req.params.id as string);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/candidates/:id/credentials', async (req: AuthRequest, res) => {
  try {
    const candidateId = req.params.id as string;
    const candidate = await store.getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    if (!req.body?.label || !req.body?.loginEmail) {
      return res.status(400).json({ error: 'Credential label and login email are required' });
    }

    const saved = await store.saveCredential({
      ...req.body,
      candidateId: candidate.id,
      createdByConsultantId: req.user?.id ? toUuid(req.user.id) : undefined,
    });
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/candidates/:id/credentials/:credId', async (req, res) => {
  try {
    const candidateId = req.params.id as string;
    const credId = req.params.credId as string;
    const existing = await store.getCredential(credId, false);
    if (!existing) return res.status(404).json({ error: 'Credential not found' });

    const saved = await store.saveCredential({
      ...existing,
      ...req.body,
      id: existing.id,
      candidateId,
    });
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/candidates/:id/credentials/:credId/reveal', async (req, res) => {
  try {
    const cred = await store.getCredential(req.params.credId as string, true);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });
    res.json({
      id: cred.id,
      loginEmail: cred.loginEmail,
      username: cred.username,
      password: cred.password || '',
      pinOrSecurityNote: cred.pinOrSecurityNote || '',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/candidates/:id/credentials/:credId', async (req, res) => {
  try {
    const deleted = await store.deleteCredential(req.params.credId as string);
    if (!deleted) return res.status(404).json({ error: 'Credential not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: set nested dot + bracket path on candidate profile (e.g. "education[0].gpa", "passport.passportNumber")
function setNestedValue(target: any, rawPath: string, value: any): void {
  const tokens = rawPath
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  if (!tokens.length) return;

  let curr = target;
  for (let i = 0; i < tokens.length - 1; i++) {
    const key = tokens[i];
    const nextKey = tokens[i + 1];
    const nextIsIndex = /^\d+$/.test(nextKey);
    if (curr[key] === undefined || curr[key] === null) {
      curr[key] = nextIsIndex ? [] : {};
    }
    curr = curr[key];
  }
  curr[tokens[tokens.length - 1]] = value;
}

function resolveDocDiskPath(doc: CandidateDocument): string | null {
  const candidates: string[] = [];
  if (doc.diskFileName) {
    candidates.push(path.join(uploadsDir, path.basename(doc.diskFileName)));
  }
  if (doc.storagePath && doc.storagePath.startsWith('/uploads/')) {
    candidates.push(path.join(uploadsDir, path.basename(doc.storagePath)));
  }
  candidates.push(path.join(uploadsDir, path.basename(doc.fileName)));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function processAndMergeDocumentFile(
  fileObj: { path: string; mimetype: string; originalname: string; filename: string; size: number },
  candidate: CandidateProfile,
  categoryHint?: DocumentCategory | 'auto',
  existingDocId?: string
): Promise<{ docRecord: CandidateDocument; extraction: any }> {
  const extraction = await docExtractor.extractDocument(
    fileObj.path,
    fileObj.mimetype,
    fileObj.originalname,
    candidate,
    categoryHint
  );

  // Enrich via configured Gemini Vision / DeepSeek / Ollama model (respects Strict Privacy Mode)
  const aiResult = await aiService.extractDocumentFields(
    extraction.rawText,
    extraction.category,
    extraction.inlineMedia
  );
  const AI_REFINABLE_KEYS = new Set([
    'degreeTitle',
    'institution',
    'major',
    'jobTitle',
    'company',
    'country',
    'sponsorName',
    'targetInstitution',
    'targetProgram',
    'recommenderName',
    'placeOfIssue',
    'issuingCountry',
  ]);
  const OCR_NAME_KEYS = new Set(['legalGivenName', 'familyName', 'fullName', 'issuingCountry']);

  if (aiResult?.fields) {
    for (const [k, v] of Object.entries(aiResult.fields)) {
      const existingMeta = extraction.structuredFields[k];
      const isMissing =
        extraction.fields[k] === undefined ||
        extraction.fields[k] === null ||
        extraction.fields[k] === '';
      const canRefine =
        (existingMeta?.source !== 'mrz' && AI_REFINABLE_KEYS.has(k)) ||
        (aiResult.usedVision && extraction.ocrApplied && OCR_NAME_KEYS.has(k));

      if (isMissing || canRefine) {
        const mapping = FIELD_TARGET_MAP[k];
        const targetPath = mapping?.targetPath || k;
        const label = mapping?.label || k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
        extraction.fields[k] = v;
        extraction.structuredFields[k] = {
          value: v,
          confidence: aiResult.usedVision ? 0.94 : 0.91,
          label,
          targetPath,
          snippet: `${aiResult.usedVision ? 'Vision' : 'AI'} extracted from ${fileObj.originalname}`,
          source: aiResult.usedVision ? 'ai_vision' : 'ai',
        };
        extraction.evidence[targetPath] = {
          sourceDocumentName: fileObj.originalname,
          snippet: `${aiResult.usedVision ? 'Vision' : 'AI'} extracted from ${fileObj.originalname}`,
          confidence: aiResult.usedVision ? 0.94 : 0.91,
          status: 'extracted',
          extractedAt: new Date().toISOString(),
        };
      }
    }
    extraction.extractionMethod = aiResult.usedVision ? 'ai_vision' : 'hybrid_ai';
    extraction.conflicts = docExtractor.detectConflicts(extraction.fields, candidate, fileObj.originalname);
  }

  const docId = existingDocId ? toUuid(existingDocId) : crypto.randomUUID();
  const portalFileName = buildPortalFileName(candidate, extraction.category, fileObj.originalname);
  const hasConflicts = extraction.conflicts.length > 0;

  const docRecord: CandidateDocument = {
    id: docId,
    candidateId: candidate.id,
    organizationId: candidate.organizationId,
    category: extraction.category,
    fileName: fileObj.originalname,
    portalFileName,
    diskFileName: fileObj.filename,
    fileSize: fileObj.size,
    mimeType: fileObj.mimetype,
    storagePath: `/api/documents/${docId}/download`,
    extractedText: extraction.rawText,
    extractedFields: extraction.structuredFields,
    conflicts: extraction.conflicts,
    extractionMethod: extraction.extractionMethod,
    verificationStatus: hasConflicts
      ? 'conflict'
      : Object.keys(extraction.structuredFields).length > 0
      ? 'verified'
      : 'needs_review',
    uploadedAt: new Date().toISOString(),
    ocrApplied: extraction.ocrApplied,
  };

  const fileBuffer = await fs.promises.readFile(fileObj.path);
  await store.saveDocument(docRecord, fileBuffer);

  // Merge non-conflicting extracted fields & provenance into candidate profile (zero-invention)
  candidate.evidence = { ...(candidate.evidence || {}), ...extraction.evidence };

  if (!candidate.conflicts) candidate.conflicts = {};
  for (const c of extraction.conflicts) {
    const existingList = candidate.conflicts[c.fieldKey] || [];
    if (!existingList.some((x) => x.documentName === c.documentName && x.documentValue === c.documentValue)) {
      candidate.conflicts[c.fieldKey] = [
        ...existingList,
        {
          candidateValue: c.candidateValue,
          documentValue: c.documentValue,
          documentName: c.documentName,
        },
      ];
    }
  }

  const conflictPaths = new Set(extraction.conflicts.map((c) => c.fieldKey));
  const f = extraction.fields;

  if (extraction.category === 'passport') {
    if (!candidate.passport && f.passportNumber) {
      candidate.passport = {
        passportNumber: f.passportNumber,
        fullName:
          f.fullName ||
          `${candidate.personal.legalGivenName} ${candidate.personal.familyName}`.trim().toUpperCase(),
        nationality: f.nationality || candidate.personal.nationality,
        dateOfBirth: f.dateOfBirth || candidate.personal.dateOfBirth,
        issuingCountry: f.issuingCountry || candidate.contact.country || '',
        placeOfIssue: f.placeOfIssue,
        issueDate: f.issueDate,
        expiryDate: f.expiryDate || '',
      };
    } else if (candidate.passport) {
      if (f.passportNumber && !conflictPaths.has('passport.passportNumber')) {
        candidate.passport.passportNumber = f.passportNumber;
      }
      if (f.fullName) candidate.passport.fullName = f.fullName;
      if (f.issuingCountry) candidate.passport.issuingCountry = f.issuingCountry;
      if (f.placeOfIssue) candidate.passport.placeOfIssue = f.placeOfIssue;
      if (f.issueDate) candidate.passport.issueDate = f.issueDate;
      if (f.expiryDate) candidate.passport.expiryDate = f.expiryDate;
    }
    if (f.nationalId && !candidate.personal.nationalId) {
      candidate.personal.nationalId = f.nationalId;
    }
  }

  if (extraction.category === 'english_test' && f.overallScore) {
    const existingIdx = candidate.englishTests.findIndex(
      (t) =>
        (f.referenceNumber && t.referenceNumber === f.referenceNumber) ||
        (t.testType === (f.testType || 'IELTS') && t.overallScore === String(f.overallScore))
    );
    const record = {
      id: existingIdx >= 0 ? candidate.englishTests[existingIdx].id : crypto.randomUUID(),
      testType: f.testType || 'IELTS',
      testDate: f.testDate || candidate.englishTests[existingIdx]?.testDate || '',
      referenceNumber: f.referenceNumber || candidate.englishTests[existingIdx]?.referenceNumber,
      overallScore: String(f.overallScore),
      listening: f.listening || candidate.englishTests[existingIdx]?.listening,
      reading: f.reading || candidate.englishTests[existingIdx]?.reading,
      writing: f.writing || candidate.englishTests[existingIdx]?.writing,
      speaking: f.speaking || candidate.englishTests[existingIdx]?.speaking,
      expiryDate: f.expiryDate || candidate.englishTests[existingIdx]?.expiryDate,
    };
    if (existingIdx >= 0) {
      candidate.englishTests[existingIdx] = record;
    } else {
      candidate.englishTests = [record, ...candidate.englishTests];
    }
  }

  if (
    (extraction.category === 'transcript' || extraction.category === 'degree') &&
    (f.degreeTitle || f.gpa || f.institution)
  ) {
    const existingEdu = candidate.education[0];
    if (
      existingEdu &&
      f.degreeTitle &&
      existingEdu.degreeTitle.toLowerCase() === String(f.degreeTitle).toLowerCase()
    ) {
      if (f.gpa) existingEdu.gpa = String(f.gpa);
      if (f.gradingScale) existingEdu.gradingScale = String(f.gradingScale);
      if (f.percentage) existingEdu.percentage = String(f.percentage);
      if (f.awardDate) existingEdu.awardDate = String(f.awardDate);
      if (f.institution) existingEdu.institution = String(f.institution);
    } else if (f.degreeTitle || f.institution) {
      candidate.education = [
        {
          id: crypto.randomUUID(),
          qualificationLevel: f.qualificationLevel || "Bachelor's",
          degreeTitle: f.degreeTitle || '',
          major: f.major || '',
          institution: f.institution || '',
          country: f.country || candidate.contact.country || '',
          awardDate: f.awardDate,
          gpa: f.gpa ? String(f.gpa) : undefined,
          gradingScale: f.gradingScale ? String(f.gradingScale) : undefined,
          percentage: f.percentage ? String(f.percentage) : undefined,
          status: extraction.category === 'degree' || f.awardDate ? 'Completed' : 'Enrolled',
        },
        ...candidate.education,
      ];
    }
  }

  if (extraction.category === 'cv' || extraction.category === 'experience') {
    if (f.email && !candidate.contact?.email) candidate.contact.email = f.email;
    if (f.phone && !candidate.contact?.phone) candidate.contact.phone = f.phone;
    if (f.company && f.jobTitle && !candidate.employment.some((e) => e.company === f.company)) {
      candidate.employment = [
        {
          id: crypto.randomUUID(),
          company: f.company,
          jobTitle: f.jobTitle,
          employmentType: f.employmentType || 'Full-time',
          startDate: f.startDate || '',
          endDate: f.endDate,
          location: f.location,
        },
        ...candidate.employment,
      ];
    }
  }

  if (extraction.category === 'financial' && f.closingBalance) {
    candidate.additional = {
      ...candidate.additional,
      financialSupport: `Verified balance ${f.closingBalance}${
        f.sponsorName ? ` (${f.sponsorName})` : ''
      }`,
    };
  }

  return { docRecord, extraction };
}

// -------------------------------------------------------------
// Document Management, Download, Preview & Intelligence Endpoints
// -------------------------------------------------------------
app.get('/api/candidates/:id/documents', async (req, res) => {
  try {
    const candidateId = req.params.id as string;
    const docs = await store.listDocuments(candidateId);
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// One-Click Standardized Portal Packet (.zip) Export
app.get('/api/candidates/:id/portal-packet.zip', async (req: AuthRequest, res) => {
  try {
    const candidateId = req.params.id as string;
    const candidate = await store.getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const visible = await filterCandidatesForUser(req, [candidate]);
    if (visible.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this candidate' });
    }

    const docs = await store.listDocuments(candidateId);
    const entries: ZipEntry[] = [];
    const usedNames = new Set<string>();

    const summaryLines = [
      `AdmitPilot — Standardized Portal Packet`,
      `========================================`,
      `Candidate: ${candidate.personal.legalGivenName} ${candidate.personal.familyName}`,
      `Nationality: ${candidate.personal.nationality || 'N/A'}`,
      `Date of Birth: ${candidate.personal.dateOfBirth || 'N/A'}`,
      `Passport No: ${candidate.passport?.passportNumber || 'N/A'} (Expires: ${candidate.passport?.expiryDate || 'N/A'})`,
      `Primary Email: ${candidate.contact.email || 'N/A'}`,
      `Managed Student Email: ${candidate.contact.managedStudentEmail || 'N/A'}`,
      `Phone: ${candidate.contact.phone || 'N/A'}`,
      `Target Countries: ${(candidate.targetCountries || []).join(', ') || 'N/A'}`,
      ``,
      `Included Documents (${docs.length}):`,
    ];

    for (const doc of docs) {
      const basePortalName =
        doc.portalFileName || buildPortalFileName(candidate, doc.category, doc.fileName);
      let entryName = basePortalName;
      let counter = 2;
      while (usedNames.has(entryName.toLowerCase())) {
        const dotIdx = basePortalName.lastIndexOf('.');
        entryName =
          dotIdx > 0
            ? `${basePortalName.slice(0, dotIdx)}_${counter}${basePortalName.slice(dotIdx)}`
            : `${basePortalName}_${counter}`;
        counter++;
      }
      usedNames.add(entryName.toLowerCase());

      const diskPath = resolveDocDiskPath(doc);
      let fileBuffer: Buffer | null = null;
      if (diskPath) {
        fileBuffer = await fs.promises.readFile(diskPath);
      } else {
        fileBuffer = await store.getDocumentBlob(doc.id);
      }
      if (!fileBuffer && doc.extractedText) {
        fileBuffer = Buffer.from(doc.extractedText, 'utf-8');
      }
      if (fileBuffer) {
        entries.push({ name: entryName, data: fileBuffer });
        summaryLines.push(`- ${entryName} (from ${doc.fileName})`);
      }
    }

    entries.unshift({
      name: '00_Dossier_Summary.txt',
      data: Buffer.from(summaryLines.join('\n'), 'utf8'),
    });

    const zipBuffer = buildZipBuffer(entries);
    const safeLast = (candidate.personal.familyName || 'Student').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFirst = (candidate.personal.legalGivenName || 'Dossier').replace(/[^a-zA-Z0-9_-]/g, '');
    const zipName = `${safeLast}_${safeFirst}_Portal_Packet.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.setHeader('Content-Length', String(zipBuffer.length));
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated Document Download / Inline Preview / Extension Base64 Payload
app.get('/api/documents/:docId/download', async (req, res) => {
  try {
    const docId = req.params.docId as string;
    const mode = String(req.query.mode || 'portal'); // 'portal' | 'original' | 'inline' | 'base64'
    const doc = await store.getDocument(docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const candidate = await store.getCandidate(doc.candidateId);
    const portalName =
      doc.portalFileName ||
      (candidate
        ? buildPortalFileName(candidate, doc.category, doc.fileName)
        : doc.fileName);
    const outFileName = mode === 'original' ? doc.fileName : portalName;

    const diskPath = resolveDocDiskPath(doc);
    let fileBuffer: Buffer | null = null;
    let contentType = doc.mimeType || 'application/octet-stream';

    if (diskPath) {
      fileBuffer = await fs.promises.readFile(diskPath);
    } else {
      // Fetch binary directly from Supabase PostgreSQL candidate_document_blobs
      fileBuffer = await store.getDocumentBlob(doc.id);
    }

    if (!fileBuffer && doc.extractedText) {
      fileBuffer = Buffer.from(doc.extractedText, 'utf-8');
      contentType = 'text/plain; charset=utf-8';
    }

    if (!fileBuffer) {
      return res.status(404).json({ error: 'Document binary not found' });
    }

    if (mode === 'base64') {
      res.json({
        id: doc.id,
        category: doc.category,
        fileName: doc.fileName,
        portalFileName: portalName,
        mimeType: contentType,
        fileSize: fileBuffer.byteLength,
        base64: fileBuffer.toString('base64'),
      });
      return;
    }

    const dispositionType = mode === 'inline' ? 'inline' : 'attachment';
    const safeAsciiName = outFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(fileBuffer.byteLength));
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(outFileName)}`
    );
    res.send(fileBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single or Multi-File Upload & Extraction
app.post('/api/candidates/:id/documents/upload', upload.any(), async (req, res) => {
  try {
    const candidateId = req.params.id as string;
    const candidate = await store.getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const uploadedFiles = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (!uploadedFiles.length) return res.status(400).json({ error: 'No file uploaded' });

    const persistedAI = await store.getAISettings();
    aiService.updateSettings(persistedAI);

    const categoryHint = req.body.category as DocumentCategory | 'auto' | undefined;
    const savedDocs: CandidateDocument[] = [];
    const extractions: any[] = [];

    for (const fileItem of uploadedFiles) {
      const { docRecord, extraction } = await processAndMergeDocumentFile(
        fileItem,
        candidate,
        categoryHint
      );
      savedDocs.push(docRecord);
      extractions.push({ ...extraction, inlineMedia: undefined });
    }

    const updatedCandidate = await store.saveCandidate(candidate);

    res.status(201).json({
      document: savedDocs[0],
      documents: savedDocs,
      extraction: extractions[0],
      extractions,
      updatedCandidate,
    });
  } catch (err: any) {
    console.error('Document upload/extraction failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Re-extract / Re-categorize an existing uploaded document
app.post('/api/candidates/:id/documents/:docId/reextract', async (req, res) => {
  try {
    const candidateId = req.params.id as string;
    const docId = req.params.docId as string;
    const candidate = await store.getCandidate(candidateId);
    const existingDoc = await store.getDocument(docId);
    if (!candidate || !existingDoc) {
      return res.status(404).json({ error: 'Candidate or document not found' });
    }

    let diskPath = resolveDocDiskPath(existingDoc);
    if (!diskPath) {
      // Rehydrate from Supabase PostgreSQL blob into local cache if needed
      const blob = await store.getDocumentBlob(existingDoc.id);
      if (blob) {
        const rehydratedName = existingDoc.diskFileName || `rehydrated-${existingDoc.id}-${existingDoc.fileName}`;
        diskPath = path.join(uploadsDir, path.basename(rehydratedName));
        await fs.promises.writeFile(diskPath, blob);
      }
    }

    if (!diskPath) {
      return res.status(404).json({ error: 'Source file not found for re-extraction' });
    }

    const persistedAI = await store.getAISettings();
    aiService.updateSettings(persistedAI);

    const categoryOverride = (req.body?.category as DocumentCategory | 'auto' | undefined) || existingDoc.category;
    const stat = await fs.promises.stat(diskPath);

    const { docRecord, extraction } = await processAndMergeDocumentFile(
      {
        path: diskPath,
        mimetype: existingDoc.mimeType,
        originalname: existingDoc.fileName,
        filename: existingDoc.diskFileName || path.basename(diskPath),
        size: stat.size,
      },
      candidate,
      categoryOverride,
      existingDoc.id
    );

    const updatedCandidate = await store.saveCandidate(candidate);
    res.json({
      document: docRecord,
      extraction: { ...extraction, inlineMedia: undefined },
      updatedCandidate,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update document category & portal filename immediately
app.patch('/api/candidates/:id/documents/:docId', async (req, res) => {
  try {
    const candidateId = req.params.id as string;
    const docId = req.params.docId as string;
    const category = req.body?.category as DocumentCategory | undefined;
    if (!category) return res.status(400).json({ error: 'category is required' });

    const candidate = await store.getCandidate(candidateId);
    const existingDoc = await store.getDocument(docId);
    if (!candidate || !existingDoc) {
      return res.status(404).json({ error: 'Candidate or document not found' });
    }

    const updatedDoc: CandidateDocument = {
      ...existingDoc,
      category,
      portalFileName: buildPortalFileName(candidate, category, existingDoc.fileName),
      updatedAt: new Date().toISOString(),
    };
    await store.saveDocument(updatedDoc);
    res.json(updatedDoc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a document
app.delete('/api/candidates/:id/documents/:docId', async (req, res) => {
  try {
    const docId = req.params.docId as string;
    const removed = await store.deleteDocument(docId);
    if (!removed) return res.status(404).json({ error: 'Document not found' });

    if (removed.diskFileName && !removed.diskFileName.startsWith('seed-')) {
      const p = path.join(uploadsDir, path.basename(removed.diskFileName));
      if (fs.existsSync(p)) {
        await fs.promises.unlink(p).catch(() => {});
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reconcile/Verify field edits from document review interface
app.post('/api/candidates/:id/reconcile', async (req, res) => {
  try {
    const candidate = await store.getCandidate(req.params.id as string);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const { fieldKey, approvedValue, note, documentId } = req.body;
    const mapping = FIELD_TARGET_MAP[fieldKey];
    const resolvedPath = mapping?.targetPath || fieldKey;

    setNestedValue(candidate, resolvedPath, approvedValue);

    if (!candidate.evidence) candidate.evidence = {};
    candidate.evidence[resolvedPath] = {
      ...(candidate.evidence[resolvedPath] || {}),
      status: 'verified',
      confidence: 1.0,
      verifiedAt: new Date().toISOString(),
      extractedAt: candidate.evidence[resolvedPath]?.extractedAt || new Date().toISOString(),
      note,
    };

    if (candidate.conflicts?.[resolvedPath]) {
      delete candidate.conflicts[resolvedPath];
    }

    if (documentId) {
      const doc = await store.getDocument(documentId);
      if (doc) {
        if (doc.extractedFields?.[fieldKey]) {
          doc.extractedFields[fieldKey].value = approvedValue;
          doc.extractedFields[fieldKey].verified = true;
          doc.extractedFields[fieldKey].confidence = 1.0;
        }
        if (doc.conflicts) {
          doc.conflicts = doc.conflicts.filter((c) => c.fieldKey !== resolvedPath && c.fieldKey !== fieldKey);
          if (doc.conflicts.length === 0) {
            doc.verificationStatus = 'verified';
          }
        }
        await store.saveDocument(doc);
      }
    }

    const saved = await store.saveCandidate(candidate);
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Application Tracking Endpoints
// -------------------------------------------------------------
app.get('/api/applications', async (req: AuthRequest, res) => {
  try {
    const list = await store.listApplications(req.query.candidateId as string);
    if (!req.user?.id) {
      return res.json(list);
    }
    const actor = await store.getUserProfile(req.user.id);
    if (!actor || actor.role === 'org_admin') {
      return res.json(list);
    }
    const visibleCandidates = await filterCandidatesForUser(req, await store.getCandidates());
    const visibleIds = new Set(visibleCandidates.map((c) => c.id));
    res.json(list.filter((app) => app.assignedConsultantId === actor.id || visibleIds.has(app.candidateId)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// University & Program Catalog Endpoints
app.get('/api/universities', async (_req, res) => {
  try {
    const items = await store.listUniversities();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/universities', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    if (!req.body?.name || !req.body?.country) {
      return res.status(400).json({ error: 'University name and country are required' });
    }
    const saved = await store.saveUniversity(req.body);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/universities/:id', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const ok = await store.deleteUniversity(req.params.id as string);
    if (!ok) return res.status(404).json({ error: 'University not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch Shortlist: Create Multiple Applications for One Student in One Request
app.post('/api/applications/batch', async (req: AuthRequest, res) => {
  try {
    const { candidateId, items } = req.body || {};
    if (!candidateId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'candidateId and at least one university program are required' });
    }
    const candidate = await store.getCandidate(String(candidateId));
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const visible = await filterCandidatesForUser(req, [candidate]);
    if (visible.length === 0) {
      return res.status(403).json({ error: 'Access denied for this candidate' });
    }

    const now = new Date().toISOString();
    const actorProfile = req.user?.id ? await store.getUserProfile(req.user.id) : null;
    const actorName = actorProfile?.fullName || 'Consultant';
    const candDocs = await store.listDocuments(candidate.id);
    const created: ApplicationRecord[] = [];

    for (const item of items) {
      const reqCats: DocumentCategory[] =
        Array.isArray(item.requiredDocs) && item.requiredDocs.length > 0
          ? item.requiredDocs
          : ['passport', 'transcript', 'english_test'];

      const checklist = reqCats.map((cat) => {
        const matched = candDocs.find((d) => d.category === cat);
        return {
          id: crypto.randomUUID(),
          category: cat,
          label: cat.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
          required: true,
          submitted: Boolean(matched),
          documentId: matched?.id,
        };
      });

      const appRecord = await store.saveApplication({
        id: crypto.randomUUID(),
        organizationId: candidate.organizationId,
        candidateId: candidate.id,
        institutionName: String(item.institutionName || 'University'),
        programName: String(item.programName || 'Degree Program'),
        degreeLevel: item.degreeLevel || "Master's",
        country: String(item.country || 'United Kingdom'),
        intake: item.intake ? String(item.intake) : undefined,
        deadline: item.deadline ? String(item.deadline) : undefined,
        portalUrl: item.portalUrl ? String(item.portalUrl) : undefined,
        applicationFee: item.applicationFee ? String(item.applicationFee) : undefined,
        tuitionFee: item.tuitionFee ? String(item.tuitionFee) : undefined,
        assignedConsultantId: candidate.assignedConsultantId || actorProfile?.id,
        countryTeamId: candidate.countryTeamId,
        status: 'preparing_documents',
        priority: 'medium',
        applicationFeeStatus: 'unpaid',
        scholarshipStatus: 'none',
        casStatus: 'not_started',
        visaStatus: 'not_started',
        documentChecklist: checklist,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        timeline: [
          {
            id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: now,
            actor: actorName,
            type: 'status',
            text: `Shortlisted ${item.institutionName} (${item.programName})`,
          },
        ],
      });
      created.push(appRecord);
    }

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/applications', async (req: AuthRequest, res) => {
  try {
    const now = new Date().toISOString();
    const actorProfile = req.user?.id ? await store.getUserProfile(req.user.id) : null;
    const actorName = actorProfile?.fullName || 'Consultant';

    // Default document checklist from candidate's existing verified documents if none passed
    let checklist = req.body.documentChecklist;
    if (!Array.isArray(checklist) && req.body.candidateId) {
      const candDocs = await store.listDocuments(req.body.candidateId);
      const findDoc = (cat: DocumentCategory) => candDocs.find((d) => d.category === cat);
      const passDoc = findDoc('passport');
      const transDoc = findDoc('transcript');
      const engDoc = findDoc('english_test');
      checklist = [
        {
          id: crypto.randomUUID(),
          category: 'passport',
          label: 'Passport bio-page scan',
          required: true,
          submitted: Boolean(passDoc),
          documentId: passDoc?.id,
        },
        {
          id: crypto.randomUUID(),
          category: 'transcript',
          label: 'Official academic transcript',
          required: true,
          submitted: Boolean(transDoc),
          documentId: transDoc?.id,
        },
        {
          id: crypto.randomUUID(),
          category: 'english_test',
          label: 'English proficiency score report',
          required: true,
          submitted: Boolean(engDoc),
          documentId: engDoc?.id,
        },
        {
          id: crypto.randomUUID(),
          category: 'sop',
          label: 'Statement of purpose / personal statement',
          required: true,
          submitted: Boolean(findDoc('sop')),
          documentId: findDoc('sop')?.id,
        },
      ];
    }

    // Auto-attach primary portal credential if not specified
    let portalCredentialId = req.body.portalCredentialId;
    if (!portalCredentialId && req.body.candidateId) {
      const creds = await store.listCredentials(req.body.candidateId);
      const primary = creds.find((c) => c.isPrimaryStudentEmail) || creds[0];
      if (primary) portalCredentialId = primary.id;
    }

    const newApp: ApplicationRecord = {
      ...req.body,
      id: req.body.id ? toUuid(req.body.id) : crypto.randomUUID(),
      portalCredentialId,
      documentChecklist: checklist || [],
      offerConditions: req.body.offerConditions || [],
      timeline: req.body.timeline || [
        {
          id: crypto.randomUUID(),
          timestamp: now,
          actor: actorName,
          type: 'status',
          text: `Created application record for ${req.body.programName} at ${req.body.institutionName}.`,
        },
      ],
      createdAt: req.body.createdAt || now,
      lastActivityAt: now,
    };
    const saved = await store.saveApplication(newApp);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/applications/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await store.getApplication(id);
    if (!existing) return res.status(404).json({ error: 'Application not found' });

    const actorProfile = req.user?.id ? await store.getUserProfile(req.user.id) : null;
    const actorName = actorProfile?.fullName || 'Consultant';
    let timeline = req.body.timeline ?? existing.timeline ?? [];

    if (req.body.status && req.body.status !== existing.status && !req.body.timeline) {
      timeline = [
        ...timeline,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          actor: actorName,
          type: 'status',
          text: `Stage updated from ${existing.status.replace(/_/g, ' ')} to ${String(req.body.status).replace(/_/g, ' ')}.`,
        },
      ];
    }

    if (req.body.newTimelineNote?.trim()) {
      timeline = [
        ...timeline,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          actor: actorName,
          type: req.body.newTimelineType || 'note',
          text: req.body.newTimelineNote.trim(),
        },
      ];
    }

    const { newTimelineNote: _ntn, newTimelineType: _ntt, ...cleanBody } = req.body;

    const saved = await store.saveApplication({
      ...existing,
      ...cleanBody,
      timeline,
      id: existing.id,
    });
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/applications/:id', async (req, res) => {
  try {
    const deleted = await store.deleteApplication(req.params.id as string);
    if (!deleted) return res.status(404).json({ error: 'Application not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// AI Intelligence & Form Matching Endpoints
// -------------------------------------------------------------
app.post('/api/ai/analyze-website', async (req, res) => {
  try {
    const { pageInfo, candidateId } = req.body;
    const candidate = await store.getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const report = await aiService.analyzeWebsite(pageInfo, candidate);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/match-fields', async (req, res) => {
  try {
    const { fields, candidateId } = req.body as { fields: FormField[]; candidateId: string };
    const candidate = await store.getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const candidateDocs = await store.listDocuments(candidateId);

    // Step 1: Hybrid Deterministic Matcher (text/select/date fields)
    const { mappings: deterministicMappings, unmatchedFields } = matchFormFields(fields, candidate);

    // Step 2: Semantic AI Matcher for remaining ambiguous non-file fields
    let aiMappings: any[] = [];
    if (unmatchedFields.length > 0) {
      const persistedAI = await store.getAISettings();
      aiService.updateSettings(persistedAI);
      aiMappings = await aiService.matchAmbiguousFields(unmatchedFields, candidate);
    }

    // Step 3: Match `<input type="file">` portal upload slots to verified candidate documents
    const fileMappings = matchFileUploadFields(fields, candidateDocs, candidate);

    const allMappings = [...deterministicMappings, ...aiMappings];
    const matchedFilesCount = fileMappings.filter((fm) => fm.status === 'approved').length;

    res.json({
      mappings: allMappings,
      fileMappings,
      matchedCount: allMappings.length + matchedFilesCount,
      totalFields: fields.length,
      unmatchedCount: fields.length - (allMappings.length + matchedFilesCount),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/agent-chat', async (req, res) => {
  try {
    const { message, candidateId, pageStructure, scannedFields, requirements } = req.body;
    const candidate = await store.getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const response = await aiService.handleAgentChat(message, {
      candidate,
      pageStructure,
      scannedFields,
      requirements,
    });
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Log Chrome Extension Auto-Fill & Document Attachment Audit Event into Applications Timeline
app.post('/api/ai/autofill-audit', async (req: AuthRequest, res) => {
  try {
    const {
      candidateId,
      portalUrl,
      hostname,
      pageTitle,
      filledCount = 0,
      attachedCount = 0,
    } = req.body || {};

    if (!candidateId) {
      return res.status(400).json({ error: 'candidateId is required' });
    }

    const candidate = await store.getCandidate(String(candidateId));
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const visible = await filterCandidatesForUser(req, [candidate]);
    if (visible.length === 0) {
      return res.status(403).json({ error: 'Access denied for this candidate' });
    }

    const actor = req.user?.id ? await store.getUserProfile(req.user.id) : null;
    const actorName = actor?.fullName || req.user?.email || 'Consultant';
    const now = new Date().toISOString();
    const targetHost = hostname || (portalUrl ? new URL(portalUrl).hostname : 'university portal');

    const parts: string[] = [];
    if (Number(filledCount) > 0) parts.push(`filled ${filledCount} field${filledCount === 1 ? '' : 's'}`);
    if (Number(attachedCount) > 0) parts.push(`attached ${attachedCount} document${attachedCount === 1 ? '' : 's'}`);
    const summaryText = `Chrome extension ${parts.join(' and ') || 'ran autofill'} on ${targetHost}${
      pageTitle ? ` (${String(pageTitle).slice(0, 60)})` : ''
    }`;

    const apps = await store.listApplications(candidate.id);
    const matchingApps = apps.filter(
      (a) =>
        a.portalUrl &&
        targetHost &&
        a.portalUrl.toLowerCase().includes(String(targetHost).toLowerCase())
    );
    const targetApps = matchingApps.length > 0 ? matchingApps : apps.slice(0, 1);

    if (targetApps.length > 0) {
      for (const appRecord of targetApps) {
        await store.saveApplication({
          ...appRecord,
          lastActivityAt: now,
          updatedAt: now,
          timeline: [
            {
              id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: now,
              actor: actorName,
              type: 'note',
              text: summaryText,
            },
            ...(appRecord.timeline || []),
          ],
        });
      }
    }

    res.json({ logged: true, updatedApplications: targetApps.length, summary: summaryText });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Settings
app.get('/api/settings/ai', async (_req, res) => {
  try {
    const persisted = await store.getAISettings();
    aiService.updateSettings(persisted);
    res.json(aiService.getPublicSettings());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/ai', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const updated = await store.saveAISettings(req.body);
    aiService.updateSettings(updated);
    res.json(aiService.getPublicSettings());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/settings/ai/test', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const persisted = await store.getAISettings();
    aiService.updateSettings(persisted);
    const result = await aiService.testConnection(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Admin Profile, Organization Settings, Teammates & Country Desks
// -------------------------------------------------------------
app.get('/api/me', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id || DEFAULT_ADMIN_UUID;
    const profile = await store.getUserProfile(userId);
    if (!profile) {
      const members = await store.listTeamMembers();
      res.json(members[0] || null);
      return;
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/me', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id || DEFAULT_ADMIN_UUID;
    const existing = await store.getUserProfile(userId);
    const saved = await store.saveTeamMember({
      ...(existing || { email: req.user?.email || 'consultant@admitpilot.ai', fullName: 'Admin' }),
      ...req.body,
      id: userId,
    });
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/organization', async (_req, res) => {
  try {
    const org = await store.getOrganization();
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json(org);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/organization', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const updated = await store.updateOrganization(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/team/members', async (_req, res) => {
  try {
    const members = await store.listTeamMembers();
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/team/members', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    if (!req.body?.email || !req.body?.fullName) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }
    const created = await store.saveTeamMember(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/team/members/:id', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const id = req.params.id as string;
    const existing = await store.getUserProfile(id);
    if (!existing) return res.status(404).json({ error: 'Team member not found' });
    const updated = await store.saveTeamMember({
      ...existing,
      ...req.body,
      id: existing.id,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/team/members/:id/credentials', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const { password } = req.body || {};
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const ok = await store.setMemberPassword(req.params.id as string, String(password));
    if (!ok) return res.status(404).json({ error: 'Team member not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/team/members/:id', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const id = req.params.id as string;
    if (toUuid(id) === toUuid(req.user?.id)) {
      return res.status(400).json({ error: 'Cannot delete the currently signed-in admin profile' });
    }
    const deleted = await store.deleteTeamMember(id);
    if (!deleted) return res.status(404).json({ error: 'Team member not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/team/countries', async (_req, res) => {
  try {
    const teams = await store.listCountryTeams();
    res.json(teams);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/team/countries', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const { memberIds, ...teamPayload } = req.body;
    if (!teamPayload?.name || !teamPayload?.code) {
      return res.status(400).json({ error: 'Desk name and code are required' });
    }
    const created = await store.saveCountryTeam(
      {
        ...teamPayload,
        countries: Array.isArray(teamPayload.countries) ? teamPayload.countries : [],
      },
      Array.isArray(memberIds) ? memberIds : undefined
    );
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/team/countries/:id', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const id = req.params.id as string;
    const { memberIds, ...teamPayload } = req.body;
    const updated = await store.saveCountryTeam(
      {
        ...teamPayload,
        id,
      },
      Array.isArray(memberIds) ? memberIds : undefined
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/team/countries/:id/members', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const teamId = req.params.id as string;
    const { userId, action } = req.body as { userId: string; action: 'add' | 'remove' };
    if (!userId || (action !== 'add' && action !== 'remove')) {
      return res.status(400).json({ error: 'userId and action (add|remove) are required' });
    }
    const updatedUser = await store.setCountryTeamMembership(teamId, userId, action);
    if (!updatedUser) return res.status(404).json({ error: 'Country desk or member not found' });
    res.json(updatedUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/team/countries/:id', async (req: AuthRequest, res) => {
  try {
    if (!(await requireOrgAdmin(req, res))) return;
    const deleted = await store.deleteCountryTeam(req.params.id as string);
    if (!deleted) return res.status(404).json({ error: 'Country desk not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`AdmitPilot AI Backend running on http://localhost:${PORT}`);
});
