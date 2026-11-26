export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

export function humanizeKey(key: string): string {
  return cleanText(
    key
      .replace(/[_\-.]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function normalizeComparable(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes common date strings into standard YYYY-MM-DD
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // MM/DD/YYYY
  // Parse with Date.parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Standard nationality to country mapping and synonyms
 */
const NATIONALITY_COUNTRY_MAP: Record<string, string> = {
  pakistani: 'Pakistan',
  indian: 'India',
  american: 'United States',
  british: 'United Kingdom',
  canadian: 'Canada',
  australian: 'Australia',
  chinese: 'China',
  nigerian: 'Nigeria',
  bangladeshi: 'Bangladesh',
  german: 'Germany',
  french: 'France',
};

export function nationalityToCountry(nat: string): string {
  const norm = normalizeComparable(nat);
  return NATIONALITY_COUNTRY_MAP[norm] || nat;
}

