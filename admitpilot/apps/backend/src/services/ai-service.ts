import '../config/env.js';
import {
  AIProvider,
  AISettings,
  CandidateProfile,
  DocumentCategory,
  FormField,
  FieldMapping,
  UniversityRequirementReport,
} from 'admitpilot-shared';

export interface CompletionOptions {
  systemPrompt?: string;
  jsonMode?: boolean;
  maxTokens?: number;
  inlineMedia?: { mimeType: string; base64Data: string };
  overrideSettings?: Partial<AISettings>;
}

export interface ConnectionTestResult {
  ok: boolean;
  provider: AIProvider;
  model: string;
  latencyMs: number;
  message: string;
  reply?: string;
}

export class AIService {
  private settings: AISettings;

  constructor(settings?: Partial<AISettings>) {
    this.settings = {
      provider: settings?.provider || 'gemini',
      model: settings?.model || this.defaultModelFor(settings?.provider || 'gemini'),
      apiKey: settings?.apiKey || '',
      geminiApiKey: settings?.geminiApiKey || '',
      deepseekApiKey: settings?.deepseekApiKey || '',
      openaiApiKey: settings?.openaiApiKey || '',
      endpoint: settings?.endpoint || '',
      privacyMode: settings?.privacyMode ?? false,
      temperature: settings?.temperature ?? 0.1,
    };
  }

  public defaultModelFor(provider: AIProvider): string {
    switch (provider) {
      case 'gemini':
        return 'gemini-2.5-flash';
      case 'deepseek':
        return 'deepseek-chat';
      case 'ollama':
        return process.env.OLLAMA_MODEL || 'llama3';
      case 'openai_compatible':
        return 'gpt-4o-mini';
    }
  }

  public updateSettings(newSettings: Partial<AISettings>) {
    const targetProvider = newSettings.provider || this.settings.provider;
    const incomingKey =
      newSettings.apiKey && newSettings.apiKey !== '***CONFIGURED***' && newSettings.apiKey !== '***HIDDEN***'
        ? newSettings.apiKey.trim()
        : undefined;

    this.settings = {
      ...this.settings,
      ...newSettings,
      apiKey: incomingKey !== undefined ? incomingKey : this.settings.apiKey,
      geminiApiKey:
        newSettings.geminiApiKey ??
        (targetProvider === 'gemini' && incomingKey ? incomingKey : this.settings.geminiApiKey),
      deepseekApiKey:
        newSettings.deepseekApiKey ??
        (targetProvider === 'deepseek' && incomingKey ? incomingKey : this.settings.deepseekApiKey),
      openaiApiKey:
        newSettings.openaiApiKey ??
        (targetProvider === 'openai_compatible' && incomingKey ? incomingKey : this.settings.openaiApiKey),
    };
  }

  public resolveKeyInfo(
    provider: AIProvider = this.settings.provider,
    overrideKey?: string
  ): { key: string; source: 'dashboard' | 'env' | 'local' | 'none' } {
    if (provider === 'ollama') {
      return { key: '', source: 'local' };
    }

    if (overrideKey && overrideKey !== '***CONFIGURED***' && overrideKey !== '***HIDDEN***' && overrideKey.trim()) {
      return { key: overrideKey.trim(), source: 'dashboard' };
    }

    if (provider === 'gemini') {
      const saved = this.settings.geminiApiKey || (this.settings.provider === 'gemini' ? this.settings.apiKey : '');
      if (saved) return { key: saved, source: 'dashboard' };
      if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, source: 'env' };
      return { key: '', source: 'none' };
    }

    if (provider === 'deepseek') {
      const saved = this.settings.deepseekApiKey || (this.settings.provider === 'deepseek' ? this.settings.apiKey : '');
      if (saved) return { key: saved, source: 'dashboard' };
      if (process.env.DEEPSEEK_API_KEY) return { key: process.env.DEEPSEEK_API_KEY, source: 'env' };
      return { key: '', source: 'none' };
    }

    if (provider === 'openai_compatible') {
      const saved =
        this.settings.openaiApiKey || (this.settings.provider === 'openai_compatible' ? this.settings.apiKey : '');
      if (saved) return { key: saved, source: 'dashboard' };
      if (process.env.OPENAI_API_KEY) return { key: process.env.OPENAI_API_KEY, source: 'env' };
      return { key: '', source: 'none' };
    }

    return { key: '', source: 'none' };
  }

  public isConfigured(overrideSettings?: Partial<AISettings>): boolean {
    const provider = overrideSettings?.provider || this.settings.provider;
    if (provider === 'ollama') return true;
    const { key } = this.resolveKeyInfo(provider, overrideSettings?.apiKey);
    return Boolean(key);
  }

  private canRunCloudOrLocalInference(): boolean {
    if (this.settings.privacyMode && this.settings.provider !== 'ollama') {
      return false;
    }
    return this.isConfigured();
  }

  public getPublicSettings(): AISettings {
    const { key, source } = this.resolveKeyInfo(this.settings.provider);
    return {
      provider: this.settings.provider,
      model: this.settings.model,
      apiKey: key ? '***CONFIGURED***' : '',
      hasConfiguredKey: this.settings.provider === 'ollama' ? true : Boolean(key),
      keySource: source,
      endpoint: this.settings.endpoint,
      privacyMode: this.settings.privacyMode,
      temperature: this.settings.temperature,
      organizationId: this.settings.organizationId,
      updatedAt: this.settings.updatedAt,
    };
  }

  private normalizeOpenAIBaseUrl(provider: AIProvider, rawEndpoint?: string): string {
    const fallback =
      provider === 'deepseek'
        ? 'https://api.deepseek.com/v1'
        : process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1';
    let base = (rawEndpoint || fallback).trim().replace(/\/+$/, '');
    if (provider === 'deepseek' && base === 'https://api.deepseek.com') {
      base = 'https://api.deepseek.com/v1';
    }
    return base;
  }

  /**
   * Unified LLM completion dispatcher across Google Gemini, DeepSeek, Ollama, and OpenAI-compatible gateways
   */
  async complete(prompt: string, options: CompletionOptions | string = {}): Promise<string> {
    const opts: CompletionOptions = typeof options === 'string' ? { systemPrompt: options } : options;
    const effectiveProvider = opts.overrideSettings?.provider || this.settings.provider;
    const effectiveModel =
      opts.overrideSettings?.model || this.settings.model || this.defaultModelFor(effectiveProvider);
    const effectiveEndpoint = opts.overrideSettings?.endpoint ?? this.settings.endpoint;
    const effectiveTemp = opts.overrideSettings?.temperature ?? this.settings.temperature ?? 0.1;

    if (effectiveProvider === 'gemini') {
      const { key } = this.resolveKeyInfo('gemini', opts.overrideSettings?.apiKey);
      if (!key) {
        throw new Error('Gemini API key is not configured. Add it in AI Provider Config or set GEMINI_API_KEY in .env.');
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        effectiveModel
      )}:generateContent`;

      const generationConfig: Record<string, any> = {
        temperature: effectiveTemp,
      };
      if (opts.jsonMode) {
        generationConfig.responseMimeType = 'application/json';
      }
      if (opts.maxTokens) {
        generationConfig.maxOutputTokens = opts.maxTokens;
      }

      const userParts: any[] = [];
      if (opts.inlineMedia?.base64Data && opts.inlineMedia?.mimeType) {
        userParts.push({
          inlineData: {
            mimeType: opts.inlineMedia.mimeType,
            data: opts.inlineMedia.base64Data,
          },
        });
      }
      userParts.push({ text: prompt });

      const payload: Record<string, any> = {
        contents: [
          {
            role: 'user',
            parts: userParts,
          },
        ],
        generationConfig,
      };

      if (opts.systemPrompt) {
        payload.systemInstruction = {
          parts: [{ text: opts.systemPrompt }],
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        let detail = errText;
        try {
          const parsed = JSON.parse(errText);
          detail = parsed?.error?.message || errText;
        } catch {
          // keep raw
        }
        throw new Error(`Gemini API (${res.status}): ${detail}`);
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      return parts.map((p: any) => p.text || '').join('').trim();
    }

    if (effectiveProvider === 'ollama') {
      const baseUrl = (effectiveEndpoint || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434').replace(/\/+$/, '');
      const payload: Record<string, any> = {
        model: effectiveModel || 'llama3',
        prompt: `${opts.systemPrompt ? opts.systemPrompt + '\n\n' : ''}${prompt}`,
        stream: false,
        options: { temperature: effectiveTemp },
      };
      if (opts.jsonMode) {
        payload.format = 'json';
      }

      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama (${res.status}): ${err}`);
      }

      const data = await res.json();
      return (data.response || '').trim();
    }

    if (effectiveProvider === 'deepseek' || effectiveProvider === 'openai_compatible') {
      const baseUrl = this.normalizeOpenAIBaseUrl(effectiveProvider, effectiveEndpoint);
      const { key } = this.resolveKeyInfo(effectiveProvider, opts.overrideSettings?.apiKey);

      if (effectiveProvider === 'deepseek' && !key) {
        throw new Error(
          'DeepSeek API key is not configured. Add it in AI Provider Config or set DEEPSEEK_API_KEY in .env.'
        );
      }

      const isReasoner = /reasoner|r1/i.test(effectiveModel);
      const body: Record<string, any> = {
        model: effectiveModel,
        messages: [
          ...(opts.systemPrompt ? [{ role: 'system', content: opts.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
      };

      if (!isReasoner) {
        body.temperature = effectiveTemp;
        if (opts.jsonMode && effectiveProvider === 'deepseek') {
          body.response_format = { type: 'json_object' };
        }
      }
      if (opts.maxTokens) {
        body.max_tokens = opts.maxTokens;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) {
        headers['Authorization'] = `Bearer ${key}`;
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        let detail = errText;
        try {
          const parsed = JSON.parse(errText);
          detail = parsed?.error?.message || errText;
        } catch {
          // keep raw
        }
        throw new Error(`${effectiveProvider === 'deepseek' ? 'DeepSeek' : 'OpenAI-compatible'} API (${res.status}): ${detail}`);
      }

      const data = await res.json();
      return (data.choices?.[0]?.message?.content || '').trim();
    }

    throw new Error(`Unsupported AI provider: ${effectiveProvider}`);
  }

  /**
   * Live connectivity & credential test across Gemini, DeepSeek, Ollama, and OpenAI-compatible
   */
  async testConnection(overrideSettings?: Partial<AISettings>): Promise<ConnectionTestResult> {
    const provider = overrideSettings?.provider || this.settings.provider;
    const model = overrideSettings?.model || this.settings.model || this.defaultModelFor(provider);
    const started = Date.now();

    try {
      const reply = await this.complete('Reply with the single word: READY', {
        systemPrompt: 'You are a health check responder. Reply with READY only.',
        maxTokens: 32,
        overrideSettings: {
          ...overrideSettings,
          provider,
          model,
        },
      });
      const latencyMs = Date.now() - started;

      if (!reply) {
        return {
          ok: false,
          provider,
          model,
          latencyMs,
          message: `Connected to ${provider}, but model "${model}" returned an empty response.`,
        };
      }

      return {
        ok: true,
        provider,
        model,
        latencyMs,
        reply: reply.slice(0, 80),
        message: `Connected to ${provider.toUpperCase()} (${model}) in ${latencyMs}ms — model responded "${reply.slice(
          0,
          40
        )}".`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - started;
      return {
        ok: false,
        provider,
        model,
        latencyMs,
        message: err.message || 'Provider connection failed.',
      };
    }
  }

  /**
   * AI-assisted structured document extraction (supports Gemini multimodal vision for scanned images + text LLM for PDFs/DOCX)
   */
  async extractDocumentFields(
    rawText: string,
    category: DocumentCategory,
    inlineMedia?: { mimeType: string; base64Data: string }
  ): Promise<{ fields: Record<string, any>; usedVision: boolean } | null> {
    const canUseVision =
      Boolean(inlineMedia?.base64Data) &&
      this.settings.provider === 'gemini' &&
      this.canRunCloudOrLocalInference();

    if ((!rawText || rawText.trim().length < 15) && !canUseVision) {
      return null;
    }
    if (!this.canRunCloudOrLocalInference()) {
      return null;
    }

    const schemaHints: Record<string, string> = {
      passport:
        '{"passportNumber": string|null, "legalGivenName": string|null, "familyName": string|null, "fullName": string|null, "dateOfBirth": "YYYY-MM-DD"|null, "nationality": string|null, "issuingCountry": string|null, "placeOfIssue": string|null, "issueDate": "YYYY-MM-DD"|null, "expiryDate": "YYYY-MM-DD"|null, "gender": string|null, "nationalId": string|null}',
      english_test:
        '{"testType": "IELTS"|"TOEFL"|"PTE"|"Duolingo"|null, "testDate": "YYYY-MM-DD"|null, "expiryDate": "YYYY-MM-DD"|null, "referenceNumber": string|null, "overallScore": string|null, "listening": string|null, "reading": string|null, "writing": string|null, "speaking": string|null}',
      transcript:
        '{"qualificationLevel": "High School"|"Associate"|"Bachelor\'s"|"Master\'s"|"Doctorate"|"Diploma"|null, "degreeTitle": string|null, "major": string|null, "institution": string|null, "country": string|null, "gpa": string|null, "gradingScale": string|null, "percentage": string|null, "startDate": "YYYY-MM-DD"|null, "endDate": "YYYY-MM-DD"|null, "awardDate": "YYYY-MM-DD"|null}',
      degree:
        '{"qualificationLevel": "Bachelor\'s"|"Master\'s"|"Doctorate"|"Diploma"|null, "degreeTitle": string|null, "major": string|null, "institution": string|null, "country": string|null, "gpa": string|null, "awardDate": "YYYY-MM-DD"|null}',
      cv: '{"email": string|null, "phone": string|null, "city": string|null, "country": string|null, "jobTitle": string|null, "company": string|null, "degreeTitle": string|null, "institution": string|null}',
      sop: '{"targetInstitution": string|null, "targetProgram": string|null, "researchInterests": string|null}',
      lor: '{"recommenderName": string|null, "recommenderTitle": string|null, "recommenderInstitution": string|null, "recommenderEmail": string|null, "relationship": string|null}',
      financial:
        '{"sponsorName": string|null, "relationship": string|null, "bankName": string|null, "closingBalance": string|null, "currency": string|null, "statementDate": "YYYY-MM-DD"|null}',
      experience:
        '{"company": string|null, "jobTitle": string|null, "employmentType": "Full-time"|"Part-time"|"Internship"|"Contract"|null, "startDate": "YYYY-MM-DD"|null, "endDate": "YYYY-MM-DD"|null, "location": string|null}',
    };

    const hint = schemaHints[category];
    if (!hint) return null;

    const systemPrompt = `You are a strict international university admissions document parser. Extract ONLY facts explicitly written in the document.
ZERO-INVENTION RULE: Never guess, infer, or fabricate missing fields — return null for any field not clearly visible.
Format dates strictly as YYYY-MM-DD when full day/month/year are present, else null.
Return STRICT JSON matching: ${hint}`;

    try {
      const promptBody = canUseVision
        ? `Extract structured fields from this ${category} image.${
            rawText ? `\n\nSupplemental OCR text:\n${rawText.slice(0, 4000)}` : ''
          }`
        : `Document Text (${category}):\n${rawText.slice(0, 7000)}`;

      const raw = await this.complete(promptBody, {
        systemPrompt,
        jsonMode: true,
        inlineMedia: canUseVision ? inlineMedia : undefined,
      });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          cleaned[k] = v;
        }
      }
      return { fields: cleaned, usedVision: canUseVision };
    } catch (e) {
      console.warn('[AdmitPilot AI] Document AI enrichment skipped:', (e as Error).message);
      return null;
    }
  }

  /**
   * Analyzes an admissions website DOM structure and extracts requirements and candidate readiness
   */
  async analyzeWebsite(
    pageInfo: {
      hostname: string;
      title: string;
      url: string;
      headings: string[];
      formSummary: string;
      detectedTextSnippets: string[];
    },
    candidate: CandidateProfile
  ): Promise<UniversityRequirementReport> {
    const systemPrompt = `You are an expert international university admissions consultant AI.
Analyze the provided university admission webpage information and determine:
1. The institution name and specific program (if identified).
2. The exact application requirements visible on the page (e.g. Passport, Academic Transcripts, Degree Certificate, English Proficiency test, Statement of Purpose / Essay, Letters of Recommendation, Financial Proof, Resume/CV).
3. Candidate readiness for each requirement based solely on the provided verified candidate profile. Do not invent or guess.

Return STRICT JSON matching this schema:
{
  "institutionName": "University name",
  "programName": "Program title or 'General Admissions'",
  "applicationStage": "Initial Inquiry / Standard Application / Document Upload / Review",
  "summary": "Brief 1-2 sentence executive summary of application readiness",
  "requirements": [
    {
      "name": "Requirement Name (e.g. Passport)",
      "category": "document" | "qualification" | "test" | "other",
      "detectedOnPage": true | false,
      "status": "available" | "missing" | "requires_verification" | "unknown",
      "sourceSnippet": "Short snippet from page explaining the requirement"
    }
  ]
}`;

    const candidateSummary = {
      hasPassport: !!candidate.passport?.passportNumber,
      educationDegrees: candidate.education.map((e) => `${e.qualificationLevel} in ${e.major} (${e.institution})`),
      englishTests: candidate.englishTests.map((t) => `${t.testType}: overall ${t.overallScore}`),
      hasEmployment: candidate.employment.length > 0,
      evidenceKeys: Object.keys(candidate.evidence || {}),
    };

    const userPrompt = `Page Information:
URL: ${pageInfo.url}
Hostname: ${pageInfo.hostname}
Title: ${pageInfo.title}
Headings: ${(pageInfo.headings || []).slice(0, 10).join(' | ')}
Form Summary: ${pageInfo.formSummary}
Page Excerpts:
${(pageInfo.detectedTextSnippets || []).slice(0, 8).join('\n---\n')}

Candidate Summary:
${JSON.stringify(candidateSummary, null, 2)}
`;

    try {
      if (this.canRunCloudOrLocalInference()) {
        const raw = await this.complete(userPrompt, { systemPrompt, jsonMode: true });
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          let missingCount = 0;
          const reqs = (parsed.requirements || []).map((r: any) => {
            if (r.status === 'missing') missingCount++;
            return r;
          });
          return {
            institutionName: parsed.institutionName || pageInfo.hostname,
            programName: parsed.programName || 'General Application',
            hostname: pageInfo.hostname,
            applicationStage: parsed.applicationStage || 'Application Form',
            summary: parsed.summary || 'Admissions requirements extracted from page.',
            requirements: reqs,
            overallReadiness: missingCount === 0 ? 'Ready' : missingCount < 3 ? 'Needs Attention' : 'Incomplete',
          };
        }
      }
    } catch (e) {
      console.warn('AI analysis fell back to deterministic website intelligence:', e);
    }

    // Deterministic fallback for website intelligence
    const reqs = [
      {
        name: 'Passport Identification',
        category: 'document' as const,
        detectedOnPage: true,
        status: candidate.passport?.passportNumber ? ('available' as const) : ('missing' as const),
        sourceSnippet: 'Identification & Citizenship verification section',
      },
      {
        name: 'Academic Transcript & Degree',
        category: 'qualification' as const,
        detectedOnPage: true,
        status: candidate.education?.length ? ('available' as const) : ('missing' as const),
        sourceSnippet: 'Educational history and qualification background',
      },
      {
        name: 'English Language Proficiency (IELTS/TOEFL/PTE)',
        category: 'test' as const,
        detectedOnPage: true,
        status: candidate.englishTests?.length ? ('available' as const) : ('missing' as const),
        sourceSnippet: 'Language proficiency testing requirements',
      },
      {
        name: 'Statement of Purpose / Personal Statement',
        category: 'document' as const,
        detectedOnPage: true,
        status: candidate.additional?.notes?.includes('SOP') ? ('available' as const) : ('missing' as const),
        sourceSnippet: 'Statement of academic interest and motivation',
      },
      {
        name: 'Letters of Recommendation',
        category: 'document' as const,
        detectedOnPage: true,
        status: 'requires_verification' as const,
        sourceSnippet: 'Academic / Professional references',
      },
    ];

    const missing = reqs.filter((r) => r.status === 'missing').length;

    return {
      institutionName: (pageInfo.title || '').split(/[-–|]/)[0].trim() || pageInfo.hostname,
      programName: 'Admissions Application',
      hostname: pageInfo.hostname,
      applicationStage: 'Portal Form',
      summary: 'Deterministic page analysis completed. Review detected requirements and candidate records.',
      requirements: reqs,
      overallReadiness: missing === 0 ? 'Ready' : 'Needs Attention',
    };
  }

  /**
   * Matches ambiguous form fields using semantic AI reasoning
   */
  async matchAmbiguousFields(
    fields: FormField[],
    candidate: CandidateProfile
  ): Promise<FieldMapping[]> {
    if (!fields.length || !this.canRunCloudOrLocalInference()) return [];

    const systemPrompt = `You are a precise form matching engine for university admissions.
Your task is to map candidate profile values onto ambiguous form fields.
IMPORTANT PRINCIPLE:
- Never guess or invent candidate information.
- Strictly distinguish Country of Birth from Nationality/Citizenship, Applicant Email from Consultant/Agent Email, and Passport Issue Date from Expiry Date.
- If a dropdown list of options is provided and none match the candidate's verified value, return null.
- If the candidate profile does NOT contain the requested value, return null.
- Clearly explain your reasoning.
- Label confidence: 'high' for unambiguous facts, 'medium' for plausible matches requiring consultant review, 'low' if uncertain.

Output STRICT JSON format:
{
  "mappings": [
    {
      "fieldId": "id string",
      "candidateFieldKey": "path in profile or null",
      "value": "string or boolean or null",
      "confidence": "high" | "medium" | "low",
      "reasoning": "brief explanation"
    }
  ]
}`;

    const prompt = `Form Fields to Match:
${JSON.stringify(
  fields.map((f) => ({
    id: f.id,
    kind: f.kind,
    type: f.type,
    label: f.label,
    name: f.name,
    placeholder: f.placeholder,
    options: f.options?.slice(0, 25),
  })),
  null,
  2
)}

Candidate Profile Data:
${JSON.stringify(
  {
    personal: candidate.personal,
    contact: candidate.contact,
    passport: candidate.passport,
    education: candidate.education,
    englishTests: candidate.englishTests,
    employment: candidate.employment,
    additional: candidate.additional,
  },
  null,
  2
)}`;

    try {
      const raw = await this.complete(prompt, { systemPrompt, jsonMode: true });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.mappings || [])
          .filter((m: any) => m.value !== null && m.value !== undefined && String(m.value).trim() !== '')
          .map((m: any) => ({
            fieldId: m.fieldId,
            fieldLabel: fields.find((f) => f.id === m.fieldId)?.label || '',
            candidateFieldKey: m.candidateFieldKey || '',
            suggestedValue: m.value,
            confidence: m.confidence || 'medium',
            confidenceScore: m.confidence === 'high' ? 0.92 : m.confidence === 'medium' ? 0.75 : 0.45,
            reasoning: m.reasoning || `Semantic match via ${this.settings.provider}`,
            status: 'approved' as const,
            isConfirmedFact: m.confidence === 'high',
          }));
      }
    } catch (e) {
      console.warn('AI matching call failed, returning empty ambiguous mappings:', e);
    }

    return [];
  }

  /**
   * Side panel AI Assistant agent chat with structured tools + Gemini/DeepSeek reasoning
   */
  async handleAgentChat(
    message: string,
    context: {
      candidate: CandidateProfile;
      pageStructure?: any;
      scannedFields?: FormField[];
      requirements?: UniversityRequirementReport;
    }
  ): Promise<{ reply: string; toolUsed?: string; provider?: string; model?: string; actionResult?: any }> {
    const q = message.toLowerCase();

    if (this.canRunCloudOrLocalInference()) {
      const systemPrompt = `You are AdmitPilot AI, an expert international university admissions assistant for education consultants.
STRICT RULES:
1. Zero-Invention Guarantee: Base every factual answer solely on the verified Candidate Profile, Page Context, and Detected Requirements provided below. Never invent grades, passport numbers, dates, or legal answers.
2. Be concise, structured (bullet points where helpful), and actionable.
3. If asked why a field was left blank, explain whether it is missing from the candidate profile, requires consultant legal confirmation, or had no compatible dropdown option.`;

      const userPrompt = `Consultant Question: ${message}

Active Candidate Profile:
${JSON.stringify(
  {
    personal: context.candidate.personal,
    contact: context.candidate.contact,
    passport: context.candidate.passport,
    education: context.candidate.education,
    englishTests: context.candidate.englishTests,
    employment: context.candidate.employment,
    additional: context.candidate.additional,
  },
  null,
  2
)}

Current Portal Page: ${JSON.stringify(context.pageStructure || {})}
Detected Requirements Report: ${JSON.stringify(context.requirements || null)}
Scanned Form Fields Count: ${context.scannedFields?.length ?? 0}`;

      try {
        const reply = await this.complete(userPrompt, { systemPrompt });
        if (reply) {
          return {
            reply,
            toolUsed: `${this.settings.provider}:${this.settings.model}`,
            provider: this.settings.provider,
            model: this.settings.model,
          };
        }
      } catch (e) {
        console.warn('[AdmitPilot Chat] LLM call failed, falling back to built-in tools:', (e as Error).message);
      }
    }

    // Deterministic built-in tools fallback when offline or in Strict Privacy Mode
    if (q.includes('document') && (q.includes('need') || q.includes('require') || q.includes('what'))) {
      const reqList =
        context.requirements?.requirements
          ?.map((r) => `• ${r.name} (${r.status.toUpperCase()})`)
          .join('\n') || '• Passport\n• Academic Transcripts\n• English Proficiency Certificate (IELTS/PTE)';
      return {
        reply: `Here are the admissions requirements detected for this institution:\n\n${reqList}\n\nCandidate status is currently **${
          context.requirements?.overallReadiness || 'Ready'
        }**.`,
        toolUsed: 'extract_page_requirements',
      };
    }

    if (q.includes('missing') || q.includes('empty')) {
      const missing: string[] = [];
      if (!context.candidate.personal?.legalGivenName) missing.push('Given Name');
      if (!context.candidate.passport?.passportNumber) missing.push('Passport Number');
      if (!context.candidate.englishTests?.length) missing.push('English Language Test Certificate');
      if (!context.candidate.education?.length) missing.push('Academic Qualifications');

      if (missing.length === 0) {
        return {
          reply: `All core candidate records are complete and verified! There are no missing critical identity or academic items for ${context.candidate.personal?.legalGivenName} ${context.candidate.personal?.familyName}.`,
          toolUsed: 'get_active_candidate',
        };
      }
      return {
        reply: `The following verified records are currently missing from the candidate profile:\n• ${missing.join(
          '\n• '
        )}\n\nPlease upload the relevant documents in the dashboard to populate these.`,
        toolUsed: 'get_active_candidate',
      };
    }

    if (q.includes('fill') && (q.includes('personal') || q.includes('form') || q.includes('section'))) {
      return {
        reply: `Click **2. Scan Form** above to inspect proposed field mappings and confidence scores before applying them to the webpage.`,
        toolUsed: 'match_form_fields',
      };
    }

    if (q.includes('why') && (q.includes('empty') || q.includes('leave') || q.includes('blank'))) {
      return {
        reply: `AdmitPilot AI adheres to a strict zero-invention policy. Fields are intentionally left empty when:\n1. The requested information does not exist in the verified candidate record.\n2. The field is legally significant (such as criminal declarations or sponsor affidavits) and requires direct consultant input.\n3. The dropdown choices on this website did not offer a compatible match.`,
        toolUsed: 'verify_filled_fields',
      };
    }

    return {
      reply: `I am monitoring the current portal for candidate **${context.candidate.personal.legalGivenName} ${context.candidate.personal.familyName}** (deterministic mode — configure a Gemini or DeepSeek API key in Dashboard → AI Provider Config for full generative assistance).`,
    };
  }
}
