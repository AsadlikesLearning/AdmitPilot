import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  CandidateProfile,
  CandidateDocument,
  CandidatePortalCredential,
  ApplicationRecord,
  Organization,
  CountryTeam,
  UserProfile,
  AISettings,
  UniversityCatalogItem,
  buildDefaultUniversityCatalog,
} from 'admitpilot-shared';
import { buildSeedDocuments } from '../utils/pdf-seed.js';
import {
  DEFAULT_ADMIN_UUID,
  DEFAULT_ORG_UUID,
  SEED_UUIDS,
  decryptSecret,
  encryptSecret,
  hashPassword,
  maskSecret,
  toUuid,
  verifyPassword,
} from '../utils/crypto.js';
import {
  ensurePostgresMigrations,
  getPostgresPool,
  getPostgresStatus,
  isPostgresConfigured,
} from './postgres.js';

export interface CandidateFilter {
  search?: string;
  nationality?: string;
  preferredCountry?: string;
  intake?: string;
  consultantId?: string;
  status?: string;
  includeArchived?: boolean;
}

export interface StoredCredentialInternal extends CandidatePortalCredential {
  passwordEncrypted?: string | null;
  pinEncrypted?: string | null;
}

export interface DataStore {
  organizations: Organization[];
  countryTeams: CountryTeam[];
  users: UserProfile[];
  candidates: CandidateProfile[];
  credentials: StoredCredentialInternal[];
  documents: CandidateDocument[];
  applications: ApplicationRecord[];
  universityCatalog?: UniversityCatalogItem[];
  aiSettings: AISettings;
}

export interface StoreContext {
  organizationId: string;
}

function asSqlDate(val?: string | null, fallbackIfRequired?: string): string | null {
  if (val && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  return fallbackIfRequired || null;
}

function stripCredentialSecrets(
  cred: StoredCredentialInternal,
  includeDecrypted = false
): CandidatePortalCredential {
  const plainPwd = decryptSecret(cred.passwordEncrypted) ?? cred.password;
  const plainPin = decryptSecret(cred.pinEncrypted) ?? cred.pinOrSecurityNote;
  const { passwordEncrypted: _pe, pinEncrypted: _pie, password: _pw, ...rest } = cred;
  return {
    ...rest,
    hasPassword: Boolean(plainPwd),
    passwordMasked: maskSecret(plainPwd),
    ...(includeDecrypted ? { password: plainPwd, pinOrSecurityNote: plainPin } : { pinOrSecurityNote: plainPin ? maskSecret(plainPin) : undefined }),
  };
}

export class InMemoryStore {
  private data: DataStore;
  private filePath: string;
  private uploadsDir: string;
  private isLoaded = false;
  private usePostgres: boolean;
  private pgActive = false;
  private context: StoreContext | null = null;

  constructor(storageDir?: string, options?: { usePostgres?: boolean }) {
    const dir = storageDir || path.resolve(process.cwd());
    this.filePath = path.join(dir, 'admitpilot_data.json');
    this.uploadsDir = path.join(dir, 'uploads');
    // Isolate explicit temp-directory unit tests unless usePostgres is explicitly requested
    this.usePostgres =
      options?.usePostgres !== undefined
        ? options.usePostgres
        : !storageDir && isPostgresConfigured();
    this.data = this.getDefaultData(this.usePostgres);
  }

  isUsingPostgres(): boolean {
    return this.pgActive;
  }

  getStorageInfo(): { engine: 'supabase_postgres' | 'local_json'; host?: string; connected: boolean } {
    const pgStat = getPostgresStatus();
    return {
      engine: this.pgActive ? 'supabase_postgres' : 'local_json',
      host: pgStat.host,
      connected: this.pgActive && pgStat.connected,
    };
  }

  setContext(context: StoreContext): void {
    const orgId = this.usePostgres ? toUuid(context.organizationId) : context.organizationId;
    this.context = { organizationId: orgId };
  }

  getContext(): StoreContext | null {
    return this.context;
  }

  private enforceContext(): string {
    if (!this.context) {
      throw new Error('Store context not set. Call setContext() before data access.');
    }
    return this.context.organizationId;
  }

  private normalizeId(id?: string | null): string {
    if (this.usePostgres) {
      return toUuid(id);
    }
    return id && id.trim() ? id.trim() : crypto.randomUUID();
  }

  private getDefaultData(useUuidIds = false): DataStore {
    const now = new Date().toISOString();
    const mapId = (key: string) => (useUuidIds ? SEED_UUIDS[key] || toUuid(key) : key);

    const orgId = mapId('org-global-edu');
    const adminId = mapId('usr-admin-1');
    const usr2Id = mapId('usr-2');
    const usr3Id = mapId('usr-3');
    const usr4Id = mapId('usr-4');
    const teamUkId = mapId('team-uk-ie');
    const teamUsId = mapId('team-us-ca');
    const teamAuId = mapId('team-au-nz');
    const teamEuId = mapId('team-eu-de');
    const candId = mapId('cand-ali-khan-1');

    const defaultOrg: Organization = {
      id: orgId,
      name: 'Global EduConsultants & Associates',
      slug: 'global-edu',
      primaryEmail: 'admissions@globaledu.com',
      phone: '+44 20 7946 0820',
      headquarters: 'London, UK · Islamabad, PK',
      website: 'https://globaledu.example.com',
      defaultIntake: 'September 2027',
      operatingCountries: [
        'United Kingdom',
        'Ireland',
        'United States',
        'Canada',
        'Australia',
        'New Zealand',
        'Germany',
        'Netherlands',
      ],
      requireDualReview: true,
      autoAssignByCountry: true,
      createdAt: now,
      updatedAt: now,
    };

    const defaultCountryTeams: CountryTeam[] = [
      {
        id: teamUkId,
        organizationId: orgId,
        name: 'United Kingdom & Ireland Desk',
        code: 'UK-IE',
        countries: ['United Kingdom', 'Ireland'],
        leadUserId: adminId,
        description: 'Russell Group direct portals, UCAS postgraduate intakes, and UKVI CAS verification',
        intakeFocus: 'January & September intakes',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: teamUsId,
        organizationId: orgId,
        name: 'North America Desk',
        code: 'US-CA',
        countries: ['United States', 'Canada'],
        leadUserId: usr2Id,
        description: 'US graduate schools, Common App, Canadian U15 portals, and PAL/I-20 readiness',
        intakeFocus: 'Fall & Spring intakes',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: teamAuId,
        organizationId: orgId,
        name: 'Australia & New Zealand Desk',
        code: 'AU-NZ',
        countries: ['Australia', 'New Zealand'],
        leadUserId: usr3Id,
        description: 'Group of Eight admissions, Genuine Student (GS) statements, and CoE financial checks',
        intakeFocus: 'February & July intakes',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: teamEuId,
        organizationId: orgId,
        name: 'Continental Europe Desk',
        code: 'EU-DE',
        countries: ['Germany', 'Netherlands', 'Sweden'],
        leadUserId: usr4Id,
        description: 'TU9 & Dutch research universities, uni-assist submissions, and APS document audits',
        intakeFocus: 'Winter & Summer semesters',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const defaultUsers: UserProfile[] = [
      {
        id: adminId,
        organizationId: orgId,
        email: 'consultant@admitpilot.ai',
        fullName: 'Sarah Jenkins',
        jobTitle: 'Senior Admissions Director',
        phone: '+44 20 7946 0821',
        officeLocation: 'London, United Kingdom',
        timezone: 'Europe/London (UTC+0)',
        languages: ['English', 'French'],
        specializations: ['Russell Group MSc', 'Chevening & Commonwealth', 'CAS Compliance'],
        countryTeamIds: [teamUkId],
        assignedCountries: ['United Kingdom', 'Ireland'],
        maxActiveDossiers: 25,
        status: 'active',
        bio: 'Leads agency operations, UK/Ireland university partnerships, and final compliance sign-off.',
        signatureLine: 'Sarah Jenkins · Senior Admissions Director, Global EduConsultants',
        notifications: {
          documentUploads: true,
          portalDeadlines: true,
          conflictAlerts: true,
          offerUpdates: true,
        },
        role: 'org_admin',
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: usr2Id,
        organizationId: orgId,
        email: 'd.reynolds@globaledu.com',
        fullName: 'David Reynolds',
        jobTitle: 'North America Admissions Lead',
        phone: '+1 416 555 0148',
        officeLocation: 'Toronto, Canada',
        timezone: 'America/Toronto (UTC-5)',
        languages: ['English'],
        specializations: ['STEM Master’s', 'Canadian U15', 'Graduate Assistantships'],
        countryTeamIds: [teamUsId],
        assignedCountries: ['United States', 'Canada'],
        maxActiveDossiers: 30,
        status: 'active',
        bio: 'Manages US & Canadian graduate engineering and computer science submissions.',
        signatureLine: 'David Reynolds · North America Desk Lead',
        notifications: {
          documentUploads: true,
          portalDeadlines: true,
          conflictAlerts: true,
          offerUpdates: true,
        },
        role: 'manager',
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: usr3Id,
        organizationId: orgId,
        email: 'amina.t@globaledu.com',
        fullName: 'Amina Tariq',
        jobTitle: 'Senior Destination Consultant',
        phone: '+92 51 844 2210',
        officeLocation: 'Islamabad, Pakistan',
        timezone: 'Asia/Karachi (UTC+5)',
        languages: ['English', 'Urdu', 'Punjabi'],
        specializations: ['Group of Eight', 'UK Postgraduate', 'Scholarship Counseling'],
        countryTeamIds: [teamAuId, teamUkId],
        assignedCountries: ['Australia', 'New Zealand', 'United Kingdom'],
        maxActiveDossiers: 25,
        status: 'active',
        bio: 'Handles applicant dossier preparation across Australia, New Zealand, and UK intakes.',
        signatureLine: 'Amina Tariq · Senior Destination Consultant',
        notifications: {
          documentUploads: true,
          portalDeadlines: true,
          conflictAlerts: false,
          offerUpdates: true,
        },
        role: 'consultant',
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: usr4Id,
        organizationId: orgId,
        email: 'liam.vance@globaledu.com',
        fullName: 'Liam Vance',
        jobTitle: 'Document Verification & Europe Specialist',
        phone: '+49 30 5557 1920',
        officeLocation: 'Berlin, Germany',
        timezone: 'Europe/Berlin (UTC+1)',
        languages: ['English', 'German', 'Dutch'],
        specializations: ['MRZ & Transcript Verification', 'uni-assist', 'APS Audits'],
        countryTeamIds: [teamEuId],
        assignedCountries: ['Germany', 'Netherlands', 'Sweden'],
        maxActiveDossiers: 35,
        status: 'active',
        bio: 'Audits academic transcripts, MRZ travel records, and European university dossiers.',
        signatureLine: 'Liam Vance · Document Verification Specialist',
        notifications: {
          documentUploads: true,
          portalDeadlines: false,
          conflictAlerts: true,
          offerUpdates: false,
        },
        role: 'reviewer',
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const defaultCandidate: CandidateProfile = {
      id: candId,
      organizationId: orgId,
      assignedConsultantId: adminId,
      countryTeamId: teamUkId,
      targetCountries: ['United Kingdom', 'Germany'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      personal: {
        legalGivenName: 'Muhammad Ali',
        middleName: '',
        familyName: 'Khan',
        preferredName: 'Ali Khan',
        dateOfBirth: '1999-04-12',
        gender: 'Male',
        nationality: 'Pakistani',
        countryOfBirth: 'Pakistan',
        cityOfBirth: 'Lahore',
        maritalStatus: 'Single',
        nationalId: '35202-1234567-1',
        citizenships: ['Pakistan'],
      },
      contact: {
        email: 'ali.khan@example.com',
        managedStudentEmail: 'alikhan.admissions2027@gmail.com',
        phone: '+92 300 1234567',
        whatsapp: '+92 300 1234567',
        currentAddress: 'House 42, Street 7, Sector F-8/2',
        permanentAddress: 'House 42, Street 7, Sector F-8/2',
        city: 'Islamabad',
        state: 'Federal Capital',
        postalCode: '44000',
        country: 'Pakistan',
      },
      passport: {
        passportNumber: 'AB1234567',
        fullName: 'MUHAMMAD ALI KHAN',
        nationality: 'Pakistani',
        dateOfBirth: '1999-04-12',
        issuingCountry: 'Pakistan',
        placeOfIssue: 'Islamabad',
        issueDate: '2021-02-16',
        expiryDate: '2031-02-16',
      },
      education: [
        {
          id: useUuidIds ? toUuid('edu-bscs-1') : 'edu-bscs-1',
          qualificationLevel: "Bachelor's",
          degreeTitle: 'Bachelor of Science in Computer Science',
          major: 'Computer Science',
          institution: 'National University of Sciences & Technology (NUST)',
          country: 'Pakistan',
          startDate: '2017-09-01',
          endDate: '2021-06-30',
          awardDate: '2021-07-15',
          gpa: '3.82',
          gradingScale: '4.0',
          percentage: '88.5',
          status: 'Completed',
        },
      ],
      englishTests: [
        {
          id: useUuidIds ? toUuid('eng-ielts-1') : 'eng-ielts-1',
          testType: 'IELTS',
          testDate: '2023-11-14',
          referenceNumber: '23PK001234KHANM',
          overallScore: '8.0',
          listening: '8.5',
          reading: '8.5',
          writing: '7.5',
          speaking: '7.5',
          expiryDate: '2025-11-14',
        },
      ],
      employment: [
        {
          id: useUuidIds ? toUuid('emp-soft-eng-1') : 'emp-soft-eng-1',
          company: 'Afiniti Software Solutions',
          jobTitle: 'Associate Software Engineer',
          employmentType: 'Full-time',
          startDate: '2021-08-01',
          endDate: '2023-10-31',
          isCurrent: false,
          location: 'Islamabad, Pakistan',
        },
      ],
      additional: {
        financialSupport: 'Family self-funded and bank sponsorship statement verified.',
        emergencyContacts: 'Tariq Khan (Father) - +92 321 9876543',
        preferredCountries: ['United Kingdom', 'Germany'],
        preferredCourses: ['MSc Artificial Intelligence', 'MSc Advanced Computer Science'],
        preferredIntakes: ['September 2027'],
      },
      evidence: {
        'personal.legalGivenName': {
          sourceDocumentName: 'Passport_Scan_AB1234567.pdf',
          confidence: 0.98,
          status: 'verified',
          extractedAt: now,
        },
        'personal.familyName': {
          sourceDocumentName: 'Passport_Scan_AB1234567.pdf',
          confidence: 0.98,
          status: 'verified',
          extractedAt: now,
        },
        'passport.passportNumber': {
          sourceDocumentName: 'Passport_Scan_AB1234567.pdf',
          confidence: 0.99,
          status: 'verified',
          extractedAt: now,
        },
        'education[0].gpa': {
          sourceDocumentName: 'Official_Transcript_NUST_BSCS.pdf',
          confidence: 0.95,
          status: 'verified',
          extractedAt: now,
        },
        'englishTests[0].overallScore': {
          sourceDocumentName: 'IELTS_Academic_TRF.pdf',
          confidence: 0.99,
          status: 'verified',
          extractedAt: now,
        },
      },
      conflicts: {},
    };

    const rawSeedDocs = buildSeedDocuments(this.uploadsDir, orgId);
    const seedDocs: CandidateDocument[] = rawSeedDocs.map((d) => {
      const mappedDocId = mapId(d.id);
      return {
        ...d,
        id: mappedDocId,
        candidateId: candId,
        organizationId: orgId,
        storagePath: `/api/documents/${mappedDocId}/download`,
      };
    });

    const credEmailId = mapId('cred-seed-email');
    const credMancId = mapId('cred-seed-manchester');
    const credUcasId = mapId('cred-seed-ucas');

    const seedCredentials: StoredCredentialInternal[] = [
      {
        id: credEmailId,
        candidateId: candId,
        organizationId: orgId,
        createdByConsultantId: adminId,
        label: 'Dedicated Student Admissions Inbox (Gmail)',
        portalType: 'dedicated_email',
        portalUrl: 'https://mail.google.com',
        loginEmail: 'alikhan.admissions2027@gmail.com',
        username: 'alikhan.admissions2027',
        passwordEncrypted: encryptSecret('GlobalEdu!Ali2027#UK'),
        recoveryEmail: 'admissions-recovery@globaledu.com',
        recoveryPhone: '+44 20 7946 0821',
        pinEncrypted: encryptSecret('Backup code: 4829-1904'),
        isPrimaryStudentEmail: true,
        notes: 'Created by UK Desk for all Russell Group & UCAS correspondence; forwarded to agency CRM.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: credMancId,
        candidateId: candId,
        organizationId: orgId,
        createdByConsultantId: adminId,
        label: 'University of Manchester Self-Service Portal',
        portalType: 'university_portal',
        portalUrl: 'https://myapplication.manchester.ac.uk',
        loginEmail: 'alikhan.admissions2027@gmail.com',
        username: 'M10948271',
        passwordEncrypted: encryptSecret('MancPortal#2027!AK'),
        recoveryEmail: 'alikhan.admissions2027@gmail.com',
        pinEncrypted: encryptSecret('Security Q: City of birth -> Lahore'),
        isPrimaryStudentEmail: false,
        notes: 'Applicant ID M10948271 · MSc Artificial Intelligence (Sept 2027).',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: credUcasId,
        candidateId: candId,
        organizationId: orgId,
        createdByConsultantId: usr4Id,
        label: 'uni-assist MyAssist Portal (Germany)',
        portalType: 'uni_assist',
        portalUrl: 'https://my.uni-assist.de',
        loginEmail: 'alikhan.admissions2027@gmail.com',
        username: 'UA-3892041',
        passwordEncrypted: encryptSecret('UniAssist!TUM2027$'),
        recoveryEmail: 'alikhan.admissions2027@gmail.com',
        isPrimaryStudentEmail: false,
        notes: 'VPD pre-check account for Technical University of Munich.',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const docPassportId = seedDocs[0]?.id;
    const docTranscriptId = seedDocs[1]?.id;
    const docIeltsId = seedDocs[2]?.id;

    const seedApplications: ApplicationRecord[] = [
      {
        id: mapId('app-seed-manchester'),
        candidateId: candId,
        organizationId: orgId,
        assignedConsultantId: adminId,
        countryTeamId: teamUkId,
        portalCredentialId: credMancId,
        institutionName: 'University of Manchester',
        programName: 'MSc Artificial Intelligence',
        degreeLevel: "Master's",
        campus: 'Oxford Road, Manchester',
        country: 'United Kingdom',
        intake: 'September 2027',
        portalUrl: 'https://myapplication.manchester.ac.uk',
        referenceNumber: 'UOM-PG-10948271',
        status: 'conditional_offer',
        priority: 'high',
        deadline: '2027-03-31',
        submissionDate: '2026-11-10',
        tuitionFee: 'GBP 36,500 / yr',
        applicationFee: 'GBP 60',
        applicationFeeStatus: 'paid',
        scholarshipName: 'Manchester Global Futures Scholarship',
        scholarshipAmount: 'GBP 8,000',
        scholarshipStatus: 'applied',
        depositAmount: 'GBP 2,000',
        depositDeadline: '2027-05-15',
        depositPaid: false,
        casStatus: 'documents_pending',
        visaStatus: 'not_started',
        documentChecklist: [
          {
            id: 'chk-1',
            category: 'passport',
            label: 'Passport bio-page scan',
            required: true,
            submitted: true,
            documentId: docPassportId,
          },
          {
            id: 'chk-2',
            category: 'transcript',
            label: 'Official NUST BSCS academic transcript',
            required: true,
            submitted: true,
            documentId: docTranscriptId,
          },
          {
            id: 'chk-3',
            category: 'english_test',
            label: 'IELTS Academic TRF (Band 8.0)',
            required: true,
            submitted: true,
            documentId: docIeltsId,
          },
          {
            id: 'chk-4',
            category: 'sop',
            label: 'Statement of purpose (500 words)',
            required: true,
            submitted: false,
          },
          {
            id: 'chk-5',
            category: 'financial',
            label: '28-day UKVI bank maintenance statement',
            required: true,
            submitted: false,
          },
        ],
        offerConditions: [
          {
            id: 'cond-1',
            text: 'Upload HEC-attested final degree scroll by 30 April 2027',
            met: true,
            dueDate: '2027-04-30',
          },
          {
            id: 'cond-2',
            text: 'Pay GBP 2,000 tuition acceptance deposit via Flywire',
            met: false,
            dueDate: '2027-05-15',
          },
          {
            id: 'cond-3',
            text: 'Complete UKVI TB screening certificate (IOM Islamabad)',
            met: false,
            dueDate: '2027-06-01',
          },
        ],
        timeline: [
          {
            id: 'tl-1',
            timestamp: '2026-11-05T10:15:00.000Z',
            actor: 'Sarah Jenkins',
            type: 'note',
            text: 'Created dedicated student email alikhan.admissions2027@gmail.com and registered Manchester portal.',
          },
          {
            id: 'tl-2',
            timestamp: '2026-11-10T14:40:00.000Z',
            actor: 'Sarah Jenkins',
            type: 'status',
            text: 'Submitted online application UOM-PG-10948271; GBP 60 application fee paid.',
          },
          {
            id: 'tl-3',
            timestamp: '2026-11-22T09:20:00.000Z',
            actor: 'Admissions Office',
            type: 'offer',
            text: 'Conditional offer issued for MSc Artificial Intelligence (Sept 2027 intake).',
          },
        ],
        notes: 'Priority 1 choice. Student eligible for GBP 8,000 Global Futures award; awaiting deposit payment.',
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: mapId('app-seed-tum'),
        candidateId: candId,
        organizationId: orgId,
        assignedConsultantId: usr4Id,
        countryTeamId: teamEuId,
        portalCredentialId: credUcasId,
        institutionName: 'Technical University of Munich (TUM)',
        programName: 'MSc Informatics',
        degreeLevel: "Master's",
        campus: 'Garching Research Campus',
        country: 'Germany',
        intake: 'October 2027',
        portalUrl: 'https://campus.tum.de',
        referenceNumber: 'TUM-2027-INF-4410',
        status: 'preparing_documents',
        priority: 'medium',
        deadline: '2027-05-31',
        tuitionFee: 'EUR 6,000 / semester',
        applicationFee: 'EUR 75 (uni-assist VPD)',
        applicationFeeStatus: 'unpaid',
        scholarshipStatus: 'eligible',
        scholarshipName: 'TUM International Tuition Waiver',
        casStatus: 'not_started',
        visaStatus: 'not_started',
        documentChecklist: [
          {
            id: 'chk-tum-1',
            category: 'passport',
            label: 'Passport bio-page copy',
            required: true,
            submitted: true,
            documentId: docPassportId,
          },
          {
            id: 'chk-tum-2',
            category: 'transcript',
            label: 'Transcript + module handbook curricular analysis',
            required: true,
            submitted: true,
            documentId: docTranscriptId,
          },
          {
            id: 'chk-tum-3',
            category: 'cv',
            label: 'Tabular CV (chronological without gaps)',
            required: true,
            submitted: false,
          },
          {
            id: 'chk-tum-4',
            category: 'sop',
            label: 'Letter of motivation (max 2 pages)',
            required: true,
            submitted: false,
          },
        ],
        offerConditions: [],
        timeline: [
          {
            id: 'tl-tum-1',
            timestamp: '2026-11-18T11:00:00.000Z',
            actor: 'Liam Vance',
            type: 'status',
            text: 'Opened TUMonline & uni-assist VPD checklist for Winter 2027/28.',
          },
        ],
        notes: 'Requires uni-assist VPD certificate prior to 31 May 2027 deadline.',
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ];

    return {
      organizations: [defaultOrg],
      countryTeams: defaultCountryTeams,
      users: defaultUsers,
      candidates: [defaultCandidate],
      credentials: seedCredentials,
      documents: seedDocs,
      applications: seedApplications,
      aiSettings: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.1,
        privacyMode: false,
      },
    };
  }

  async init(): Promise<void> {
    if (this.isLoaded) return;

    if (this.usePostgres) {
      const migrated = await ensurePostgresMigrations();
      if (migrated) {
        this.pgActive = true;
        await this.seedPostgresIfNeeded();
        this.isLoaded = true;
        return;
      }
      console.warn('[AdmitPilot Store] Falling back to local JSON persistence because Postgres migration failed.');
    }

    const defaults = this.getDefaultData(false);
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);

      this.data = {
        organizations: Array.isArray(parsed.organizations) && parsed.organizations.length > 0 ? parsed.organizations : defaults.organizations,
        countryTeams: Array.isArray(parsed.countryTeams) && parsed.countryTeams.length > 0 ? parsed.countryTeams : defaults.countryTeams,
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : defaults.users,
        candidates: Array.isArray(parsed.candidates) && parsed.candidates.length > 0 ? parsed.candidates : defaults.candidates,
        credentials: Array.isArray(parsed.credentials) && parsed.credentials.length > 0 ? parsed.credentials : defaults.credentials,
        documents: Array.isArray(parsed.documents) && parsed.documents.length > 0 ? parsed.documents : defaults.documents,
        applications: Array.isArray(parsed.applications) && parsed.applications.length > 0 ? parsed.applications : defaults.applications,
        aiSettings: parsed.aiSettings || defaults.aiSettings,
      };
      this.isLoaded = true;
      await this.persistLocal();
    } catch (err: any) {
      this.data = defaults;
      this.isLoaded = true;
      if (err.code === 'ENOENT') {
        await this.persistLocal();
      }
    }
  }

  private async seedPostgresIfNeeded(): Promise<void> {
    const pool = getPostgresPool();
    if (!pool) return;

    const existingOrg = await pool.query(
      'SELECT id FROM public.organizations WHERE id = $1 OR slug = $2 LIMIT 1',
      [DEFAULT_ORG_UUID, 'global-edu']
    );

    const defaults = this.getDefaultData(true);
    const org = defaults.organizations[0];

    if (existingOrg.rowCount === 0) {
      console.log('[AdmitPilot Postgres] Seeding initial agency workspace into Supabase PostgreSQL...');
      await this.pgUpsertOrganization(org);

      for (const user of defaults.users) {
        await this.pgUpsertUser(user);
      }
      for (const team of defaults.countryTeams) {
        await this.pgUpsertCountryTeam(team);
      }
      for (const cand of defaults.candidates) {
        await this.pgUpsertCandidate(cand);
      }
      for (const cred of defaults.credentials) {
        await this.pgUpsertCredential(cred);
      }
      for (const doc of defaults.documents) {
        let buf: Buffer | undefined;
        if (doc.diskFileName) {
          const p = path.join(this.uploadsDir, doc.diskFileName);
          if (fsSync.existsSync(p)) {
            buf = await fs.readFile(p);
          }
        }
        await this.pgUpsertDocument(doc, buf);
      }
      for (const app of defaults.applications) {
        await this.pgUpsertApplication(app);
      }
      console.log('[AdmitPilot Postgres] Initial agency workspace seeded in Supabase.');
    } else {
      // Ensure credentials & sample applications exist if upgrading from an earlier partial seed
      const credCount = await pool.query(
        'SELECT count(*)::int AS cnt FROM public.candidate_portal_credentials WHERE organization_id = $1',
        [DEFAULT_ORG_UUID]
      );
      if ((credCount.rows[0]?.cnt ?? 0) === 0) {
        const candCheck = await pool.query('SELECT id FROM public.candidates WHERE id = $1', [
          SEED_UUIDS['cand-ali-khan-1'],
        ]);
        if (candCheck.rowCount && candCheck.rowCount > 0) {
          for (const cred of defaults.credentials) {
            await this.pgUpsertCredential(cred);
          }
        }
      }
      const appCount = await pool.query(
        'SELECT count(*)::int AS cnt FROM public.applications WHERE organization_id = $1',
        [DEFAULT_ORG_UUID]
      );
      if ((appCount.rows[0]?.cnt ?? 0) === 0) {
        const candCheck = await pool.query('SELECT id FROM public.candidates WHERE id = $1', [
          SEED_UUIDS['cand-ali-khan-1'],
        ]);
        if (candCheck.rowCount && candCheck.rowCount > 0) {
          for (const app of defaults.applications) {
            await this.pgUpsertApplication(app);
          }
        }
      }
    }
  }

  private async persistLocal(): Promise<void> {
    if (this.pgActive) return;
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AdmitPilot Store] Local persistence error:', err);
    }
  }

  // ------------------------------------------------------------------------
  // Postgres Low-Level Upsert & Mapper Helpers
  // ------------------------------------------------------------------------
  private mapRowToOrg(row: any): Organization {
    const meta = row.settings_data || {};
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      primaryEmail: meta.primaryEmail,
      phone: meta.phone,
      headquarters: meta.headquarters,
      website: meta.website,
      defaultIntake: meta.defaultIntake,
      operatingCountries: meta.operatingCountries || [],
      requireDualReview: meta.requireDualReview ?? true,
      autoAssignByCountry: meta.autoAssignByCountry ?? true,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  private async pgUpsertOrganization(org: Organization): Promise<void> {
    const pool = getPostgresPool()!;
    const { id, name, slug, createdAt, updatedAt, ...meta } = org;
    await pool.query(
      `INSERT INTO public.organizations (id, name, slug, settings_data, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         settings_data = EXCLUDED.settings_data,
         updated_at = EXCLUDED.updated_at`,
      [toUuid(id), name, slug, JSON.stringify(meta), createdAt || new Date().toISOString(), updatedAt || new Date().toISOString()]
    );
  }

  private mapRowToUser(row: any): UserProfile {
    const meta = row.profile_meta || {};
    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      jobTitle: meta.jobTitle,
      phone: meta.phone,
      officeLocation: meta.officeLocation,
      timezone: meta.timezone,
      languages: meta.languages || ['English'],
      specializations: meta.specializations || [],
      countryTeamIds: (meta.countryTeamIds || []).map((id: string) => toUuid(id)),
      assignedCountries: meta.assignedCountries || [],
      maxActiveDossiers: meta.maxActiveDossiers ?? 25,
      status: meta.status || 'active',
      bio: meta.bio,
      signatureLine: meta.signatureLine,
      hasLoginPassword: Boolean(meta.passwordHash),
      notifications: meta.notifications || {
        documentUploads: true,
        portalDeadlines: true,
        conflictAlerts: true,
        offerUpdates: true,
      },
      lastActiveAt: meta.lastActiveAt || (row.updated_at ? new Date(row.updated_at).toISOString() : undefined),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  private async pgUpsertUser(user: UserProfile, loginPassword?: string): Promise<void> {
    const pool = getPostgresPool()!;
    const { id, organizationId, email, fullName, role, createdAt, updatedAt, hasLoginPassword, ...meta } = user;
    let passwordHash: string | undefined;
    if (loginPassword && loginPassword.trim().length > 0) {
      passwordHash = hashPassword(loginPassword.trim());
    } else {
      const existing = await pool.query(
        `SELECT profile_meta->>'passwordHash' AS pw_hash FROM public.user_profiles WHERE id = $1`,
        [toUuid(id)]
      );
      if (existing.rows[0]?.pw_hash) {
        passwordHash = existing.rows[0].pw_hash;
      }
    }
    const profileMeta: Record<string, any> = {
      ...meta,
      countryTeamIds: (meta.countryTeamIds || []).map((tid) => toUuid(tid)),
    };
    if (passwordHash) {
      profileMeta.passwordHash = passwordHash;
    }
    await pool.query(
      `INSERT INTO public.user_profiles (id, organization_id, email, full_name, role, profile_meta, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         profile_meta = EXCLUDED.profile_meta,
         updated_at = EXCLUDED.updated_at`,
      [
        toUuid(id),
        toUuid(organizationId),
        email,
        fullName,
        role || 'consultant',
        JSON.stringify(profileMeta),
        createdAt || new Date().toISOString(),
        updatedAt || new Date().toISOString(),
      ]
    );
  }

  private mapRowToCountryTeam(row: any): CountryTeam {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      code: row.code,
      countries: row.countries || [],
      leadUserId: row.lead_user_id || undefined,
      description: row.description || '',
      intakeFocus: row.intake_focus || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  private async pgUpsertCountryTeam(team: CountryTeam): Promise<void> {
    const pool = getPostgresPool()!;
    await pool.query(
      `INSERT INTO public.country_teams (id, organization_id, name, code, countries, lead_user_id, description, intake_focus, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         countries = EXCLUDED.countries,
         lead_user_id = EXCLUDED.lead_user_id,
         description = EXCLUDED.description,
         intake_focus = EXCLUDED.intake_focus,
         updated_at = EXCLUDED.updated_at`,
      [
        toUuid(team.id),
        toUuid(team.organizationId),
        team.name,
        team.code,
        team.countries || [],
        team.leadUserId ? toUuid(team.leadUserId) : null,
        team.description || '',
        team.intakeFocus || '',
        team.createdAt || new Date().toISOString(),
        team.updatedAt || new Date().toISOString(),
      ]
    );
  }

  private mapRowToCandidate(row: any): CandidateProfile {
    const snap = (row.profile_data || {}) as CandidateProfile;
    return {
      ...snap,
      id: row.id,
      organizationId: row.organization_id,
      assignedConsultantId: row.assigned_consultant_id || snap.assignedConsultantId || undefined,
      countryTeamId: row.country_team_id || snap.countryTeamId || undefined,
      targetCountries: row.target_countries?.length ? row.target_countries : snap.targetCountries || [],
      status: row.status || snap.status || 'active',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : snap.createdAt,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : snap.updatedAt,
      personal: snap.personal || {
        legalGivenName: '',
        familyName: '',
        dateOfBirth: '',
        nationality: '',
      },
      contact: snap.contact || {
        email: '',
        phone: '',
        currentAddress: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      education: snap.education || [],
      englishTests: snap.englishTests || [],
      employment: snap.employment || [],
      additional: snap.additional || {},
      evidence: snap.evidence || {},
      conflicts: snap.conflicts || {},
    };
  }

  private async pgUpsertCandidate(cand: CandidateProfile): Promise<CandidateProfile> {
    const pool = getPostgresPool()!;
    const candId = toUuid(cand.id);
    const orgId = toUuid(cand.organizationId);
    const consultantId = cand.assignedConsultantId ? toUuid(cand.assignedConsultantId) : null;
    const teamId = cand.countryTeamId ? toUuid(cand.countryTeamId) : null;
    const now = cand.updatedAt || new Date().toISOString();

    const normalizedCand: CandidateProfile = {
      ...cand,
      id: candId,
      organizationId: orgId,
      assignedConsultantId: consultantId || undefined,
      countryTeamId: teamId || undefined,
      updatedAt: now,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validate FK references exist in this org before inserting to avoid FK violations
      let validConsultantId = consultantId;
      if (validConsultantId) {
        const uRes = await client.query('SELECT id FROM public.user_profiles WHERE id = $1', [validConsultantId]);
        if (uRes.rowCount === 0) validConsultantId = null;
      }
      let validTeamId = teamId;
      if (validTeamId) {
        const tRes = await client.query('SELECT id FROM public.country_teams WHERE id = $1', [validTeamId]);
        if (tRes.rowCount === 0) validTeamId = null;
      }

      await client.query(
        `INSERT INTO public.candidates (id, organization_id, assigned_consultant_id, country_team_id, target_countries, status, profile_data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           assigned_consultant_id = EXCLUDED.assigned_consultant_id,
           country_team_id = EXCLUDED.country_team_id,
           target_countries = EXCLUDED.target_countries,
           status = EXCLUDED.status,
           profile_data = EXCLUDED.profile_data,
           updated_at = EXCLUDED.updated_at`,
        [
          candId,
          orgId,
          validConsultantId,
          validTeamId,
          normalizedCand.targetCountries || [],
          normalizedCand.status || 'active',
          JSON.stringify(normalizedCand),
          normalizedCand.createdAt || now,
          now,
        ]
      );

      // Sync normalized child tables for SQL analytics & Table Editor visibility
      const p = normalizedCand.personal;
      if (p) {
        await client.query(
          `INSERT INTO public.candidate_personal_details (
             candidate_id, organization_id, legal_given_name, middle_name, family_name,
             preferred_name, date_of_birth, gender, nationality, country_of_birth,
             city_of_birth, marital_status, national_id, citizenships, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (candidate_id) DO UPDATE SET
             legal_given_name = EXCLUDED.legal_given_name,
             middle_name = EXCLUDED.middle_name,
             family_name = EXCLUDED.family_name,
             preferred_name = EXCLUDED.preferred_name,
             date_of_birth = EXCLUDED.date_of_birth,
             gender = EXCLUDED.gender,
             nationality = EXCLUDED.nationality,
             country_of_birth = EXCLUDED.country_of_birth,
             city_of_birth = EXCLUDED.city_of_birth,
             marital_status = EXCLUDED.marital_status,
             national_id = EXCLUDED.national_id,
             citizenships = EXCLUDED.citizenships,
             updated_at = EXCLUDED.updated_at`,
          [
            candId,
            orgId,
            p.legalGivenName || 'Unknown',
            p.middleName || null,
            p.familyName || 'Unknown',
            p.preferredName || null,
            asSqlDate(p.dateOfBirth, '1999-01-01'),
            p.gender || null,
            p.nationality || 'Unspecified',
            p.countryOfBirth || null,
            p.cityOfBirth || null,
            p.maritalStatus || null,
            p.nationalId || null,
            p.citizenships || [],
            now,
          ]
        );
      }

      const c = normalizedCand.contact;
      if (c) {
        await client.query(
          `INSERT INTO public.candidate_contacts (
             candidate_id, organization_id, email, alt_email, phone, alt_phone,
             whatsapp, current_address, permanent_address, city, state, postal_code, country, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (candidate_id) DO UPDATE SET
             email = EXCLUDED.email,
             alt_email = EXCLUDED.alt_email,
             phone = EXCLUDED.phone,
             alt_phone = EXCLUDED.alt_phone,
             whatsapp = EXCLUDED.whatsapp,
             current_address = EXCLUDED.current_address,
             permanent_address = EXCLUDED.permanent_address,
             city = EXCLUDED.city,
             state = EXCLUDED.state,
             postal_code = EXCLUDED.postal_code,
             country = EXCLUDED.country,
             updated_at = EXCLUDED.updated_at`,
          [
            candId,
            orgId,
            c.email || '',
            c.managedStudentEmail || c.altEmail || null,
            c.phone || '',
            c.altPhone || null,
            c.whatsapp || null,
            c.currentAddress || '',
            c.permanentAddress || null,
            c.city || '',
            c.state || '',
            c.postalCode || '',
            c.country || '',
            now,
          ]
        );
      }

      const pass = normalizedCand.passport;
      if (pass?.passportNumber) {
        await client.query(
          `INSERT INTO public.candidate_passports (
             candidate_id, organization_id, passport_number, full_name, nationality,
             date_of_birth, issuing_country, place_of_issue, issue_date, expiry_date, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (candidate_id) DO UPDATE SET
             passport_number = EXCLUDED.passport_number,
             full_name = EXCLUDED.full_name,
             nationality = EXCLUDED.nationality,
             date_of_birth = EXCLUDED.date_of_birth,
             issuing_country = EXCLUDED.issuing_country,
             place_of_issue = EXCLUDED.place_of_issue,
             issue_date = EXCLUDED.issue_date,
             expiry_date = EXCLUDED.expiry_date,
             updated_at = EXCLUDED.updated_at`,
          [
            candId,
            orgId,
            pass.passportNumber,
            pass.fullName || `${p?.legalGivenName || ''} ${p?.familyName || ''}`.trim(),
            pass.nationality || p?.nationality || 'Unspecified',
            asSqlDate(pass.dateOfBirth || p?.dateOfBirth, '1999-01-01'),
            pass.issuingCountry || c?.country || 'Unspecified',
            pass.placeOfIssue || null,
            asSqlDate(pass.issueDate),
            asSqlDate(pass.expiryDate, '2030-01-01'),
            now,
          ]
        );
      }

      // Replace education, language tests, employment snapshots
      await client.query('DELETE FROM public.candidate_education WHERE candidate_id = $1', [candId]);
      for (const edu of normalizedCand.education || []) {
        await client.query(
          `INSERT INTO public.candidate_education (
             id, candidate_id, organization_id, qualification_level, degree_title, major,
             institution, campus, country, start_date, end_date, award_date, gpa,
             grading_scale, percentage, obtained_marks, total_marks, status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            toUuid(edu.id),
            candId,
            orgId,
            edu.qualificationLevel || "Bachelor's",
            edu.degreeTitle || '',
            edu.major || '',
            edu.institution || '',
            edu.campus || null,
            edu.country || '',
            asSqlDate(edu.startDate),
            asSqlDate(edu.endDate),
            asSqlDate(edu.awardDate),
            edu.gpa || null,
            edu.gradingScale || null,
            edu.percentage || null,
            edu.obtainedMarks || null,
            edu.totalMarks || null,
            edu.status || 'Completed',
          ]
        );
      }

      await client.query('DELETE FROM public.candidate_language_tests WHERE candidate_id = $1', [candId]);
      for (const test of normalizedCand.englishTests || []) {
        await client.query(
          `INSERT INTO public.candidate_language_tests (
             id, candidate_id, organization_id, test_type, test_date, reference_number,
             overall_score, listening, reading, writing, speaking, expiry_date
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            toUuid(test.id),
            candId,
            orgId,
            test.testType || 'IELTS',
            asSqlDate(test.testDate, '2024-01-01'),
            test.referenceNumber || null,
            test.overallScore || '',
            test.listening || null,
            test.reading || null,
            test.writing || null,
            test.speaking || null,
            asSqlDate(test.expiryDate),
          ]
        );
      }

      await client.query('DELETE FROM public.candidate_employment WHERE candidate_id = $1', [candId]);
      for (const emp of normalizedCand.employment || []) {
        await client.query(
          `INSERT INTO public.candidate_employment (
             id, candidate_id, organization_id, company, job_title, employment_type,
             start_date, end_date, is_current, responsibilities, location
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            toUuid(emp.id),
            candId,
            orgId,
            emp.company || '',
            emp.jobTitle || '',
            emp.employmentType || 'Full-time',
            asSqlDate(emp.startDate, '2022-01-01'),
            asSqlDate(emp.endDate),
            Boolean(emp.isCurrent),
            emp.responsibilities || null,
            emp.location || null,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return normalizedCand;
  }

  private mapRowToCredential(row: any): StoredCredentialInternal {
    return {
      id: row.id,
      candidateId: row.candidate_id,
      organizationId: row.organization_id,
      createdByConsultantId: row.created_by_consultant_id || undefined,
      label: row.label,
      portalType: row.portal_type,
      portalUrl: row.portal_url || undefined,
      loginEmail: row.login_email,
      username: row.username || undefined,
      passwordEncrypted: row.password_encrypted,
      recoveryEmail: row.recovery_email || undefined,
      recoveryPhone: row.recovery_phone || undefined,
      pinEncrypted: row.pin_or_security_note_encrypted,
      isPrimaryStudentEmail: Boolean(row.is_primary_student_email),
      notes: row.notes || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  private async pgUpsertCredential(cred: StoredCredentialInternal): Promise<StoredCredentialInternal> {
    const pool = getPostgresPool()!;
    const id = toUuid(cred.id);
    const candId = toUuid(cred.candidateId);
    const orgId = toUuid(cred.organizationId);
    let consultantId = cred.createdByConsultantId ? toUuid(cred.createdByConsultantId) : null;
    if (consultantId) {
      const check = await pool.query('SELECT id FROM public.user_profiles WHERE id = $1', [consultantId]);
      if (check.rowCount === 0) consultantId = null;
    }

    const pwdEnc =
      cred.password !== undefined
        ? encryptSecret(cred.password)
        : cred.passwordEncrypted ?? null;
    const pinEnc =
      cred.pinOrSecurityNote !== undefined
        ? encryptSecret(cred.pinOrSecurityNote)
        : cred.pinEncrypted ?? null;

    if (cred.isPrimaryStudentEmail) {
      await pool.query(
        'UPDATE public.candidate_portal_credentials SET is_primary_student_email = FALSE WHERE candidate_id = $1 AND id <> $2',
        [candId, id]
      );
    }

    const res = await pool.query(
      `INSERT INTO public.candidate_portal_credentials (
         id, candidate_id, organization_id, created_by_consultant_id, label, portal_type,
         portal_url, login_email, username, password_encrypted, recovery_email, recovery_phone,
         pin_or_security_note_encrypted, is_primary_student_email, notes, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET
         label = EXCLUDED.label,
         portal_type = EXCLUDED.portal_type,
         portal_url = EXCLUDED.portal_url,
         login_email = EXCLUDED.login_email,
         username = EXCLUDED.username,
         password_encrypted = COALESCE(EXCLUDED.password_encrypted, public.candidate_portal_credentials.password_encrypted),
         recovery_email = EXCLUDED.recovery_email,
         recovery_phone = EXCLUDED.recovery_phone,
         pin_or_security_note_encrypted = COALESCE(EXCLUDED.pin_or_security_note_encrypted, public.candidate_portal_credentials.pin_or_security_note_encrypted),
         is_primary_student_email = EXCLUDED.is_primary_student_email,
         notes = EXCLUDED.notes,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        id,
        candId,
        orgId,
        consultantId,
        cred.label,
        cred.portalType || 'university_portal',
        cred.portalUrl || null,
        cred.loginEmail,
        cred.username || null,
        pwdEnc,
        cred.recoveryEmail || null,
        cred.recoveryPhone || null,
        pinEnc,
        Boolean(cred.isPrimaryStudentEmail),
        cred.notes || null,
        cred.createdAt || new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return this.mapRowToCredential(res.rows[0]);
  }

  private mapRowToDocument(row: any): CandidateDocument {
    return {
      id: row.id,
      candidateId: row.candidate_id,
      organizationId: row.organization_id,
      category: row.category,
      fileName: row.file_name,
      portalFileName: row.portal_file_name || undefined,
      diskFileName: row.disk_file_name || undefined,
      fileSize: Number(row.file_size || 0),
      mimeType: row.mime_type,
      storagePath: `/api/documents/${row.id}/download`,
      extractedText: row.extracted_text || undefined,
      extractedFields: row.extracted_fields || {},
      conflicts: row.conflicts || [],
      extractionMethod: row.extraction_method || undefined,
      verificationStatus: row.verification_status || 'verified',
      uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : new Date().toISOString(),
      ocrApplied: Boolean(row.ocr_applied),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  private async pgUpsertDocument(doc: CandidateDocument, fileBuffer?: Buffer): Promise<CandidateDocument> {
    const pool = getPostgresPool()!;
    const docId = toUuid(doc.id);
    const candId = toUuid(doc.candidateId);
    const orgId = toUuid(doc.organizationId);
    const storagePath = `/api/documents/${docId}/download`;

    const res = await pool.query(
      `INSERT INTO public.candidate_documents (
         id, candidate_id, organization_id, category, file_name, portal_file_name, disk_file_name,
         file_size, mime_type, storage_path, extracted_text, extracted_fields, conflicts,
         extraction_method, verification_status, ocr_applied, uploaded_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
         category = EXCLUDED.category,
         file_name = EXCLUDED.file_name,
         portal_file_name = EXCLUDED.portal_file_name,
         disk_file_name = EXCLUDED.disk_file_name,
         file_size = EXCLUDED.file_size,
         mime_type = EXCLUDED.mime_type,
         storage_path = EXCLUDED.storage_path,
         extracted_text = EXCLUDED.extracted_text,
         extracted_fields = EXCLUDED.extracted_fields,
         conflicts = EXCLUDED.conflicts,
         extraction_method = EXCLUDED.extraction_method,
         verification_status = EXCLUDED.verification_status,
         ocr_applied = EXCLUDED.ocr_applied,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        docId,
        candId,
        orgId,
        doc.category,
        doc.fileName,
        doc.portalFileName || null,
        doc.diskFileName || null,
        doc.fileSize,
        doc.mimeType,
        storagePath,
        doc.extractedText || null,
        JSON.stringify(doc.extractedFields || {}),
        JSON.stringify(doc.conflicts || []),
        doc.extractionMethod || null,
        doc.verificationStatus || 'verified',
        Boolean(doc.ocrApplied),
        doc.uploadedAt || new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    if (fileBuffer) {
      await pool.query(
        `INSERT INTO public.candidate_document_blobs (document_id, organization_id, file_data)
         VALUES ($1, $2, $3)
         ON CONFLICT (document_id) DO UPDATE SET file_data = EXCLUDED.file_data`,
        [docId, orgId, fileBuffer]
      );
    }

    return this.mapRowToDocument(res.rows[0]);
  }

  private mapRowToApplication(row: any): ApplicationRecord {
    const d = row.details_data || {};
    return {
      id: row.id,
      candidateId: row.candidate_id,
      organizationId: row.organization_id,
      assignedConsultantId: row.assigned_consultant_id || d.assignedConsultantId || undefined,
      countryTeamId: row.country_team_id || d.countryTeamId || undefined,
      portalCredentialId: row.portal_credential_id || d.portalCredentialId || undefined,
      institutionName: row.institution_name,
      programName: row.program_name,
      degreeLevel: d.degreeLevel,
      campus: d.campus,
      country: row.country,
      intake: row.intake || undefined,
      portalUrl: row.portal_url || undefined,
      referenceNumber: row.reference_number || undefined,
      status: row.status,
      priority: d.priority || 'medium',
      deadline: row.deadline ? new Date(row.deadline).toISOString().slice(0, 10) : d.deadline || undefined,
      submissionDate: row.submission_date
        ? new Date(row.submission_date).toISOString().slice(0, 10)
        : d.submissionDate || undefined,
      tuitionFee: d.tuitionFee,
      applicationFee: d.applicationFee,
      applicationFeeStatus: d.applicationFeeStatus,
      scholarshipName: d.scholarshipName,
      scholarshipAmount: d.scholarshipAmount,
      scholarshipStatus: d.scholarshipStatus,
      documentChecklist: d.documentChecklist || [],
      offerConditions: d.offerConditions || [],
      depositAmount: d.depositAmount,
      depositDeadline: d.depositDeadline,
      depositPaid: d.depositPaid,
      casStatus: d.casStatus,
      casNumber: d.casNumber,
      visaStatus: d.visaStatus,
      timeline: d.timeline || [],
      notes: row.notes || undefined,
      readinessReport: row.readiness_report || undefined,
      lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at).toISOString() : new Date().toISOString(),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  private async pgUpsertApplication(app: ApplicationRecord): Promise<ApplicationRecord> {
    const pool = getPostgresPool()!;
    const appId = toUuid(app.id);
    const candId = toUuid(app.candidateId);
    const orgId = toUuid(app.organizationId);

    let consultantId = app.assignedConsultantId ? toUuid(app.assignedConsultantId) : null;
    if (consultantId) {
      const check = await pool.query('SELECT id FROM public.user_profiles WHERE id = $1', [consultantId]);
      if (check.rowCount === 0) consultantId = null;
    }
    let teamId = app.countryTeamId ? toUuid(app.countryTeamId) : null;
    if (teamId) {
      const check = await pool.query('SELECT id FROM public.country_teams WHERE id = $1', [teamId]);
      if (check.rowCount === 0) teamId = null;
    }
    let credId = app.portalCredentialId ? toUuid(app.portalCredentialId) : null;
    if (credId) {
      const check = await pool.query('SELECT id FROM public.candidate_portal_credentials WHERE id = $1', [credId]);
      if (check.rowCount === 0) credId = null;
    }

    const details = {
      degreeLevel: app.degreeLevel,
      campus: app.campus,
      priority: app.priority || 'medium',
      tuitionFee: app.tuitionFee,
      applicationFee: app.applicationFee,
      applicationFeeStatus: app.applicationFeeStatus,
      scholarshipName: app.scholarshipName,
      scholarshipAmount: app.scholarshipAmount,
      scholarshipStatus: app.scholarshipStatus,
      documentChecklist: app.documentChecklist || [],
      offerConditions: app.offerConditions || [],
      depositAmount: app.depositAmount,
      depositDeadline: app.depositDeadline,
      depositPaid: app.depositPaid,
      casStatus: app.casStatus,
      casNumber: app.casNumber,
      visaStatus: app.visaStatus,
      timeline: app.timeline || [],
    };

    const now = new Date().toISOString();
    const res = await pool.query(
      `INSERT INTO public.applications (
         id, candidate_id, organization_id, assigned_consultant_id, country_team_id, portal_credential_id,
         institution_name, program_name, country, intake, portal_url, reference_number, status,
         deadline, submission_date, notes, readiness_report, details_data, last_activity_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20,$21)
       ON CONFLICT (id) DO UPDATE SET
         assigned_consultant_id = EXCLUDED.assigned_consultant_id,
         country_team_id = EXCLUDED.country_team_id,
         portal_credential_id = EXCLUDED.portal_credential_id,
         institution_name = EXCLUDED.institution_name,
         program_name = EXCLUDED.program_name,
         country = EXCLUDED.country,
         intake = EXCLUDED.intake,
         portal_url = EXCLUDED.portal_url,
         reference_number = EXCLUDED.reference_number,
         status = EXCLUDED.status,
         deadline = EXCLUDED.deadline,
         submission_date = EXCLUDED.submission_date,
         notes = EXCLUDED.notes,
         readiness_report = EXCLUDED.readiness_report,
         details_data = EXCLUDED.details_data,
         last_activity_at = EXCLUDED.last_activity_at,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        appId,
        candId,
        orgId,
        consultantId,
        teamId,
        credId,
        app.institutionName,
        app.programName,
        app.country,
        app.intake || null,
        app.portalUrl || null,
        app.referenceNumber || null,
        app.status || 'draft',
        asSqlDate(app.deadline),
        asSqlDate(app.submissionDate),
        app.notes || null,
        app.readinessReport ? JSON.stringify(app.readinessReport) : null,
        JSON.stringify(details),
        app.lastActivityAt || now,
        app.createdAt || now,
        now,
      ]
    );
    return this.mapRowToApplication(res.rows[0]);
  }

  // ------------------------------------------------------------------------
  // Candidates
  // ------------------------------------------------------------------------
  async getCandidates(filter?: CandidateFilter): Promise<CandidateProfile[]> {
    await this.init();
    const orgId = this.enforceContext();

    let list: CandidateProfile[];
    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.candidates WHERE organization_id = $1 ORDER BY updated_at DESC',
        [orgId]
      );
      list = res.rows.map((r) => this.mapRowToCandidate(r));
    } else {
      list = [...this.data.candidates].filter((c) => c.organizationId === orgId);
    }

    if (!filter?.includeArchived) {
      list = list.filter((c) => c.status !== 'archived');
    }
    if (filter?.status && filter.status !== 'all') {
      list = list.filter((c) => c.status === filter.status);
    }
    if (filter?.nationality && filter.nationality !== 'all') {
      list = list.filter((c) => c.personal.nationality.toLowerCase() === filter.nationality?.toLowerCase());
    }
    if (filter?.consultantId) {
      const targetConsultant = this.usePostgres ? toUuid(filter.consultantId) : filter.consultantId;
      list = list.filter((c) => c.assignedConsultantId === targetConsultant);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((c) => {
        const name = `${c.personal.legalGivenName} ${c.personal.familyName}`.toLowerCase();
        const email = `${c.contact?.email || ''} ${c.contact?.managedStudentEmail || ''}`.toLowerCase();
        const pass = (c.passport?.passportNumber || '').toLowerCase();
        const id = c.id.toLowerCase();
        return name.includes(q) || email.includes(q) || pass.includes(q) || id.includes(q);
      });
    }

    return list;
  }

  async listCandidates(): Promise<CandidateProfile[]> {
    return this.getCandidates();
  }

  async getCandidate(id: string): Promise<CandidateProfile | null> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(id);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.candidates WHERE id = $1 AND organization_id = $2 LIMIT 1',
        [targetId, orgId]
      );
      return res.rowCount ? this.mapRowToCandidate(res.rows[0]) : null;
    }

    const candidate = this.data.candidates.find((c) => c.id === targetId && c.organizationId === orgId);
    return candidate || null;
  }

  async findCandidateByIntakeToken(
    token: string
  ): Promise<{ candidate: CandidateProfile; organizationName: string } | null> {
    await this.init();
    const cleanToken = String(token || '').trim();
    if (!cleanToken) return null;

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        `SELECT c.*, o.name AS org_name
         FROM public.candidates c
         LEFT JOIN public.organizations o ON o.id = c.organization_id
         WHERE c.profile_data->>'intakeShareToken' = $1
         LIMIT 1`,
        [cleanToken]
      );
      if (!res.rowCount) return null;
      return {
        candidate: this.mapRowToCandidate(res.rows[0]),
        organizationName: res.rows[0].org_name || 'Admissions Consultancy',
      };
    }

    const candidate = this.data.candidates.find((c) => c.intakeShareToken === cleanToken);
    if (!candidate) return null;
    const org = this.data.organizations.find((o) => o.id === candidate.organizationId);
    return {
      candidate,
      organizationName: org?.name || 'Admissions Consultancy',
    };
  }

  async saveCandidate(candidate: CandidateProfile): Promise<CandidateProfile> {
    await this.init();
    const orgId = this.enforceContext();
    const normalized: CandidateProfile = {
      ...candidate,
      id: this.normalizeId(candidate.id),
      organizationId: orgId,
      updatedAt: new Date().toISOString(),
    };

    if (this.pgActive) {
      return this.pgUpsertCandidate(normalized);
    }

    const idx = this.data.candidates.findIndex((c) => c.id === normalized.id);
    if (idx >= 0) {
      this.data.candidates[idx] = normalized;
    } else {
      this.data.candidates.unshift(normalized);
    }
    await this.persistLocal();
    return normalized;
  }

  async archiveCandidate(id: string): Promise<boolean> {
    await this.init();
    const cand = await this.getCandidate(id);
    if (!cand) return false;
    cand.status = 'archived';
    await this.saveCandidate(cand);
    return true;
  }

  async restoreCandidate(id: string): Promise<boolean> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(id);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.candidates WHERE id = $1 AND organization_id = $2 LIMIT 1',
        [targetId, orgId]
      );
      if (!res.rowCount) return false;
      const cand = this.mapRowToCandidate(res.rows[0]);
      cand.status = 'active';
      await this.pgUpsertCandidate(cand);
      return true;
    }

    const cand = this.data.candidates.find((c) => c.id === targetId && c.organizationId === orgId);
    if (!cand) return false;
    cand.status = 'active';
    cand.updatedAt = new Date().toISOString();
    await this.persistLocal();
    return true;
  }

  async deleteCandidate(id: string): Promise<boolean> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(id);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'DELETE FROM public.candidates WHERE id = $1 AND organization_id = $2',
        [targetId, orgId]
      );
      return (res.rowCount ?? 0) > 0;
    }

    const initialLen = this.data.candidates.length;
    this.data.candidates = this.data.candidates.filter((c) => !(c.id === targetId && c.organizationId === orgId));
    this.data.credentials = this.data.credentials.filter((cr) => !(cr.candidateId === targetId && cr.organizationId === orgId));
    this.data.documents = this.data.documents.filter((d) => !(d.candidateId === targetId && d.organizationId === orgId));
    this.data.applications = this.data.applications.filter((a) => !(a.candidateId === targetId && a.organizationId === orgId));
    await this.persistLocal();
    return this.data.candidates.length < initialLen;
  }

  // ------------------------------------------------------------------------
  // Consultant-Managed Student Emails & Portal Credentials
  // ------------------------------------------------------------------------
  async listCredentials(candidateId: string): Promise<CandidatePortalCredential[]> {
    await this.init();
    const orgId = this.enforceContext();
    const candId = this.normalizeId(candidateId);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        `SELECT * FROM public.candidate_portal_credentials
         WHERE candidate_id = $1 AND organization_id = $2
         ORDER BY is_primary_student_email DESC, created_at ASC`,
        [candId, orgId]
      );
      return res.rows.map((r) => stripCredentialSecrets(this.mapRowToCredential(r), false));
    }

    return this.data.credentials
      .filter((c) => c.candidateId === candId && c.organizationId === orgId)
      .map((c) => stripCredentialSecrets(c, false));
  }

  async getCredential(
    credId: string,
    includeDecrypted = false
  ): Promise<CandidatePortalCredential | null> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(credId);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.candidate_portal_credentials WHERE id = $1 AND organization_id = $2 LIMIT 1',
        [targetId, orgId]
      );
      if (!res.rowCount) return null;
      return stripCredentialSecrets(this.mapRowToCredential(res.rows[0]), includeDecrypted);
    }

    const found = this.data.credentials.find((c) => c.id === targetId && c.organizationId === orgId);
    return found ? stripCredentialSecrets(found, includeDecrypted) : null;
  }

  async saveCredential(
    credInput: Partial<CandidatePortalCredential> & { candidateId: string; label: string; loginEmail: string }
  ): Promise<CandidatePortalCredential> {
    await this.init();
    const orgId = this.enforceContext();
    const now = new Date().toISOString();
    const credId = this.normalizeId(credInput.id);
    const candId = this.normalizeId(credInput.candidateId);

    let savedInternal: StoredCredentialInternal;

    if (this.pgActive) {
      savedInternal = await this.pgUpsertCredential({
        id: credId,
        candidateId: candId,
        organizationId: orgId,
        createdByConsultantId: credInput.createdByConsultantId,
        label: credInput.label,
        portalType: credInput.portalType || 'university_portal',
        portalUrl: credInput.portalUrl,
        loginEmail: credInput.loginEmail.trim(),
        username: credInput.username,
        password: credInput.password,
        recoveryEmail: credInput.recoveryEmail,
        recoveryPhone: credInput.recoveryPhone,
        pinOrSecurityNote: credInput.pinOrSecurityNote,
        isPrimaryStudentEmail: credInput.isPrimaryStudentEmail,
        notes: credInput.notes,
        createdAt: credInput.createdAt || now,
        updatedAt: now,
      });
    } else {
      const idx = this.data.credentials.findIndex((c) => c.id === credId && c.organizationId === orgId);
      const existing = idx >= 0 ? this.data.credentials[idx] : undefined;

      if (credInput.isPrimaryStudentEmail) {
        this.data.credentials = this.data.credentials.map((c) =>
          c.candidateId === candId && c.id !== credId ? { ...c, isPrimaryStudentEmail: false } : c
        );
      }

      savedInternal = {
        id: credId,
        candidateId: candId,
        organizationId: orgId,
        createdByConsultantId: credInput.createdByConsultantId ?? existing?.createdByConsultantId,
        label: credInput.label,
        portalType: credInput.portalType || existing?.portalType || 'university_portal',
        portalUrl: credInput.portalUrl ?? existing?.portalUrl,
        loginEmail: credInput.loginEmail.trim(),
        username: credInput.username ?? existing?.username,
        passwordEncrypted:
          credInput.password !== undefined
            ? encryptSecret(credInput.password)
            : existing?.passwordEncrypted,
        recoveryEmail: credInput.recoveryEmail ?? existing?.recoveryEmail,
        recoveryPhone: credInput.recoveryPhone ?? existing?.recoveryPhone,
        pinEncrypted:
          credInput.pinOrSecurityNote !== undefined
            ? encryptSecret(credInput.pinOrSecurityNote)
            : existing?.pinEncrypted,
        isPrimaryStudentEmail: credInput.isPrimaryStudentEmail ?? existing?.isPrimaryStudentEmail ?? false,
        notes: credInput.notes ?? existing?.notes,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      if (idx >= 0) {
        this.data.credentials[idx] = savedInternal;
      } else {
        this.data.credentials.push(savedInternal);
      }
      await this.persistLocal();
    }

    // Sync candidate.contact.managedStudentEmail when primary student email is created/updated
    if (savedInternal.isPrimaryStudentEmail || savedInternal.portalType === 'dedicated_email') {
      const cand = await this.getCandidate(candId);
      if (cand && (savedInternal.isPrimaryStudentEmail || !cand.contact.managedStudentEmail)) {
        cand.contact = {
          ...cand.contact,
          managedStudentEmail: savedInternal.loginEmail,
        };
        await this.saveCandidate(cand);
      }
    }

    return stripCredentialSecrets(savedInternal, false);
  }

  async deleteCredential(credId: string): Promise<boolean> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(credId);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'DELETE FROM public.candidate_portal_credentials WHERE id = $1 AND organization_id = $2',
        [targetId, orgId]
      );
      return (res.rowCount ?? 0) > 0;
    }

    const before = this.data.credentials.length;
    this.data.credentials = this.data.credentials.filter(
      (c) => !(c.id === targetId && c.organizationId === orgId)
    );
    await this.persistLocal();
    return this.data.credentials.length < before;
  }

  // ------------------------------------------------------------------------
  // Documents & Cloud Binary Blobs
  // ------------------------------------------------------------------------
  async listDocuments(candidateId: string): Promise<CandidateDocument[]> {
    await this.init();
    const orgId = this.enforceContext();
    const candId = this.normalizeId(candidateId);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.candidate_documents WHERE candidate_id = $1 AND organization_id = $2 ORDER BY uploaded_at DESC',
        [candId, orgId]
      );
      return res.rows.map((r) => this.mapRowToDocument(r));
    }

    return this.data.documents.filter((d) => d.candidateId === candId && d.organizationId === orgId);
  }

  async getDocument(docId: string): Promise<CandidateDocument | null> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(docId);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.candidate_documents WHERE id = $1 AND organization_id = $2 LIMIT 1',
        [targetId, orgId]
      );
      return res.rowCount ? this.mapRowToDocument(res.rows[0]) : null;
    }

    const doc = this.data.documents.find((d) => d.id === targetId && d.organizationId === orgId);
    return doc || null;
  }

  async getDocumentBlob(docId: string): Promise<Buffer | null> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(docId);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT file_data FROM public.candidate_document_blobs WHERE document_id = $1 AND organization_id = $2 LIMIT 1',
        [targetId, orgId]
      );
      if (res.rowCount && res.rows[0]?.file_data) {
        return Buffer.from(res.rows[0].file_data);
      }
    }
    return null;
  }

  async saveDocument(doc: CandidateDocument, fileBuffer?: Buffer): Promise<CandidateDocument> {
    await this.init();
    const orgId = this.enforceContext();
    const docId = this.normalizeId(doc.id);
    const candId = this.normalizeId(doc.candidateId);
    const normalized: CandidateDocument = {
      ...doc,
      id: docId,
      candidateId: candId,
      organizationId: orgId,
      storagePath: `/api/documents/${docId}/download`,
      updatedAt: new Date().toISOString(),
    };

    if (this.pgActive) {
      return this.pgUpsertDocument(normalized, fileBuffer);
    }

    const idx = this.data.documents.findIndex((d) => d.id === normalized.id);
    if (idx >= 0) {
      this.data.documents[idx] = normalized;
    } else {
      this.data.documents.unshift(normalized);
    }
    await this.persistLocal();
    return normalized;
  }

  async deleteDocument(docId: string): Promise<CandidateDocument | null> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(docId);

    const existing = await this.getDocument(targetId);
    if (!existing) return null;

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      await pool.query(
        'DELETE FROM public.candidate_documents WHERE id = $1 AND organization_id = $2',
        [targetId, orgId]
      );
      return existing;
    }

    this.data.documents = this.data.documents.filter((d) => !(d.id === targetId && d.organizationId === orgId));
    await this.persistLocal();
    return existing;
  }

  // ------------------------------------------------------------------------
  // Applications
  // ------------------------------------------------------------------------
  async listApplications(candidateId?: string): Promise<ApplicationRecord[]> {
    await this.init();
    const orgId = this.enforceContext();

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      if (candidateId) {
        const res = await pool.query(
          'SELECT * FROM public.applications WHERE organization_id = $1 AND candidate_id = $2 ORDER BY last_activity_at DESC',
          [orgId, this.normalizeId(candidateId)]
        );
        return res.rows.map((r) => this.mapRowToApplication(r));
      }
      const res = await pool.query(
        'SELECT * FROM public.applications WHERE organization_id = $1 ORDER BY last_activity_at DESC',
        [orgId]
      );
      return res.rows.map((r) => this.mapRowToApplication(r));
    }

    let list = this.data.applications.filter((a) => a.organizationId === orgId);
    if (candidateId) {
      const targetCand = this.normalizeId(candidateId);
      list = list.filter((a) => a.candidateId === targetCand);
    }
    return list;
  }

  async getApplication(id: string): Promise<ApplicationRecord | null> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(id);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.applications WHERE id = $1 AND organization_id = $2 LIMIT 1',
        [targetId, orgId]
      );
      return res.rowCount ? this.mapRowToApplication(res.rows[0]) : null;
    }

    const app = this.data.applications.find((a) => a.id === targetId && a.organizationId === orgId);
    return app || null;
  }

  async saveApplication(app: ApplicationRecord): Promise<ApplicationRecord> {
    await this.init();
    const orgId = this.enforceContext();
    const normalized: ApplicationRecord = {
      ...app,
      id: this.normalizeId(app.id),
      candidateId: this.normalizeId(app.candidateId),
      organizationId: orgId,
      lastActivityAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.pgActive) {
      return this.pgUpsertApplication(normalized);
    }

    const idx = this.data.applications.findIndex((a) => a.id === normalized.id);
    if (idx >= 0) {
      this.data.applications[idx] = normalized;
    } else {
      this.data.applications.unshift(normalized);
    }
    await this.persistLocal();
    return normalized;
  }

  async deleteApplication(id: string): Promise<boolean> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(id);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'DELETE FROM public.applications WHERE id = $1 AND organization_id = $2',
        [targetId, orgId]
      );
      return (res.rowCount ?? 0) > 0;
    }

    const before = this.data.applications.length;
    this.data.applications = this.data.applications.filter(
      (a) => !(a.id === targetId && a.organizationId === orgId)
    );
    await this.persistLocal();
    return this.data.applications.length < before;
  }

  // ------------------------------------------------------------------------
  // AI Settings (Encrypted Provider Keys in Supabase Postgres)
  // ------------------------------------------------------------------------
  async getAISettings(): Promise<AISettings> {
    await this.init();
    const orgId = this.context?.organizationId || (this.usePostgres ? DEFAULT_ORG_UUID : 'org-global-edu');

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.ai_provider_settings WHERE organization_id = $1 LIMIT 1',
        [toUuid(orgId)]
      );
      if (res.rowCount && res.rows[0]) {
        const row = res.rows[0];
        const meta = row.settings_data || {};
        return {
          provider: row.provider || 'gemini',
          model: row.model || 'gemini-2.5-flash',
          apiKey: decryptSecret(row.api_key_encrypted),
          geminiApiKey: decryptSecret(meta.geminiApiKeyEncrypted),
          openrouterApiKey: decryptSecret(meta.openrouterApiKeyEncrypted),
          deepseekApiKey: decryptSecret(meta.deepseekApiKeyEncrypted),
          openaiApiKey: decryptSecret(meta.openaiApiKeyEncrypted),
          endpoint: row.endpoint || undefined,
          privacyMode: Boolean(row.privacy_mode),
          temperature: row.temperature !== null ? Number(row.temperature) : 0.1,
          organizationId: row.organization_id,
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        };
      }
    }

    return this.data.aiSettings;
  }

  async updateAISettings(settings: Partial<AISettings>): Promise<AISettings> {
    await this.init();
    const orgId = this.enforceContext();
    const current = await this.getAISettings();
    const targetProvider = settings.provider || current.provider;
    const incomingKey =
      settings.apiKey && settings.apiKey !== '***CONFIGURED***' && settings.apiKey !== '***HIDDEN***'
        ? settings.apiKey.trim()
        : undefined;

    const merged: AISettings = {
      ...current,
      ...settings,
      apiKey: incomingKey !== undefined ? incomingKey : current.apiKey,
      geminiApiKey:
        settings.geminiApiKey ??
        (targetProvider === 'gemini' && incomingKey ? incomingKey : current.geminiApiKey),
      openrouterApiKey:
        settings.openrouterApiKey ??
        ((targetProvider === 'openrouter' || incomingKey?.startsWith('sk-or-')) && incomingKey
          ? incomingKey
          : current.openrouterApiKey),
      deepseekApiKey:
        settings.deepseekApiKey ??
        (targetProvider === 'deepseek' && incomingKey ? incomingKey : current.deepseekApiKey),
      openaiApiKey:
        settings.openaiApiKey ??
        (targetProvider === 'openai_compatible' && incomingKey ? incomingKey : current.openaiApiKey),
      organizationId: orgId,
      updatedAt: new Date().toISOString(),
    };

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const meta = {
        geminiApiKeyEncrypted: encryptSecret(merged.geminiApiKey),
        openrouterApiKeyEncrypted: encryptSecret(merged.openrouterApiKey),
        deepseekApiKeyEncrypted: encryptSecret(merged.deepseekApiKey),
        openaiApiKeyEncrypted: encryptSecret(merged.openaiApiKey),
      };
      await pool.query(
        `INSERT INTO public.ai_provider_settings (
           organization_id, provider, model, api_key_encrypted, endpoint, privacy_mode, temperature, settings_data, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         ON CONFLICT (organization_id) DO UPDATE SET
           provider = EXCLUDED.provider,
           model = EXCLUDED.model,
           api_key_encrypted = EXCLUDED.api_key_encrypted,
           endpoint = EXCLUDED.endpoint,
           privacy_mode = EXCLUDED.privacy_mode,
           temperature = EXCLUDED.temperature,
           settings_data = EXCLUDED.settings_data,
           updated_at = EXCLUDED.updated_at`,
        [
          orgId,
          merged.provider,
          merged.model,
          encryptSecret(merged.apiKey),
          merged.endpoint || null,
          Boolean(merged.privacyMode),
          merged.temperature ?? 0.1,
          JSON.stringify(meta),
          merged.updatedAt,
        ]
      );
      return merged;
    }

    this.data.aiSettings = merged;
    await this.persistLocal();
    return merged;
  }

  async saveAISettings(settings: Partial<AISettings>): Promise<AISettings> {
    return this.updateAISettings(settings);
  }

  // ------------------------------------------------------------------------
  // Organization, Admin Profile, Teammates & Country Desks
  // ------------------------------------------------------------------------
  async getOrganization(): Promise<Organization | null> {
    await this.init();
    const orgId = this.enforceContext();

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query('SELECT * FROM public.organizations WHERE id = $1 LIMIT 1', [orgId]);
      return res.rowCount ? this.mapRowToOrg(res.rows[0]) : null;
    }

    return this.data.organizations.find((o) => o.id === orgId) || null;
  }

  async updateOrganization(updates: Partial<Organization>): Promise<Organization> {
    await this.init();
    const orgId = this.enforceContext();
    const existing = await this.getOrganization();
    const now = new Date().toISOString();

    const updated: Organization = {
      ...(existing || {
        id: orgId,
        name: updates.name || 'Agency Workspace',
        slug: updates.slug || `org-${orgId.slice(0, 8)}`,
        createdAt: now,
      }),
      ...updates,
      id: orgId,
      updatedAt: now,
    };

    if (this.pgActive) {
      await this.pgUpsertOrganization(updated);
      return updated;
    }

    const idx = this.data.organizations.findIndex((o) => o.id === orgId);
    if (idx >= 0) {
      this.data.organizations[idx] = updated;
    } else {
      this.data.organizations.push(updated);
    }
    await this.persistLocal();
    return updated;
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(userId);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.user_profiles WHERE id = $1 AND organization_id = $2 LIMIT 1',
        [targetId, orgId]
      );
      return res.rowCount ? this.mapRowToUser(res.rows[0]) : null;
    }

    return this.data.users.find((u) => u.id === targetId && u.organizationId === orgId) || null;
  }

  async listTeamMembers(): Promise<UserProfile[]> {
    await this.init();
    const orgId = this.enforceContext();

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.user_profiles WHERE organization_id = $1 ORDER BY created_at ASC',
        [orgId]
      );
      return res.rows.map((r) => this.mapRowToUser(r));
    }

    return this.data.users.filter((u) => u.organizationId === orgId);
  }

  async saveTeamMember(
    member: Partial<UserProfile> & { email: string; fullName: string; loginPassword?: string }
  ): Promise<UserProfile> {
    await this.init();
    const orgId = this.enforceContext();
    const now = new Date().toISOString();
    const id = this.normalizeId(member.id);
    const existing = await this.getUserProfile(id);
    const allTeams = await this.listCountryTeams();

    const teamIds = (member.countryTeamIds ?? existing?.countryTeamIds ?? []).map((tid) =>
      this.normalizeId(tid)
    );
    const teamCountries = Array.from(
      new Set(allTeams.filter((t) => teamIds.includes(t.id)).flatMap((t) => t.countries))
    );
    const mergedCountries = Array.from(
      new Set([...(member.assignedCountries ?? []), ...teamCountries])
    );

    const { loginPassword, ...cleanMember } = member;

    const saved: UserProfile = existing
      ? {
          ...existing,
          ...cleanMember,
          id,
          organizationId: orgId,
          countryTeamIds: teamIds,
          assignedCountries:
            cleanMember.assignedCountries !== undefined ? mergedCountries : existing.assignedCountries,
          hasLoginPassword: Boolean(loginPassword?.trim()) || existing.hasLoginPassword || true,
          updatedAt: now,
        }
      : {
          id,
          organizationId: orgId,
          email: cleanMember.email,
          fullName: cleanMember.fullName,
          jobTitle: cleanMember.jobTitle || 'Admissions Consultant',
          phone: cleanMember.phone || '',
          officeLocation: cleanMember.officeLocation || '',
          timezone: cleanMember.timezone || 'UTC',
          languages: cleanMember.languages || ['English'],
          specializations: cleanMember.specializations || [],
          countryTeamIds: teamIds,
          assignedCountries: mergedCountries,
          maxActiveDossiers: cleanMember.maxActiveDossiers ?? 25,
          status: cleanMember.status || 'active',
          bio: cleanMember.bio || '',
          signatureLine: cleanMember.signatureLine || `${cleanMember.fullName} · Admissions Consultant`,
          notifications: cleanMember.notifications || {
            documentUploads: true,
            portalDeadlines: true,
            conflictAlerts: true,
            offerUpdates: true,
          },
          role: cleanMember.role || 'consultant',
          hasLoginPassword: true,
          lastActiveAt: now,
          createdAt: now,
          updatedAt: now,
        };

    if (this.pgActive) {
      await this.pgUpsertUser(saved, loginPassword?.trim());
      return saved;
    }

    const idx = this.data.users.findIndex((u) => u.id === id && u.organizationId === orgId);
    if (idx >= 0) {
      this.data.users[idx] = saved;
    } else {
      this.data.users.push(saved);
    }
    await this.persistLocal();
    return saved;
  }

  async setMemberPassword(userId: string, newPassword: string): Promise<boolean> {
    await this.init();
    const orgId = this.enforceContext();
    const uid = this.normalizeId(userId);
    const existing = await this.getUserProfile(uid);
    if (!existing) return false;

    if (this.pgActive) {
      await this.pgUpsertUser(existing, newPassword);
      return true;
    }
    return true;
  }

  async authenticateUser(email: string, password: string): Promise<UserProfile | null> {
    await this.init();
    const normEmail = email.trim().toLowerCase();

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.user_profiles WHERE lower(email) = $1 LIMIT 1',
        [normEmail]
      );
      if (!res.rowCount) return null;
      const row = res.rows[0];
      const storedHash = row.profile_meta?.passwordHash;
      // If a seeded user was created before password hashing existed, accept default password AdmitPilot!2027 and upgrade hash
      if (!storedHash) {
        if (password !== 'AdmitPilot!2027') return null;
        const user = this.mapRowToUser(row);
        await this.pgUpsertUser(user, password);
        return { ...user, hasLoginPassword: true };
      }
      if (!verifyPassword(password, storedHash)) return null;
      const user = this.mapRowToUser(row);
      return user;
    }

    const found = this.data.users.find((u) => u.email.toLowerCase() === normEmail);
    return found || null;
  }

  async registerAgency(input: {
    agencyName: string;
    fullName: string;
    email: string;
    password: string;
    headquarters?: string;
    defaultIntake?: string;
    operatingCountries?: string[];
  }): Promise<{ organization: Organization; user: UserProfile }> {
    await this.init();
    const normEmail = input.email.trim().toLowerCase();
    const now = new Date().toISOString();

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const existing = await pool.query(
        'SELECT id FROM public.user_profiles WHERE lower(email) = $1 LIMIT 1',
        [normEmail]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        throw new Error('An account with this email already exists');
      }
    } else {
      if (this.data.users.some((u) => u.email.toLowerCase() === normEmail)) {
        throw new Error('An account with this email already exists');
      }
    }

    const orgId = globalThis.crypto.randomUUID();
    const userId = globalThis.crypto.randomUUID();
    const deskId = globalThis.crypto.randomUUID();
    const slugBase = input.agencyName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32);
    const slug = `${slugBase || 'agency'}-${orgId.slice(0, 6)}`;
    const countries =
      Array.isArray(input.operatingCountries) && input.operatingCountries.length > 0
        ? input.operatingCountries
        : ['United Kingdom', 'Canada', 'United States', 'Australia'];

    const organization: Organization = {
      id: orgId,
      name: input.agencyName.trim(),
      slug,
      primaryEmail: normEmail,
      headquarters: input.headquarters?.trim() || 'Main Office',
      defaultIntake: input.defaultIntake?.trim() || 'September 2027',
      operatingCountries: countries,
      autoAssignByCountry: true,
      requireDualReview: true,
      createdAt: now,
      updatedAt: now,
    };

    const user: UserProfile = {
      id: userId,
      organizationId: orgId,
      email: normEmail,
      fullName: input.fullName.trim(),
      role: 'org_admin',
      jobTitle: 'Founder & Agency Owner',
      officeLocation: input.headquarters?.trim() || 'Main Office',
      timezone: 'UTC',
      languages: ['English'],
      specializations: countries.slice(0, 3),
      countryTeamIds: [deskId],
      assignedCountries: countries,
      maxActiveDossiers: 50,
      status: 'active',
      hasLoginPassword: true,
      notifications: {
        documentUploads: true,
        portalDeadlines: true,
        conflictAlerts: true,
        offerUpdates: true,
      },
      createdAt: now,
      updatedAt: now,
    };

    const initialDesk: CountryTeam = {
      id: deskId,
      organizationId: orgId,
      name: `${countries[0] || 'Primary'} Admissions Desk`,
      code: 'MAIN',
      countries,
      leadUserId: userId,
      description: 'Default admissions desk created during agency onboarding',
      intakeFocus: organization.defaultIntake || 'September 2027',
      createdAt: now,
      updatedAt: now,
    };

    if (this.pgActive) {
      await this.pgUpsertOrganization(organization);
      await this.pgUpsertUser(user, input.password);
      await this.pgUpsertCountryTeam(initialDesk);
    } else {
      this.data.organizations.push(organization);
      this.data.users.push(user);
      this.data.countryTeams.push(initialDesk);
      await this.persistLocal();
    }

    return { organization, user };
  }

  async deleteTeamMember(userId: string): Promise<boolean> {
    await this.init();
    const orgId = this.enforceContext();
    const targetId = this.normalizeId(userId);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'DELETE FROM public.user_profiles WHERE id = $1 AND organization_id = $2',
        [targetId, orgId]
      );
      return (res.rowCount ?? 0) > 0;
    }

    const before = this.data.users.length;
    this.data.users = this.data.users.filter((u) => !(u.id === targetId && u.organizationId === orgId));
    if (this.data.users.length === before) return false;
    await this.persistLocal();
    return true;
  }

  async listCountryTeams(): Promise<CountryTeam[]> {
    await this.init();
    const orgId = this.enforceContext();

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.country_teams WHERE organization_id = $1 ORDER BY created_at ASC',
        [orgId]
      );
      return res.rows.map((r) => this.mapRowToCountryTeam(r));
    }

    return this.data.countryTeams.filter((t) => t.organizationId === orgId);
  }

  async saveCountryTeam(
    team: Partial<CountryTeam> & { name: string; code: string; countries: string[] },
    memberIds?: string[]
  ): Promise<CountryTeam> {
    await this.init();
    const orgId = this.enforceContext();
    const now = new Date().toISOString();
    const id = this.normalizeId(team.id);
    const existingList = await this.listCountryTeams();
    const existing = existingList.find((t) => t.id === id);

    const savedTeam: CountryTeam = existing
      ? {
          ...existing,
          ...team,
          id,
          organizationId: orgId,
          leadUserId: team.leadUserId ? this.normalizeId(team.leadUserId) : undefined,
          updatedAt: now,
        }
      : {
          id,
          organizationId: orgId,
          name: team.name,
          code: team.code.toUpperCase(),
          countries: team.countries,
          leadUserId: team.leadUserId ? this.normalizeId(team.leadUserId) : undefined,
          description: team.description || '',
          intakeFocus: team.intakeFocus || '',
          createdAt: now,
          updatedAt: now,
        };

    if (this.pgActive) {
      await this.pgUpsertCountryTeam(savedTeam);
    } else {
      const idx = this.data.countryTeams.findIndex((t) => t.id === id && t.organizationId === orgId);
      if (idx >= 0) this.data.countryTeams[idx] = savedTeam;
      else this.data.countryTeams.push(savedTeam);
    }

    const effectiveMemberIds =
      memberIds !== undefined
        ? Array.from(
            new Set([
              ...memberIds.map((m) => this.normalizeId(m)),
              ...(savedTeam.leadUserId ? [savedTeam.leadUserId] : []),
            ])
          )
        : undefined;

    if (effectiveMemberIds !== undefined) {
      const users = await this.listTeamMembers();
      const allTeams = await this.listCountryTeams();
      for (const u of users) {
        const currentTeams = new Set(u.countryTeamIds || []);
        if (effectiveMemberIds.includes(u.id)) currentTeams.add(id);
        else currentTeams.delete(id);
        const nextTeamIds = Array.from(currentTeams);
        const nextCountries = Array.from(
          new Set(allTeams.filter((ct) => nextTeamIds.includes(ct.id)).flatMap((ct) => ct.countries))
        );
        await this.saveTeamMember({
          ...u,
          countryTeamIds: nextTeamIds,
          assignedCountries: nextCountries,
        });
      }
    } else if (savedTeam.leadUserId) {
      await this.setCountryTeamMembership(id, savedTeam.leadUserId, 'add');
    }

    await this.persistLocal();
    return savedTeam;
  }

  async setCountryTeamMembership(
    teamId: string,
    userId: string,
    action: 'add' | 'remove'
  ): Promise<UserProfile | null> {
    await this.init();
    this.enforceContext();
    const normTeamId = this.normalizeId(teamId);
    const normUserId = this.normalizeId(userId);

    const allTeams = await this.listCountryTeams();
    const team = allTeams.find((t) => t.id === normTeamId);
    const user = await this.getUserProfile(normUserId);
    if (!team || !user) return null;

    const teamSet = new Set(user.countryTeamIds || []);
    if (action === 'add') teamSet.add(normTeamId);
    else teamSet.delete(normTeamId);

    const nextTeamIds = Array.from(teamSet);
    const nextCountries = Array.from(
      new Set(allTeams.filter((ct) => nextTeamIds.includes(ct.id)).flatMap((ct) => ct.countries))
    );

    if (action === 'remove' && team.leadUserId === normUserId) {
      await this.saveCountryTeam({ ...team, leadUserId: undefined });
    }

    return this.saveTeamMember({
      ...user,
      countryTeamIds: nextTeamIds,
      assignedCountries: nextCountries,
    });
  }

  async deleteCountryTeam(teamId: string): Promise<boolean> {
    await this.init();
    const orgId = this.enforceContext();
    const normTeamId = this.normalizeId(teamId);

    if (this.pgActive) {
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'DELETE FROM public.country_teams WHERE id = $1 AND organization_id = $2',
        [normTeamId, orgId]
      );
      if (!res.rowCount) return false;
      const users = await this.listTeamMembers();
      for (const u of users) {
        if ((u.countryTeamIds || []).includes(normTeamId)) {
          await this.saveTeamMember({
            ...u,
            countryTeamIds: (u.countryTeamIds || []).filter((id) => id !== normTeamId),
          });
        }
      }
      return true;
    }

    const before = this.data.countryTeams.length;
    this.data.countryTeams = this.data.countryTeams.filter(
      (t) => !(t.id === normTeamId && t.organizationId === orgId)
    );
    if (this.data.countryTeams.length === before) return false;
    await this.persistLocal();
    return true;
  }

  // ------------------------------------------------------------------------
  // University & Program Catalog (Per-Tenant)
  // ------------------------------------------------------------------------
  private universityTableReady = false;

  private async ensureUniversityTable(): Promise<void> {
    if (this.universityTableReady || !this.pgActive) return;
    const pool = getPostgresPool()!;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.university_catalog (
        id TEXT PRIMARY KEY,
        organization_id UUID NOT NULL,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        catalog_data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_university_catalog_org ON public.university_catalog (organization_id);
    `);
    this.universityTableReady = true;
  }

  async listUniversities(): Promise<UniversityCatalogItem[]> {
    await this.init();
    const orgId = this.enforceContext();

    if (this.pgActive) {
      await this.ensureUniversityTable();
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'SELECT * FROM public.university_catalog WHERE organization_id = $1 ORDER BY name ASC',
        [orgId]
      );
      if (res.rowCount && res.rowCount > 0) {
        return res.rows.map((r) => r.catalog_data as UniversityCatalogItem);
      }
      const defaults = buildDefaultUniversityCatalog(orgId);
      for (const item of defaults) {
        await this.saveUniversity({ ...item, id: `${orgId.slice(0, 8)}-${item.id}` });
      }
      const seeded = await pool.query(
        'SELECT * FROM public.university_catalog WHERE organization_id = $1 ORDER BY name ASC',
        [orgId]
      );
      return seeded.rows.map((r) => r.catalog_data as UniversityCatalogItem);
    }

    if (!Array.isArray(this.data.universityCatalog)) {
      this.data.universityCatalog = [];
    }
    const existing = this.data.universityCatalog.filter((u) => u.organizationId === orgId);
    if (existing.length > 0) return existing;

    const defaults = buildDefaultUniversityCatalog(orgId).map((item) => ({
      ...item,
      id: `${orgId.slice(0, 8)}-${item.id}`,
    }));
    this.data.universityCatalog.push(...defaults);
    await this.persistLocal();
    return defaults;
  }

  async saveUniversity(input: Partial<UniversityCatalogItem> & { name: string; country: string }): Promise<UniversityCatalogItem> {
    await this.init();
    const orgId = this.enforceContext();
    const now = new Date().toISOString();
    const id = input.id || globalThis.crypto.randomUUID();
    const item: UniversityCatalogItem = {
      id,
      organizationId: orgId,
      name: input.name.trim(),
      country: input.country.trim(),
      city: input.city?.trim() || undefined,
      portalUrl: input.portalUrl?.trim() || undefined,
      isPartner: Boolean(input.isPartner),
      programs: Array.isArray(input.programs) ? input.programs : [],
      notes: input.notes?.trim() || undefined,
      createdAt: input.createdAt || now,
      updatedAt: now,
    };

    if (this.pgActive) {
      await this.ensureUniversityTable();
      const pool = getPostgresPool()!;
      await pool.query(
        `INSERT INTO public.university_catalog (id, organization_id, name, country, catalog_data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           country = EXCLUDED.country,
           catalog_data = EXCLUDED.catalog_data,
           updated_at = EXCLUDED.updated_at`,
        [item.id, orgId, item.name, item.country, JSON.stringify(item), item.createdAt, now]
      );
      return item;
    }

    if (!Array.isArray(this.data.universityCatalog)) {
      this.data.universityCatalog = [];
    }
    const idx = this.data.universityCatalog.findIndex(
      (u) => u.id === item.id && u.organizationId === orgId
    );
    if (idx >= 0) this.data.universityCatalog[idx] = item;
    else this.data.universityCatalog.push(item);
    await this.persistLocal();
    return item;
  }

  async deleteUniversity(universityId: string): Promise<boolean> {
    await this.init();
    const orgId = this.enforceContext();

    if (this.pgActive) {
      await this.ensureUniversityTable();
      const pool = getPostgresPool()!;
      const res = await pool.query(
        'DELETE FROM public.university_catalog WHERE id = $1 AND organization_id = $2',
        [universityId, orgId]
      );
      return (res.rowCount ?? 0) > 0;
    }

    if (!Array.isArray(this.data.universityCatalog)) return false;
    const before = this.data.universityCatalog.length;
    this.data.universityCatalog = this.data.universityCatalog.filter(
      (u) => !(u.id === universityId && u.organizationId === orgId)
    );
    if (this.data.universityCatalog.length === before) return false;
    await this.persistLocal();
    return true;
  }
}
