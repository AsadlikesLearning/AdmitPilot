export type UserRole = 'org_admin' | 'manager' | 'consultant' | 'reviewer';

export type MemberStatus = 'active' | 'on_leave' | 'invited' | 'suspended';

export interface UserNotificationPrefs {
  documentUploads: boolean;
  portalDeadlines: boolean;
  conflictAlerts: boolean;
  offerUpdates: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  primaryEmail?: string;
  phone?: string;
  headquarters?: string;
  website?: string;
  defaultIntake?: string;
  operatingCountries?: string[];
  requireDualReview?: boolean;
  autoAssignByCountry?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CountryTeam {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  countries: string[];
  leadUserId?: string;
  description?: string;
  intakeFocus?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  phone?: string;
  officeLocation?: string;
  timezone?: string;
  languages?: string[];
  specializations?: string[];
  countryTeamIds?: string[];
  assignedCountries?: string[];
  maxActiveDossiers?: number;
  status?: MemberStatus;
  bio?: string;
  signatureLine?: string;
  notifications?: UserNotificationPrefs;
  role: UserRole;
  hasLoginPassword?: boolean;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type DocumentCategory =
  | 'passport'
  | 'cv'
  | 'transcript'
  | 'degree'
  | 'english_test'
  | 'sop'
  | 'lor'
  | 'experience'
  | 'financial'
  | 'other';

export type VerificationStatus =
  | 'verified'
  | 'extracted'
  | 'derived'
  | 'conflicting'
  | 'missing';

export interface FieldEvidence {
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  pageNumber?: number;
  snippet?: string;
  confidence: number; // 0 to 1
  status: VerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  extractedAt: string;
  note?: string;
}

export interface EducationRecord {
  id: string;
  qualificationLevel: 'High School' | 'Associate' | "Bachelor's" | "Master's" | 'Doctorate' | 'Diploma' | 'Other';
  degreeTitle: string;
  major: string;
  institution: string;
  campus?: string;
  country: string;
  startDate?: string;
  endDate?: string;
  awardDate?: string;
  gpa?: string;
  gradingScale?: string;
  percentage?: string;
  obtainedMarks?: string;
  totalMarks?: string;
  status: 'Completed' | 'Enrolled' | 'Incomplete';
}

export interface EnglishTestRecord {
  id: string;
  testType: 'IELTS' | 'TOEFL' | 'PTE' | 'Duolingo' | 'Other';
  testDate: string;
  referenceNumber?: string;
  overallScore: string;
  listening?: string;
  reading?: string;
  writing?: string;
  speaking?: string;
  expiryDate?: string;
}

export interface EmploymentRecord {
  id: string;
  company: string;
  jobTitle: string;
  employmentType: 'Full-time' | 'Part-time' | 'Internship' | 'Contract';
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  responsibilities?: string;
  location?: string;
}

export interface CandidatePersonal {
  legalGivenName: string;
  middleName?: string;
  familyName: string;
  preferredName?: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender?: string;
  nationality: string;
  countryOfBirth?: string;
  cityOfBirth?: string;
  maritalStatus?: string;
  nationalId?: string;
  citizenships?: string[];
}

export interface CandidateContact {
  email: string;
  managedStudentEmail?: string;
  altEmail?: string;
  phone: string;
  altPhone?: string;
  whatsapp?: string;
  currentAddress: string;
  permanentAddress?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type PortalCredentialType =
  | 'dedicated_email'
  | 'university_portal'
  | 'ucas'
  | 'common_app'
  | 'uni_assist'
  | 'studielink'
  | 'visa_portal'
  | 'english_test'
  | 'other';

export interface CandidatePortalCredential {
  id: string;
  candidateId: string;
  organizationId: string;
  label: string;
  portalType: PortalCredentialType;
  portalUrl?: string;
  loginEmail: string;
  username?: string;
  password?: string;
  hasPassword?: boolean;
  passwordMasked?: string;
  recoveryEmail?: string;
  recoveryPhone?: string;
  pinOrSecurityNote?: string;
  isPrimaryStudentEmail?: boolean;
  createdByConsultantId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidatePassport {
  passportNumber: string;
  fullName: string;
  nationality: string;
  dateOfBirth: string;
  issuingCountry: string;
  placeOfIssue?: string;
  issueDate?: string;
  expiryDate: string;
}

export interface CandidateAdditional {
  sponsorDetails?: string;
  financialSupport?: string;
  emergencyContacts?: string;
  addressHistory?: string;
  preferredCountries?: string[];
  preferredCourses?: string[];
  preferredIntakes?: string[];
  budget?: string;
  studyGaps?: string;
  notes?: string;
}

export interface CandidateProfile {
  id: string;
  organizationId: string;
  assignedConsultantId?: string;
  countryTeamId?: string;
  targetCountries?: string[];
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived' | 'on_hold';

  personal: CandidatePersonal;
  contact: CandidateContact;
  passport?: CandidatePassport;
  education: EducationRecord[];
  englishTests: EnglishTestRecord[];
  employment: EmploymentRecord[];
  additional: CandidateAdditional;

  // Metadata for auditing & verification
  evidence: Record<string, FieldEvidence>;
  conflicts: Record<string, { candidateValue: string; documentValue: string; documentName: string }[]>;
}

export interface ExtractedFieldMeta {
  value: any;
  confidence: number;
  label?: string;
  targetPath?: string;
  page?: number;
  snippet?: string;
  source?: 'mrz' | 'regex' | 'ai' | 'ai_vision' | 'manual';
  verified?: boolean;
}

export interface DocumentConflict {
  fieldKey: string;
  label?: string;
  candidateValue: string;
  documentValue: string;
  documentName: string;
  resolved?: boolean;
}

export interface CandidateDocument {
  id: string;
  candidateId: string;
  organizationId: string;
  category: DocumentCategory;
  fileName: string;
  portalFileName?: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  diskFileName?: string;
  extractedText?: string;
  extractedFields?: Record<string, ExtractedFieldMeta>;
  conflicts?: DocumentConflict[];
  extractionMethod?: 'text' | 'ocr' | 'mrz+text' | 'ai_vision' | 'hybrid_ai';
  verificationStatus?: 'verified' | 'needs_review' | 'conflict';
  uploadedAt: string;
  ocrApplied?: boolean;
  updatedAt?: string;
}

export type ApplicationStatus =
  | 'draft'
  | 'preparing_documents'
  | 'ready_for_review'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'conditional_offer'
  | 'unconditional_offer'
  | 'rejected'
  | 'withdrawn'
  | 'enrolled';

export interface ApplicationRequirementItem {
  name: string;
  category: 'document' | 'qualification' | 'test' | 'other';
  detectedOnPage: boolean;
  status: 'available' | 'missing' | 'requires_verification' | 'unknown';
  sourceSnippet?: string;
}

export interface UniversityRequirementReport {
  institutionName: string;
  programName?: string;
  hostname: string;
  applicationStage?: string;
  requirements: ApplicationRequirementItem[];
  overallReadiness: 'Ready' | 'Needs Attention' | 'Incomplete';
  summary: string;
}

export type ApplicationPriority = 'high' | 'medium' | 'low';
export type ApplicationFeeStatus = 'unpaid' | 'paid' | 'waived';
export type ScholarshipStatus = 'none' | 'eligible' | 'applied' | 'awarded' | 'rejected';
export type CasStatus = 'not_started' | 'documents_pending' | 'requested' | 'issued';
export type VisaStatus = 'not_started' | 'preparing' | 'lodged' | 'biometrics_done' | 'granted' | 'refused';
export type CommissionStatus = 'none' | 'pending' | 'invoiced' | 'received';

export interface ApplicationDocumentChecklistItem {
  id: string;
  category: DocumentCategory;
  label: string;
  required: boolean;
  submitted: boolean;
  documentId?: string;
}

export interface ApplicationOfferCondition {
  id: string;
  text: string;
  met: boolean;
  dueDate?: string;
}

export interface ApplicationTimelineEvent {
  id: string;
  timestamp: string;
  actor?: string;
  type: 'status' | 'note' | 'document' | 'offer' | 'fee' | 'visa';
  text: string;
}

export interface ApplicationRecord {
  id: string;
  candidateId: string;
  organizationId: string;
  assignedConsultantId?: string;
  countryTeamId?: string;
  portalCredentialId?: string;
  institutionName: string;
  programName: string;
  degreeLevel?: "Bachelor's" | "Master's" | 'Doctorate' | 'Foundation' | 'Diploma' | 'Other';
  campus?: string;
  country: string;
  intake?: string;
  portalUrl?: string;
  referenceNumber?: string;
  status: ApplicationStatus;
  priority?: ApplicationPriority;
  deadline?: string;
  submissionDate?: string;
  tuitionFee?: string;
  applicationFee?: string;
  applicationFeeStatus?: ApplicationFeeStatus;
  scholarshipName?: string;
  scholarshipAmount?: string;
  scholarshipStatus?: ScholarshipStatus;
  documentChecklist?: ApplicationDocumentChecklistItem[];
  offerConditions?: ApplicationOfferCondition[];
  depositAmount?: string;
  depositDeadline?: string;
  depositPaid?: boolean;
  commissionRate?: string;
  commissionAmount?: string;
  commissionStatus?: CommissionStatus;
  casStatus?: CasStatus;
  casNumber?: string;
  visaStatus?: VisaStatus;
  timeline?: ApplicationTimelineEvent[];
  notes?: string;
  lastActivityAt: string;
  readinessReport?: UniversityRequirementReport;
  createdAt: string;
  updatedAt?: string;
}

export type FormFieldKind = 'input' | 'select' | 'combobox' | 'datepicker' | 'checkbox' | 'radio' | 'textarea' | 'file';

export interface FormField {
  id: string;
  kind: FormFieldKind;
  type: string;
  name: string;
  label: string;
  placeholder?: string;
  accept?: string;
  required: boolean;
  maxLength?: number | null;
  options?: string[];
  currentValue?: any;
  selector?: string;
  sectionHeading?: string;
}

export interface FileFieldMapping {
  fieldId: string;
  fieldLabel: string;
  required: boolean;
  accept?: string;
  expectedCategory: DocumentCategory;
  matchedDocumentId?: string;
  matchedFileName?: string;
  portalFileName?: string;
  mimeType?: string;
  fileSize?: number;
  confidence: MatchConfidence;
  reasoning: string;
  status: 'approved' | 'missing' | 'skipped';
}

export type MatchConfidence = 'high' | 'medium' | 'low';

export interface FieldMapping {
  fieldId: string;
  fieldLabel: string;
  candidateFieldKey: string;
  suggestedValue: any;
  confidence: MatchConfidence;
  confidenceScore: number; // 0.0 to 1.0
  reasoning: string;
  sourceDocSnippet?: string;
  status: 'approved' | 'rejected' | 'custom';
  customValue?: any;
  isConfirmedFact: boolean;
}

export type AIProvider = 'gemini' | 'openrouter' | 'deepseek' | 'ollama' | 'openai_compatible';

export interface AISettings {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  deepseekApiKey?: string;
  openaiApiKey?: string;
  hasConfiguredKey?: boolean;
  keySource?: 'dashboard' | 'env' | 'local' | 'none';
  endpoint?: string;
  privacyMode: boolean; // if true, strictly local OCR/text extraction; no remote payload
  temperature?: number;
  organizationId?: string;
  updatedAt?: string;
}

export interface UniversityProgram {
  id: string;
  name: string;
  degreeLevel: "Bachelor's" | "Master's" | 'Doctorate' | 'Foundation' | 'Diploma' | 'Other';
  intake?: string;
  deadline?: string;
  tuitionFee?: string;
  applicationFee?: string;
  minGpa?: number; // 4.0 scale
  minIelts?: number;
  requiredDocs?: DocumentCategory[];
}

export interface UniversityCatalogItem {
  id: string;
  organizationId: string;
  name: string;
  country: string;
  city?: string;
  portalUrl?: string;
  isPartner?: boolean;
  programs: UniversityProgram[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EligibilityCheckResult {
  status: 'eligible' | 'borderline' | 'check_required';
  checks: Array<{
    label: string;
    met: boolean | null;
    detail: string;
  }>;
}

