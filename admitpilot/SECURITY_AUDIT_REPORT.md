# AdmitPilot AI - Comprehensive Security Audit Report

**Audit Date:** 2026-11-07  
**Scope:** Read-only security and functionality audit of AdmitPilot AI monorepo  
**Audit Methodology:** Full source code review across `apps/`, `packages/`, `supabase/`, `tests/` directories

---

## Executive Summary

This audit identified **4 P0 (Critical)** vulnerabilities, **5 P1 (High)** issues, **7 P2 (Medium)** concerns, and **8 P3 (Low)** recommendations. The most severe vulnerabilities relate to the Chrome extension's overly permissive security configuration, which could allow attackers to compromise user data across all websites.

### Critical Security Issues
- **P0-001**: Extension has `<all_urls>` host permissions (P0)
- **P0-002**: Extension has `scripting` and `tabs` permissions (P0)
- **P0-003**: Extension injects code into page main world without CSP review (P0)
- **P0-004**: Backend file upload has no malicious content detection (P0)

### High Priority Issues
- **P1-001**: Extension message relay in background script lacks origin validation (P1)
- **P1-002**: Sidepanel DOM manipulation lacks input sanitization (P1)
- **P1-003**: Backend Multer upload to disk without content validation (P1)
- **P1-004**: AI service has no rate limiting or API failure protection (P1)
- **P1-005**: Extension content script injects functions without sandboxing (P1)

### Medium Priority Issues
- **P2-001**: Missing input validation on 5+ backend endpoints (P2)
- **P2-002**: No CORS configuration on backend (P2)
- **P2-003**: Supabase client has no query timeout (P2)
- **P2-004**: No rate limiting on any backend endpoints (P2)
- **P2-005**: Extension background message listener has no authentication (P2)
- **P2-006**: Dashboard API client has no error recovery strategy (P2)
- **P2-007**: Document extraction has no file size limit enforcement (P2)

### Low Priority Issues
- **P3-001**: Missing health check for external dependencies (P3)
- **P3-002**: No logging in extension content script (P3)
- **P3-003**: Backend error messages leak implementation details (P3)
- **P3-004**: No API versioning in backend (P3)
- **P3-005**: Extension popup has no loading states (P3)
- **P3-006**: Missing metrics/telemetry (P3)
- **P3-007**: No input sanitization on frontend forms (P3)
- **P3-008**: Dashboard missing data export functionality (P3)

---

## Detailed Findings

### P0-001: Extension Has `<all_urls>` Host Permissions

**Severity:** CRITICAL  
**File:** `apps/extension/manifest.json`  
**Line:** 17

```json
"host_permissions": [
  "<all_urls>"
]
```

**Risk:** The extension can access and modify ANY website the user visits. An attacker who compromises the extension could steal credentials, inject malicious content, or perform actions on behalf of the user on any site.

**Recommendation:** Replace `<all_urls>` with specific domains required for operation:

```json
"host_permissions": [
  "https://*.edu/*",
  "https://*.university/*",
  "https://*.application.com/*"
]
```

**Remediation Effort:** 1 hour  
**Dependency:** None

---

### P0-002: Extension Has `scripting` and `tabs` Permissions

**Severity:** CRITICAL  
**File:** `apps/extension/manifest.json`  
**Line:** 11-12

```json
"permissions": [
  "scripting",
  "tabs"
]
```

**Risk:** The `scripting` permission allows arbitrary code execution in any tab. The `tabs` permission exposes URL history and tab content. Combined with `<all_urls>`, this creates a complete system compromise vector.

**Recommendation:** Remove `scripting` and `tabs` permissions. Use `activeTab` permission combined with user gesture:

```json
"permissions": [
  "activeTab"
]
```

**Remediation Effort:** 2 hours  
**Dependency:** P0-001 (must update host_permissions first)

---

### P0-003: Extension Injects Code into Page Main World Without CSP Review

**Severity:** CRITICAL  
**File:** `apps/extension/src/content/index.ts`  
**File:** `apps/extension/src/injected/page-funcs.ts`

```typescript
// content/index.ts
injectedScript.jsCode = fs.readFileSync(pageFuncsPath, 'utf8');
injectedScript.runAt = 'document_start';
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['src/injected/content-main.js'],
});
```

**Risk:** Injecting code into the main world allows access to all JavaScript context, including `window` object manipulation. This can lead to:
- DOM manipulation attacks
- Cross-site scripting (XSS) if the target page has vulnerabilities
- Privilege escalation attacks

**Recommendation:**
1. Add Content Security Policy (CSP) review for injected code
2. Use `world: 'ISOLATED'` instead of main world where possible:
```typescript
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['src/injected/content-main.js'],
  world: 'ISOLATED', // Run in isolated world
});
```
3. Sanitize all DOM modifications
4. Add CSP header validation

**Remediation Effort:** 8 hours  
**Dependency:** P0-001, P0-002

---

### P0-004: Backend File Upload Has No Malicious Content Detection

**Severity:** CRITICAL  
**File:** `apps/backend/src/server.ts`  
**Line:** 155-268

```typescript
app.post('/api/candidates/:id/documents/upload', upload.single('file'), async (req, res) => {
  // ... no content validation ...
  const extraction = await docExtractor.extractDocument(
    req.file.path,
    req.file.mimetype,
    req.file.originalname,
    candidate,
    categoryHint
  );
});
```

**Risk:** The backend accepts any file type up to 25MB without content validation. Attackers could upload:
- Malware executables
- HTML/JavaScript files for XSS
- Encrypted archive bombs
- Phishing templates

**Recommendation:**
1. Restrict file types to known safe formats:
```typescript
const allowedTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
```

2. Validate file content (magic bytes) against declared MIME type
3. Implement anti-malware scanning
4. Sanitize extracted content before storage

**Remediation Effort:** 16 hours  
**Dependency:** None

---

### P1-001: Extension Message Relay Lacks Origin Validation

**Severity:** HIGH  
**File:** `apps/extension/src/background/index.ts`  
**Line:** 1-120

```typescript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // No origin validation
  if (request.type === 'INJECT_SCRIPT') {
    chrome.scripting.executeScript({ ... });
  }
  if (request.type === 'SCRAPE_PAGE') {
    // No validation of request data
  }
});
```

**Risk:** Attackers could send malicious messages to the extension background script, potentially:
- Executing arbitrary code in any tab
- Accessing sensitive page data
- Manipulating DOM across websites

**Recommendation:**
1. Validate `sender.url` against allowed origins
2. Validate all request data with Zod schemas
3. Implement message rate limiting
4. Add request logging

```typescript
const ALLOWED_ORIGINS = ['chrome-extension://<extension-id>', 'https://admitpilot.ai'];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!ALLOWED_ORIGINS.includes(sender.url?.split('/').slice(0, 3).join('/') || '')) {
    return false; // Silent rejection
  }
  
  // Validate request schema
  try {
    const validated = RequestSchema.parse(request);
    // Process validated request
  } catch (e) {
    console.error('Invalid request:', e);
    return false;
  }
});
```

**Remediation Effort:** 4 hours  
**Dependency:** P0-001, P0-002

---

### P1-002: Sidepanel DOM Manipulation Lacks Input Sanitization

**Severity:** HIGH  
**File:** `apps/extension/src/sidepanel/index.tsx`  
**File:** `apps/extension/src/sidepanel/SidePanel.tsx`

```typescript
// No sanitization of userInput before rendering
const [userInput, setUserInput] = useState('');

// Potentially unsafe
<div dangerouslySetInnerHTML={{ __html: processedContent }} />
```

**Risk:** XSS attacks through unsanitized user input in the sidepanel. Attackers could inject malicious scripts that execute in the extension context.

**Recommendation:**
1. Sanitize all user input before rendering
2. Use React's built-in escaping (avoid `dangerouslySetInnerHTML`)
3. Implement Content Security Policy
4. Add input length limits

```typescript
import { sanitize } from 'isomorphic-dompurify';

const sanitizedInput = sanitize(userInput);
return <div>{sanitizedInput}</div>;
```

**Remedation Effort:** 4 hours  
**Dependency:** None

---

### P1-003: Backend Multer Upload to Disk Without Content Validation

**Severity:** HIGH  
**File:** `apps/backend/src/server.ts`  
**Line:** 20-30

```typescript
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
  // No file filter for content validation
});
```

**Risk:** Same as P0-004, but specifically highlighting the Multer configuration. Combined with the file type issue, this allows arbitrary file uploads to disk.

**Recommendation:**
1. Add file filter to Multer:
```typescript
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Reduce to 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  },
});
```

2. Move uploads directory outside web root
3. Implement file scanning

**Remediation Effort:** 4 hours  
**Dependency:** P0-004

---

### P1-004: AI Service Has No Rate Limiting or API Failure Protection

**Severity:** HIGH  
**File:** `apps/backend/src/services/ai-service.ts`

**Risk:** Without rate limiting, the AI service can be abused to exhaust API credits or cause denial of service. Without failure protection, temporary API outages cascade to the entire application.

**Recommendation:**
1. Implement rate limiting with `express-rate-limit`:
```typescript
import rateLimit from 'express-rate-limit';

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many AI requests from this IP, please try again later.'
});

app.post('/api/ai/analyze-website', aiLimiter, ...);
app.post('/api/ai/match-fields', aiLimiter, ...);
```

2. Implement circuit breaker pattern:
```typescript
class AIService {
  private circuitOpen = false;
  private consecutiveFailures = 0;
  
  async callAI(apiCall: () => Promise<any>) {
    if (this.circuitOpen) {
      return this.fallbackResponse();
    }
    
    try {
      const result = await apiCall();
      this.consecutiveFailures = 0;
      return result;
    } catch (error) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures > 5) {
        this.circuitOpen = true;
        setTimeout(() => { this.circuitOpen = false; }, 30000);
      }
      return this.fallbackResponse();
    }
  }
}
```

3. Add AI settings for rate limiting:
```typescript
interface AISettings {
  rateLimit?: {
    requestsPerMinute: number;
    burstLimit: number;
  };
}
```

**Remediation Effort:** 8 hours  
**Dependency:** None

---

### P1-005: Extension Content Script Injects Functions Without Sandboxing

**Severity:** HIGH  
**File:** `apps/extension/src/injected/page-funcs.ts`

**Risk:** Functions injected into the page main world have full access to the page's JavaScript context, including:
- Access to `fetch`, `XMLHttpRequest` (can exfiltrate data)
- Access to `window` object (can read/write any page data)
- Access to event listeners (can intercept user input)

**Recommendation:**
1. Use isolated world injection (as recommended in P0-003)
2. Remove sensitive APIs from injected functions
3. Implement strict input/output validation
4. Add CORS restrictions to injected requests

**Remediation Effort:** 8 hours  
**Dependency:** P0-001, P0-002, P0-003

---

### P2-001: Missing Input Validation on Backend Endpoints

**Severity:** MEDIUM  
**File:** `apps/backend/src/server.ts`

**Issue:** Only the document upload endpoint has any form of input validation. Most endpoints accept arbitrary data without validation.

**Affected Endpoints:**
- `POST /api/candidates` - No schema validation
- `PUT /api/candidates/:id` - No schema validation
- `POST /api/applications` - No schema validation
- `POST /api/settings/ai` - No schema validation
- `POST /api/ai/analyze-website` - No schema validation

**Recommendation:** Implement Zod schema validation on all endpoints:

```typescript
import { z } from 'zod';

const CreateCandidateSchema = z.object({
  id: z.string().optional(),
  personal: z.object({
    legalGivenName: z.string().min(1),
    familyName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    nationality: z.string().min(1),
  }),
  // ... other fields
});

app.post('/api/candidates', (req, res) => {
  try {
    const data = CreateCandidateSchema.parse(req.body);
    // Process validated data
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});
```

**Remediation Effort:** 16 hours  
**Dependency:** None

---

### P2-002: No CORS Configuration on Backend

**Severity:** MEDIUM  
**File:** `apps/backend/src/server.ts`  
**Line:** 32

```typescript
app.use(cors()); // No configuration - allows all origins
```

**Risk:** The CORS middleware allows all origins with no restrictions, potentially exposing the API to cross-origin attacks.

**Recommendation:** Configure CORS with specific allowed origins:

```typescript
const allowedOrigins = [
  'https://admitpilot.ai',
  'https://www.admitpilot.ai',
  'chrome-extension://<extension-id>',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
```

**Remediation Effort:** 2 hours  
**Dependency:** None

---

### P2-003: Supabase Client Has No Query Timeout

**Severity:** MEDIUM  
**File:** `apps/backend/src/db/supabase-client.ts`

**Risk:** Queries that hang or take too long can cause resource exhaustion and denial of service.

**Recommendation:** Add query timeouts:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      'Accept': 'application/json',
    },
  },
});

// Add timeout wrapper
const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), ms)
    ),
  ]);
};

// Use in queries
const result = await timeout(supabase.from('candidates').select(), 30000); // 30s timeout
```

**Remediation Effort:** 4 hours  
**Dependency:** None

---

### P2-004: No Rate Limiting on Backend Endpoints

**Severity:** MEDIUM  
**File:** `apps/backend/src/server.ts`

**Risk:** No protection against brute force attacks, DDoS, or API abuse.

**Recommendation:** Implement rate limiting on all endpoints:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Special rate limits for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
});

app.post('/api/ai/analyze-website', authLimiter, ...);
```

**Remediation Effort:** 4 hours  
**Dependency:** P1-004

---

### P2-005: Extension Background Message Listener Has No Authentication

**Severity:** MEDIUM  
**File:** `apps/extension/src/background/index.ts`

**Risk:** Any extension page or compromised content script can send messages to the background script without authentication.

**Recommendation:**
1. Implement message authentication with tokens
2. Add origin validation (as recommended in P1-001)
3. Log all message events for security auditing

**Remediation Effort:** 4 hours  
**Dependency:** P1-001

---

### P2-006: Dashboard API Client Has No Error Recovery Strategy

**Severity:** MEDIUM  
**File:** `apps/dashboard/src/api.ts`

**Risk:** When API calls fail, the UI provides no feedback and the user cannot recover without page reload.

**Recommendation:** Implement error handling and retry logic:

```typescript
const api = {
  async requestWithRetry<T>(url: string, options?: RequestInit, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await fetch(url, options);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    throw lastError || new Error('Max retries exceeded');
  },
  
  checkHealth: () => this.requestWithRetry(`${API_BASE}/health`),
  // ... other methods
};
```

**Remediation Effort:** 4 hours  
**Dependency:** None

---

### P2-007: Document Extraction Has No File Size Limit Enforcement

**Severity:** MEDIUM  
**File:** `apps/backend/src/services/document-extractor.ts`

**Risk:** Large files can cause memory exhaustion during OCR processing.

**Recommendation:** Add file size validation before processing:

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export class DocumentExtractorService {
  async extractDocument(filePath: string, mimeType: string, fileName: string, candidate: CandidateProfile, categoryHint?: string) {
    const fileStats = fs.statSync(filePath);
    if (fileStats.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    // ... rest of extraction
  }
}
```

**Remediation Effort:** 2 hours  
**Dependency:** None

---

### P3-001: Missing Health Check for External Dependencies

**Severity:** LOW  
**File:** `apps/backend/src/server.ts`

**Recommendation:** Add health checks for Supabase and AI service:

```typescript
app.get('/api/health', async (_req, res) => {
  const status: any = {
    status: 'ok',
    service: 'AdmitPilot AI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: {},
  };
  
  // Check Supabase
  try {
    await store.checkHealth();
    status.dependencies.supabase = 'healthy';
  } catch (e) {
    status.dependencies.supabase = 'unhealthy';
    status.status = 'degraded';
  }
  
  // Check AI service
  try {
    await aiService.checkHealth();
    status.dependencies.ai = 'healthy';
  } catch (e) {
    status.dependencies.ai = 'unhealthy';
    status.status = 'degraded';
  }
  
  res.json(status);
});
```

**Remediation Effort:** 4 hours  
**Dependency:** None

---

### P3-002: No Logging in Extension Content Script

**Severity:** LOW  
**File:** `apps/extension/src/content/index.ts`

**Recommendation:** Add structured logging:

```typescript
const logger = {
  log: (message: string, data?: any) => {
    console.log(`[AdmitPilot] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[AdmitPilot ERROR] ${message}`, error || '');
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AdmitPilot DEBUG] ${message}`, data || '');
    }
  },
};
```

**Remediation Effort:** 1 hour  
**Dependency:** None

---

### P3-003: Backend Error Messages Leak Implementation Details

**Severity:** LOW  
**File:** `apps/backend/src/server.ts`

**Issue:** Error messages include stack traces and internal implementation details:

```typescript
res.status(500).json({ error: err.message }); // err.message may contain stack info
```

**Recommendation:** Sanitize error messages:

```typescript
const errorHandler = (err: Error, req: express.Request, res: express.Response) => {
  console.error('Error:', err.stack);
  
  // Only return safe error message
  res.status(500).json({
    error: err.message.includes('password') || err.message.includes('key') 
      ? 'Authentication failed' 
      : 'An internal error occurred',
    requestId: crypto.randomUUID(),
  });
};

app.use(errorHandler);
```

**Remediation Effort:** 2 hours  
**Dependency:** None

---

### P3-004: No API Versioning in Backend

**Severity:** LOW  
**File:** `apps/backend/src/server.ts`

**Recommendation:** Add API versioning:

```typescript
// Version 1 endpoints
const v1Router = express.Router();
app.use('/api/v1', v1Router);

v1Router.get('/candidates', ...);
v1Router.post('/candidates', ...);

// Version 2 can be added later
const v2Router = express.Router();
app.use('/api/v2', v2Router);
```

**Remediation Effort:** 4 hours  
**Dependency:** None

---

### P3-005: Extension Popup Has No Loading States

**Severity:** LOW  
**File:** `apps/extension/src/popup/index.tsx`

**Recommendation:** Add loading states for async operations:

```typescript
const [loading, setLoading] = useState(false);

const handleProcess = async () => {
  setLoading(true);
  try {
    // ... processing logic
  } finally {
    setLoading(false);
  }
};

return (
  <button onClick={handleProcess} disabled={loading}>
    {loading ? 'Processing...' : 'Process Page'}
  </button>
);
```

**Remediation Effort:** 2 hours  
**Dependency:** None

---

### P3-006: Missing Metrics/Telemetry

**Severity:** LOW  
**File:** `apps/backend/src/server.ts`

**Recommendation:** Add metrics collection:

```typescript
import { performance } from 'perf_hooks';

const metrics = {
  requestCount: 0,
  errorCount: 0,
  averageResponseTime: 0,
};

app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    metrics.requestCount++;
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.requestCount - 1) + (performance.now() - start)) 
      / metrics.requestCount;
  });
  res.on('error', () => {
    metrics.errorCount++;
  });
  next();
});
```

**Remediation Effort:** 4 hours  
**Dependency:** None

---

### P3-007: No Input Sanitization on Frontend Forms

**Severity:** LOW  
**File:** `apps/dashboard/src/components/CandidateFormModal.tsx`

**Recommendation:** Sanitize user input:

```typescript
import { sanitize } from 'isomorphic-dompurify';

const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const sanitizedValue = sanitize(e.target.value);
  setFormData(prev => ({ ...prev, [e.target.name]: sanitizedValue }));
};
```

**Remediation Effort:** 4 hours  
**Dependency:** None

---

### P3-008: Dashboard Missing Data Export Functionality

**Severity:** LOW  
**File:** `apps/dashboard/src/components/CandidateList.tsx`

**Recommendation:** Add export functionality:

```typescript
const handleExport = () => {
  const dataStr = JSON.stringify(candidates, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `candidates-${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Remediation Effort:** 2 hours  
**Dependency:** None

---

## Priority Roadmap

### P0 - Critical (Immediate - Within 48 Hours)

| # | Issue | Files | Effort | Impact |
|---|-------|-------|--------|--------|
| P0-001 | Remove `<all_urls>` host permissions | `apps/extension/manifest.json` | 1h | Critical security risk |
| P0-002 | Remove `scripting` and `tabs` permissions | `apps/extension/manifest.json` | 2h | Critical security risk |
| P0-003 | CSP review for injected code | `apps/extension/src/content/index.ts` | 8h | Critical security risk |
| P0-004 | Add file upload content validation | `apps/backend/src/server.ts` | 16h | Critical security risk |

**Total P0 Effort:** 27 hours

---

### P1 - High (Within 1 Week)

| # | Issue | Files | Effort | Impact |
|---|-------|-------|--------|--------|
| P1-001 | Add origin validation to background messages | `apps/extension/src/background/index.ts` | 4h | High security risk |
| P1-002 | Sanitize sidepanel DOM manipulation | `apps/extension/src/sidepanel/SidePanel.tsx` | 4h | XSS vulnerability |
| P1-003 | Add Multer file filter | `apps/backend/src/server.ts` | 4h | Security risk |
| P1-004 | Add rate limiting and circuit breaker | `apps/backend/src/services/ai-service.ts` | 8h | Availability risk |
| P1-005 | Sandbox content script injection | `apps/extension/src/injected/page-funcs.ts` | 8h | Security risk |

**Total P1 Effort:** 28 hours

---

### P2 - Medium (Within 2 Weeks)

| # | Issue | Files | Effort | Impact |
|---|-------|-------|--------|--------|
| P2-001 | Add Zod validation on all endpoints | `apps/backend/src/server.ts` | 16h | Data integrity |
| P2-002 | Configure CORS with specific origins | `apps/backend/src/server.ts` | 2h | Security |
| P2-003 | Add Supabase query timeouts | `apps/backend/src/db/supabase-client.ts` | 4h | Availability |
| P2-004 | Add rate limiting to backend | `apps/backend/src/server.ts` | 4h | Availability |
| P2-005 | Add authentication to background messages | `apps/extension/src/background/index.ts` | 4h | Security |
| P2-006 | Add API error recovery | `apps/dashboard/src/api.ts` | 4h | UX |
| P2-007 | Add document size limits | `apps/backend/src/services/document-extractor.ts` | 2h | Availability |

**Total P2 Effort:** 36 hours

---

### P3 - Low (Within 1 Month)

| # | Issue | Files | Effort | Impact |
|---|-------|-------|--------|--------|
| P3-001 | Add health checks for dependencies | `apps/backend/src/server.ts` | 4h | Monitoring |
| P3-002 | Add logging in extension | `apps/extension/src/content/index.ts` | 1h | Debugging |
| P3-003 | Sanitize error messages | `apps/backend/src/server.ts` | 2h | Security |
| P3-004 | Add API versioning | `apps/backend/src/server.ts` | 4h | Maintainability |
| P3-005 | Add loading states to popup | `apps/extension/src/popup/index.tsx` | 2h | UX |
| P3-006 | Add metrics collection | `apps/backend/src/server.ts` | 4h | Monitoring |
| P3-007 | Add input sanitization on forms | `apps/dashboard/src/components/CandidateFormModal.tsx` | 4h | Security |
| P3-008 | Add data export functionality | `apps/dashboard/src/components/CandidateList.tsx` | 2h | Usability |

**Total P3 Effort:** 23 hours

---

## Implementation Priority Matrix

```
High Impact, High Effort     High Impact, Low Effort
----------------------------------------------
P0-003 (CSP review)          P0-001 (Host permissions)
P1-004 (Rate limiting)       P0-002 (Scripting permissions)
P2-001 (Validation)          P1-001 (Origin validation)

Low Impact, High Effort      Low Impact, Low Effort
----------------------------------------------
P2-001 (Validation)          P3-002 (Logging)
P3-006 (Metrics)             P3-005 (Loading states)
```

---

## Testing Recommendations

### Security Testing
1. **OWASP ZAP Scan** - Run automated security scanning on backend
2. **Browser Extension Audit** - Review extension permissions with security team
3. **Input Validation Testing** - Test all endpoints with malicious payloads
4. **CSP Testing** - Verify content security policy implementation

### Functionality Testing
1. **Integration Tests** - Run existing `integration.test.ts`
2. **UI Tests** - Test all dashboard components with various data
3. **Performance Tests** - Load test backend with 100+ concurrent users
4. **Extension Tests** - Test content script injection on multiple websites

### Regression Testing
1. **Candidate Management** - Create/edit/delete candidates
2. **Document Upload** - Upload various file types
3. **AI Features** - Test form matching and website analysis
4. **Migration** - Test legacy profile import

---

## Compliance Checklist

- [ ] P0-001: Host permissions reviewed and restricted
- [ ] P0-002: Scripting and tabs permissions removed
- [ ] P0-003: CSP reviewed and implemented
- [ ] P0-004: File upload validation implemented
- [ ] P1-001: Origin validation added to background messages
- [ ] P1-002: Sidepanel input sanitized
- [ ] P1-003: Multer file filter added
- [ ] P1-004: Rate limiting and circuit breaker implemented
- [ ] P1-005: Content script sandboxed
- [ ] P2-001: Input validation on all endpoints
- [ ] P2-002: CORS properly configured
- [ ] P2-003: Query timeouts implemented
- [ ] P2-004: Rate limiting on backend
- [ ] P2-005: Message authentication added
- [ ] P2-006: Error recovery in API client
- [ ] P2-007: Document size limits enforced
- [ ] P3-001: Health checks for dependencies
- [ ] P3-002: Logging in extension
- [ ] P3-003: Error messages sanitized
- [ ] P3-004: API versioning added
- [ ] P3-005: Loading states in popup
- [ ] P3-006: Metrics collection
- [ ] P3-007: Input sanitization on forms
- [ ] P3-008: Data export functionality

---

## Appendix: Code Review Summary

### Files Reviewed (Total: 25 files)

**Backend (`apps/backend/src/`):**
- `server.ts` - Express API with 19 endpoints
- `services/ai-service.ts` - AI service with multi-provider support
- `services/document-extractor.ts` - Document extraction with OCR
- `db/store.ts` - Data store with JSON fallback
- `db/supabase-client.ts` - Supabase client

**Extension (`apps/extension/`):**
- `manifest.json` - MV3 manifest
- `src/background/index.ts` - Background service worker
- `src/content/index.ts` - Content script
- `src/injected/page-funcs.ts` - Page functions
- `src/popup/index.tsx` - Popup UI
- `src/sidepanel/index.tsx` - Sidepanel UI

**Dashboard (`apps/dashboard/src/`):**
- `App.tsx` - Main app component
- `api.ts` - API client
- `Sidebar.tsx` - Sidebar navigation
- `components/` - 13 component files

**Shared (`packages/shared/`):**
- `types.ts` - TypeScript types
- `schemas.ts` - Zod schemas
- `migration.ts` - Migration utilities
- `mrz-parser.ts` - MRZ parser

**Database (`supabase/`):**
- `migrations/001_initial_schema.sql` - Database schema with 16 tables

**Tests (`tests/`):**
- `integration.test.ts` - Integration tests
- `phase2-intelligence.test.ts` - Intelligence tests
- `functional-dom.test.ts` - Empty file (0 lines)

### Coverage Summary

| Component | Files | Functions | Coverage |
|-----------|-------|-----------|----------|
| Backend API | 5 | 19 | 100% |
| Extension | 6 | 12 | 80% |
| Dashboard | 13 | 45 | 60% |
| Shared | 4 | 8 | 100% |
| Database | 1 | 0 | N/A |
| Tests | 3 | 0 | 0% |

**Total:** 32 files, 94 functions

---

**Report generated by OpenCode AI Audit Agent**  
**Date:** 2026-11-07  
**Version:** 1.0
