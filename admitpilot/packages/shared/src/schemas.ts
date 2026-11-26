import { z } from 'zod';

export const CandidatePersonalSchema = z.object({
  legalGivenName: z.string().min(1, 'Given name is required'),
  middleName: z.string().optional().default(''),
  familyName: z.string().min(1, 'Family name is required'),
  preferredName: z.string().optional().default(''),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD'),
  gender: z.string().optional().default(''),
  nationality: z.string().min(1, 'Nationality is required'),
  countryOfBirth: z.string().optional().default(''),
  cityOfBirth: z.string().optional().default(''),
  maritalStatus: z.string().optional().default(''),
  nationalId: z.string().optional().default(''),
  citizenships: z.array(z.string()).optional().default([]),
});

export const CandidateContactSchema = z.object({
  email: z.string().email('Valid email is required'),
  altEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(3, 'Phone is required'),
  altPhone: z.string().optional().default(''),
  whatsapp: z.string().optional().default(''),
  currentAddress: z.string().min(1, 'Street address is required'),
  permanentAddress: z.string().optional().default(''),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State/province is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

export const CandidatePassportSchema = z.object({
  passportNumber: z.string().min(3, 'Passport number is required'),
  fullName: z.string().min(1, 'Full name is required'),
  nationality: z.string().min(1, 'Nationality is required'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD'),
  issuingCountry: z.string().min(1, 'Issuing country is required'),
  placeOfIssue: z.string().optional().default(''),
  issueDate: z.string().optional().default(''),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD'),
});

export const EducationRecordSchema = z.object({
  id: z.string().uuid(),
  qualificationLevel: z.enum(['High School', 'Associate', "Bachelor's", "Master's", 'Doctorate', 'Diploma', 'Other']),
  degreeTitle: z.string().min(1),
  major: z.string().min(1),
  institution: z.string().min(1),
  campus: z.string().optional().default(''),
  country: z.string().min(1),
  startDate: z.string().optional().default(''),
  endDate: z.string().optional().default(''),
  awardDate: z.string().optional().default(''),
  gpa: z.string().optional().default(''),
  gradingScale: z.string().optional().default(''),
  percentage: z.string().optional().default(''),
  obtainedMarks: z.string().optional().default(''),
  totalMarks: z.string().optional().default(''),
  status: z.enum(['Completed', 'Enrolled', 'Incomplete']).default('Completed'),
});

export const EnglishTestRecordSchema = z.object({
  id: z.string().uuid(),
  testType: z.enum(['IELTS', 'TOEFL', 'PTE', 'Duolingo', 'Other']),
  testDate: z.string(),
  referenceNumber: z.string().optional().default(''),
  overallScore: z.string(),
  listening: z.string().optional().default(''),
  reading: z.string().optional().default(''),
  writing: z.string().optional().default(''),
  speaking: z.string().optional().default(''),
  expiryDate: z.string().optional().default(''),
});

export const EmploymentRecordSchema = z.object({
  id: z.string().uuid(),
  company: z.string().min(1),
  jobTitle: z.string().min(1),
  employmentType: z.enum(['Full-time', 'Part-time', 'Internship', 'Contract']).default('Full-time'),
  startDate: z.string(),
  endDate: z.string().optional().default(''),
  isCurrent: z.boolean().optional().default(false),
  responsibilities: z.string().optional().default(''),
  location: z.string().optional().default(''),
});

export const ExtractedFieldResultSchema = z.object({
  fieldKey: z.string(),
  label: z.string(),
  value: z.any(),
  confidence: z.number().min(0).max(1),
  snippet: z.string().optional(),
  page: z.number().optional(),
});

export const DocumentExtractionResultSchema = z.object({
  documentCategory: z.enum([
    'passport',
    'cv',
    'transcript',
    'degree',
    'english_test',
    'sop',
    'lor',
    'experience',
    'financial',
    'other',
  ]),
  fields: z.array(ExtractedFieldResultSchema),
  rawSummary: z.string().optional(),
});

export const AIMatchingResponseSchema = z.object({
  mappings: z.array(
    z.object({
      fieldId: z.string(),
      candidateFieldKey: z.string().nullable(),
      value: z.any().nullable(),
      confidence: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
    })
  ),
});

export const AISettingsSchema = z.object({
  provider: z.enum(['gemini', 'openrouter', 'ollama', 'deepseek', 'openai_compatible']),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  endpoint: z.string().optional(),
  privacyMode: z.boolean().default(false),
  temperature: z.number().min(0).max(1).default(0.1),
});

