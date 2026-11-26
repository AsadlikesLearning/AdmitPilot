// page-funcs.ts — Self-contained functions injected into webpage main world
// Handles native inputs, React controlled forms, <input type="file"> DataTransfer attachments, and date pickers

export function admitpilotCelebrate(count: number, label = 'fields populated') {
  const ID = '__admitpilot_celebrate';
  const old = document.getElementById(ID);
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = ID;
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden;' +
    "font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";

  const style = document.createElement('style');
  style.textContent = `
    @keyframes apToast{0%{transform:translate(-50%,-16px);opacity:0}
      12%{transform:translate(-50%,0);opacity:1}85%{transform:translate(-50%,0);opacity:1}
      100%{transform:translate(-50%,-12px);opacity:0}}
    #${ID} .ap-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);
      display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:10px;
      background:#19191b;color:#ededed;border:1px solid rgba(212,168,83,0.45);
      box-shadow:0 12px 32px rgba(0,0,0,.55);animation:apToast 2.6s cubic-bezier(.25,1,.5,1) forwards}
    #${ID} .ap-dot{width:8px;height:8px;background:#3ea87a;border-radius:50%;flex-shrink:0}
    #${ID} .ap-title{font-weight:500;font-size:12px;color:#ededed}
    #${ID} .ap-sub{font-size:11px;color:#a0a0a6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  `;
  wrap.appendChild(style);

  const toast = document.createElement('div');
  toast.className = 'ap-toast';
  toast.innerHTML =
    '<div class="ap-dot"></div>' +
    '<div><div class="ap-title">AdmitPilot autofill verified</div>' +
    '<div class="ap-sub">' + (count || 0) + ' ' + label + '</div></div>';
  wrap.appendChild(toast);

  document.documentElement.appendChild(wrap);
  setTimeout(() => wrap.remove(), 2800);
}

/**
 * Scans page DOM and returns structured FormField array (including <input type="file"> upload slots)
 */
export function admitpilotPageExtract() {
  const clean = (t: string | null | undefined) => (t || '').replace(/\s+/g, ' ').trim();
  const ok = (t: string | null | undefined) => t && t.length > 0 && t.length < 110;

  const vis = (el: HTMLElement, isFileInput = false) => {
    if (!el || (el as any).disabled) return false;
    if (el.closest('[aria-hidden="true"]') || el.getAttribute('aria-hidden') === 'true') return false;
    // University portals frequently visually hide <input type="file"> inside a styled <label> or dropzone
    if (isFileInput) {
      const parent = el.parentElement;
      if (parent && window.getComputedStyle && window.getComputedStyle(parent).display === 'none') {
        return false;
      }
      return true;
    }
    const s = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (s && (s.display === 'none' || s.visibility === 'hidden')) return false;

    if (typeof el.getBoundingClientRect === 'function') {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return true;
      if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
        return true;
      }
      return false;
    }
    return true;
  };

  const getLabel = (el: HTMLElement): string => {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl && ok(clean((lbl as HTMLElement).innerText))) return clean((lbl as HTMLElement).innerText);
    }

    const wrapLabel = el.closest('label');
    if (wrapLabel) {
      const clone = wrapLabel.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input,select,textarea,button').forEach((c) => c.remove());
      const t = clean(clone.innerText);
      if (ok(t)) return t;
    }

    const al = el.getAttribute('aria-label');
    if (ok(clean(al))) return clean(al);

    const alb = el.getAttribute('aria-labelledby');
    if (alb) {
      const t = alb
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((n) => clean((n as HTMLElement).innerText))
        .join(' ');
      if (ok(t)) return t;
    }

    let prev = el.previousElementSibling;
    let depth = 0;
    while (prev && depth < 3) {
      const t = clean((prev as HTMLElement).innerText);
      if (ok(t) && !prev.querySelector('input,select,textarea')) return t;
      prev = prev.previousElementSibling;
      depth++;
    }

    // Check parent container label for custom file upload cards
    const parentLabel = el.parentElement?.querySelector('label, h4, h5, strong, .label');
    if (parentLabel && ok(clean((parentLabel as HTMLElement).innerText))) {
      return clean((parentLabel as HTMLElement).innerText);
    }

    if (ok(clean((el as HTMLInputElement).placeholder))) return clean((el as HTMLInputElement).placeholder);
    if ((el as any).name) return clean((el as any).name);
    return '';
  };

  const fields: any[] = [];
  let idx = 0;

  document.querySelectorAll('input, textarea, select').forEach((el) => {
    const htmlEl = el as HTMLInputElement;
    const tag = htmlEl.tagName.toLowerCase();
    const type = (htmlEl.type || (tag === 'textarea' ? 'textarea' : 'text')).toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return;
    const isFile = type === 'file';
    if (!vis(htmlEl, isFile)) return;

    const id = 'ap-field-' + idx++;
    htmlEl.setAttribute('data-admitpilot-id', id);

    const f: any = {
      id,
      kind: tag === 'select' ? 'select' : tag === 'textarea' ? 'textarea' : isFile ? 'file' : 'input',
      type,
      name: htmlEl.name || '',
      placeholder: htmlEl.placeholder || '',
      accept: isFile && htmlEl.accept ? htmlEl.accept : undefined,
      label: getLabel(htmlEl),
      required: htmlEl.required || htmlEl.getAttribute('aria-required') === 'true',
      maxLength: !isFile && htmlEl.maxLength > 0 ? htmlEl.maxLength : null,
      currentValue:
        type === 'checkbox' || type === 'radio'
          ? htmlEl.checked
          : isFile
          ? htmlEl.files?.[0]?.name || ''
          : htmlEl.value,
    };

    if (tag === 'select') {
      const selectEl = htmlEl as unknown as HTMLSelectElement;
      f.options = Array.from(selectEl.options).map((o) => o.text || o.value);
    }

    fields.push(f);
  });

  return fields;
}

/**
 * Controlled form filler: updates native inputs & dispatches synthetic events for React / Angular / Vue portals
 */
export function admitpilotPageFill(mappings: Array<{ fieldId: string; suggestedValue: any }>) {
  let filledCount = 0;

  const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  for (const m of mappings) {
    if (m.suggestedValue === null || m.suggestedValue === undefined) continue;
    const el = document.querySelector(`[data-admitpilot-id="${CSS.escape(m.fieldId)}"]`) as HTMLElement;
    if (!el) continue;

    const tag = el.tagName.toLowerCase();
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    if (type === 'file') continue;

    if (tag === 'select') {
      const sel = el as HTMLSelectElement;
      const targetVal = String(m.suggestedValue).toLowerCase();
      let matched = false;
      for (let i = 0; i < sel.options.length; i++) {
        if (
          sel.options[i].value.toLowerCase() === targetVal ||
          sel.options[i].text.toLowerCase() === targetVal
        ) {
          sel.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (matched) {
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        filledCount++;
      }
    } else if (type === 'checkbox') {
      const chk = el as HTMLInputElement;
      chk.checked = Boolean(m.suggestedValue);
      chk.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount++;
    } else if (tag === 'input' || tag === 'textarea') {
      setNativeValue(el as HTMLInputElement, String(m.suggestedValue));
      filledCount++;
    }
  }

  if (filledCount > 0) {
    admitpilotCelebrate(filledCount, filledCount === 1 ? 'field populated' : 'fields populated');
  }

  return { filledCount };
}

/**
 * Attaches binary candidate documents directly into university portal <input type="file"> elements
 * via HTML5 DataTransfer API + native change/input event dispatch.
 */
export function admitpilotAttachFiles(
  attachments: Array<{
    fieldId: string;
    fileName: string;
    mimeType: string;
    base64: string;
  }>
) {
  let attachedCount = 0;
  const attachedFiles: string[] = [];

  for (const att of attachments) {
    if (!att.base64 || !att.fieldId) continue;
    const inputEl = document.querySelector(
      `[data-admitpilot-id="${CSS.escape(att.fieldId)}"]`
    ) as HTMLInputElement | null;
    if (!inputEl || inputEl.type !== 'file') continue;

    try {
      const binaryString = atob(att.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const file = new File([bytes], att.fileName, {
        type: att.mimeType || 'application/pdf',
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      inputEl.files = dt.files;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      attachedCount++;
      attachedFiles.push(att.fileName);
    } catch (e) {
      console.warn('[AdmitPilot] Failed to attach file to input:', att.fieldId, e);
    }
  }

  if (attachedCount > 0) {
    admitpilotCelebrate(
      attachedCount,
      attachedCount === 1 ? 'document attached to portal' : 'documents attached to portal'
    );
  }

  return { attachedCount, attachedFiles };
}

/**
 * Extracts page headings and snippets for website requirement intelligence
 */
export function admitpilotPageAnalyze() {
  const headings: string[] = [];
  document.querySelectorAll('h1, h2, h3, h4').forEach((h) => {
    const t = (h as HTMLElement).innerText.trim();
    if (t.length > 2 && t.length < 80) headings.push(t);
  });

  const textSnippets: string[] = [];
  document.querySelectorAll('p, li, .requirement, [class*="requirement"]').forEach((el) => {
    const t = (el as HTMLElement).innerText.trim();
    if (
      t.length > 20 &&
      t.length < 240 &&
      (t.toLowerCase().includes('passport') ||
        t.toLowerCase().includes('transcript') ||
        t.toLowerCase().includes('english') ||
        t.toLowerCase().includes('ielts') ||
        t.toLowerCase().includes('document') ||
        t.toLowerCase().includes('degree'))
    ) {
      textSnippets.push(t);
    }
  });

  return {
    url: window.location.href,
    hostname: window.location.hostname,
    title: document.title,
    headings: headings.slice(0, 15),
    detectedTextSnippets: textSnippets.slice(0, 12),
    formSummary: `${document.querySelectorAll('form').length} forms detected on page`,
  };
}
