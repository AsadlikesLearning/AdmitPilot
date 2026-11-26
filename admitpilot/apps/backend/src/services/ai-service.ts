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
  inlineMediaList?: Array<{ mimeType: string; base64Data: string }>;
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
    const defaultProvider: AIProvider =
      settings?.provider || (process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY ? 'openrouter' : 'gemini');
    this.settings = {
      provider: defaultProvider,
      model: settings?.model || this.defaultModelFor(defaultProvider),
      apiKey: settings?.apiKey || '',
      geminiApiKey: settings?.geminiApiKey || '',
      openrouterApiKey: settings?.openrouterApiKey || '',
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
      case 'openrouter':
        return 'openai/gpt-4o-mini';
      case 'deepseek':
        return 'deepseek-chat';
      case 'ollama':
        return process.env.OLLAMA_MODEL || 'llama3';
      case 'openai_compatible':
        return 'gpt-4o-mini';
    }
  }

  public updateSettings(newSettings: Partial<AISettings>) {
    const incomingKey =
      newSettings.apiKey && newSettings.apiKey !== '***CONFIGURED***' && newSettings.apiKey !== '***HIDDEN***'
        ? newSettings.apiKey.trim()
        : undefined;

    // Auto-upgrade openai_compatible + sk-or-v1-... to openrouter when endpoint was left at api.openai.com
    let targetProvider = newSettings.provider || this.settings.provider;
    let targetEndpoint = newSettings.endpoint ?? this.settings.endpoint;
    if (
      targetProvider === 'openai_compatible' &&
      incomingKey?.startsWith('sk-or-') &&
      (!targetEndpoint || targetEndpoint.includes('api.openai.com'))
    ) {
      targetProvider = 'openrouter';
      targetEndpoint = 'https://openrouter.ai/api/v1';
    }

    this.settings = {
      ...this.settings,
      ...newSettings,
      provider: targetProvider,
      endpoint: targetEndpoint,
      apiKey: incomingKey !== undefined ? incomingKey : this.settings.apiKey,
      geminiApiKey:
        newSettings.geminiApiKey ??
        (targetProvider === 'gemini' && incomingKey ? incomingKey : this.settings.geminiApiKey),
      openrouterApiKey:
        newSettings.openrouterApiKey ??
        ((targetProvider === 'openrouter' || incomingKey?.startsWith('sk-or-')) && incomingKey
          ? incomingKey
          : this.settings.openrouterApiKey),
      deepseekApiKey:
        newSettings.deepseekApiKey ??
        (targetProvider === 'deepseek' && incomingKey ? incomingKey : this.settings.deepseekApiKey),
      openaiApiKey:
        newSettings.openaiApiKey ??
        (targetProvider === 'openai_compatible' && incomingKey && !incomingKey.startsWith('sk-or-')
          ? incomingKey
          : this.settings.openaiApiKey),
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

    if (provider === 'openrouter') {
      const saved =
        this.settings.openrouterApiKey ||
        (this.settings.provider === 'openrouter' ? this.settings.apiKey : '') ||
        (this.settings.openaiApiKey?.startsWith('sk-or-') ? this.settings.openaiApiKey : '');
      if (saved) return { key: saved, source: 'dashboard' };
      if (process.env.OPENROUTER_API_KEY) return { key: process.env.OPENROUTER_API_KEY, source: 'env' };
      if (process.env.OPENAI_API_KEY?.startsWith('sk-or-')) return { key: process.env.OPENAI_API_KEY, source: 'env' };
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
        this.settings.openaiApiKey ||
        this.settings.openrouterApiKey ||
        (this.settings.provider === 'openai_compatible' ? this.settings.apiKey : '');
      if (saved) return { key: saved, source: 'dashboard' };
      if (process.env.OPENAI_API_KEY) return { key: process.env.OPENAI_API_KEY, source: 'env' };
      if (process.env.OPENROUTER_API_KEY) return { key: process.env.OPENROUTER_API_KEY, source: 'env' };
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

  private normalizeOpenAIBaseUrl(provider: AIProvider, rawEndpoint?: string, apiKey?: string): string {
    // Auto-route OpenRouter keys (sk-or-v1-...) to OpenRouter even if endpoint was left at api.openai.com
    if (provider === 'openrouter' || apiKey?.startsWith('sk-or-')) {
      if (rawEndpoint && !rawEndpoint.includes('api.openai.com')) {
        const cleaned = rawEndpoint.trim().replace(/\/+$/, '');
        if (cleaned === 'https://openrouter.ai') return 'https://openrouter.ai/api/v1';
        return cleaned;
      }
      return 'https://openrouter.ai/api/v1';
    }

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

  private normalizeModelForGateway(model: string, baseUrl: string): string {
    if (!baseUrl.includes('openrouter.ai')) return model;
    const m = model.trim();
    if (m.includes('/')) return m;
    if (/^gpt-/i.test(m) || /^o1/i.test(m) || /^o3/i.test(m)) return `openai/${m}`;
    if (/^gemini-/i.test(m)) return `google/${m}`;
    if (/^deepseek-/i.test(m)) return `deepseek/${m}`;
    if (/^claude-/i.test(m)) return `anthropic/${m}`;
    return m;
  }

  /**
   * Unified LLM completion dispatcher across Google Gemini, OpenRouter, DeepSeek, Ollama, and OpenAI-compatible gateways
   */
  async complete(prompt: string, options: CompletionOptions | string = {}): Promise<string> {
    const opts: CompletionOptions = typeof options === 'string' ? { systemPrompt: options } : options;
    const effectiveProvider = opts.overrideSettings?.provider || this.settings.provider;
    const rawModel =
      opts.overrideSettings?.model || this.settings.model || this.defaultModelFor(effectiveProvider);
    const effectiveEndpoint = opts.overrideSettings?.endpoint ?? this.settings.endpoint;
    const effectiveTemp = opts.overrideSettings?.temperature ?? this.settings.temperature ?? 0.1;

    if (effectiveProvider === 'gemini') {
      const { key } = this.resolveKeyInfo('gemini', opts.overrideSettings?.apiKey);
      if (!key) {
        throw new Error('Gemini API key is not configured. Add it in Model Providers or set GEMINI_API_KEY in .env.');
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        rawModel
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

      const mediaAttachments =
        opts.inlineMediaList && opts.inlineMediaList.length > 0
          ? opts.inlineMediaList
          : opts.inlineMedia?.base64Data && opts.inlineMedia?.mimeType
          ? [opts.inlineMedia]
          : [];

      const userParts: any[] = [];
      for (const media of mediaAttachments) {
        if (media?.base64Data && media?.mimeType) {
          userParts.push({
            inlineData: {
              mimeType: media.mimeType,
              data: media.base64Data,
            },
          });
        }
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
        model: rawModel || 'llama3',
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

    if (
      effectiveProvider === 'openrouter' ||
      effectiveProvider === 'deepseek' ||
      effectiveProvider === 'openai_compatible'
    ) {
      const { key } = this.resolveKeyInfo(effectiveProvider, opts.overrideSettings?.apiKey);
      const baseUrl = this.normalizeOpenAIBaseUrl(effectiveProvider, effectiveEndpoint, key);
      const isOpenRouter = baseUrl.includes('openrouter.ai');
      const effectiveModel = this.normalizeModelForGateway(rawModel, baseUrl);

      if ((effectiveProvider === 'deepseek' || effectiveProvider === 'openrouter' || isOpenRouter) && !key) {
        throw new Error(
          `${isOpenRouter ? 'OpenRouter' : 'DeepSeek'} API key is not configured. Paste your key in Model Providers or set ${
            isOpenRouter ? 'OPENROUTER_API_KEY' : 'DEEPSEEK_API_KEY'
          } in admitpilot/.env.`
        );
      }

      const mediaAttachments =
        opts.inlineMediaList && opts.inlineMediaList.length > 0
          ? opts.inlineMediaList
          : opts.inlineMedia?.base64Data && opts.inlineMedia?.mimeType
          ? [opts.inlineMedia]
          : [];

      const isReasoner = /reasoner|\br1\b/i.test(effectiveModel);
      const supportsVision =
        mediaAttachments.length > 0 &&
        /gpt-4o|gemini|claude-3|vision|pixtral|qwen.*vl/i.test(effectiveModel);

      const userContent: any = supportsVision
        ? [
            { type: 'text', text: prompt },
            ...mediaAttachments.map((media) => ({
              type: 'image_url',
              image_url: {
                url: `data:${media.mimeType};base64,${media.base64Data}`,
              },
            })),
          ]
        : prompt;

      const body: Record<string, any> = {
        model: effectiveModel,
        messages: [
          ...(opts.systemPrompt ? [{ role: 'system', content: opts.systemPrompt }] : []),
          { role: 'user', content: userContent },
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
      } else if (isOpenRouter || effectiveProvider === 'openai_compatible') {
        // Prevent OpenRouter 402 pre-checks from reserving 65,536 output tokens on low-credit keys
        body.max_tokens = 1500;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) {
        headers['Authorization'] = `Bearer ${key}`;
      }
      if (isOpenRouter) {
        headers['HTTP-Referer'] = 'http://localhost:5173';
        headers['X-Title'] = 'AdmitPilot AI';
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
        const label = isOpenRouter
          ? 'OpenRouter'
          : effectiveProvider === 'deepseek'
          ? 'DeepSeek'
          : 'OpenAI-compatible';
        throw new Error(`${label} API (${res.status}): ${detail}`);
      }

      const data = await res.json();
      return (data.choices?.[0]?.message?.content || '').trim();
    }

    throw new Error(`Unsupported AI provider: ${effectiveProvider}`);
  }

  /**
   * Live connectivity & credential test across Gemini, OpenRouter, DeepSeek, Ollama, and OpenAI-compatible
   */
  async testConnection(overrideSettings?: Partial<AISettings>): Promise<ConnectionTestResult> {
    const incomingKey = overrideSettings?.apiKey?.trim();
    const rawProvider = overrideSettings?.provider || this.settings.provider;
    const provider: AIProvider =
      rawProvider === 'openai_compatible' && incomingKey?.startsWith('sk-or-')
        ? 'openrouter'
        : rawProvider;
    const rawModel = overrideSettings?.model || this.settings.model || this.defaultModelFor(provider);
    const model = provider === 'openrouter' ? this.normalizeModelForGateway(rawModel, 'https://openrouter.ai/api/v1') : rawModel;
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
   * AI-assisted structured document extraction (supports Gemini & OpenRouter multimodal vision)
   */
  async extractDocumentFields(
    rawText: string,
    category: DocumentCategory,
    inlineMedia?: { mimeType: string; base64Data: string } | Array<{ mimeType: string; base64Data: string }>
  ): Promise<{ fields: Record<string, any>; usedVision: boolean } | null> {
    const mediaList = Array.isArray(inlineMedia)
      ? inlineMedia
      : inlineMedia?.base64Data
      ? [inlineMedia]
      : [];

    const canUseVision =
      mediaList.length > 0 &&
      (this.settings.provider === 'gemini' ||
        ((this.settings.provider === 'openrouter' || this.settings.provider === 'openai_compatible') &&
          /gpt-4o|gemini|claude-3|vision|pixtral|qwen.*vl/i.test(this.settings.model))) &&
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
        '{"qualificationLevel": "High School"|"Associate"|"Bachelor\'s"|"Master\'s"|"Doctorate"|"Diploma"|null, "degreeTitle": string|null, "major": string|null, "institution": string|null, "country": string|null, "gpa": string|null, "gradingScale": string|null, "obtainedMarks": string|null, "totalMarks": string|null, "percentage": string|null, "startDate": "YYYY-MM-DD"|null, "endDate": "YYYY-MM-DD"|null, "awardDate": "YYYY-MM-DD"|null}',
      degree:
        '{"qualificationLevel": "High School"|"Associate"|"Bachelor\'s"|"Master\'s"|"Doctorate"|"Diploma"|null, "degreeTitle": string|null, "major": string|null, "institution": string|null, "country": string|null, "gpa": string|null, "gradingScale": string|null, "obtainedMarks": string|null, "totalMarks": string|null, "percentage": string|null, "awardDate": "YYYY-MM-DD"|null}',
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
MULTI-PAGE RULE: Inspect ALL attached page images (Page 1, Page 2, Page 3, ...) and all OCR text pages. On multi-page transcripts, final CGPA, cumulative GPA, total credits, and degree award dates are frequently on Page 2 or the last page.
Format dates strictly as YYYY-MM-DD when full day/month/year are present, else null.
Return STRICT JSON matching: ${hint}`;

    const boundedText =
      rawText.length <= 16000
        ? rawText
        : `${rawText.slice(0, 8000)}\n\n...[middle pages omitted]...\n\n${rawText.slice(-8000)}`;

    try {
      const promptBody = canUseVision
        ? `Extract structured fields from this ${category} document (${mediaList.length} scanned page${
            mediaList.length === 1 ? '' : 's'
          }).${boundedText ? `\n\nSupplemental OCR & PDF text:\n${boundedText}` : ''}`
        : `Document Text (${category}):\n${boundedText}`;

      const raw = await this.complete(promptBody, {
        systemPrompt,
        jsonMode: true,
        maxTokens: 1500,
        inlineMediaList: canUseVision ? mediaList : undefined,
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
   * Side panel AI Assistant agent chat
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
          reply: `All core candidate records are complete and verified. No critical identity or academic items are missing for ${context.candidate.personal?.legalGivenName} ${context.candidate.personal?.familyName}.`,
          toolUsed: 'get_active_candidate',
        };
      }
      return {
        reply: `The following verified records are currently missing from the candidate profile:\n• ${missing.join(
          '\n• '
        )}\n\nUpload the relevant documents in the dashboard to populate these.`,
        toolUsed: 'get_active_candidate',
      };
    }

    return {
      reply: `Monitoring the current portal for candidate **${context.candidate.personal.legalGivenName} ${context.candidate.personal.familyName}**.`,
    };
  }
}
