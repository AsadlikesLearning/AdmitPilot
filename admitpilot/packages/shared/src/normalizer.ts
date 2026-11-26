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

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

/**
 * Normalizes common international date strings into standard YYYY-MM-DD
 * Supports YYYY-MM-DD, DD/MM/YYYY, DD/MMM/YYYY (01/JUN/2025), DD MMM YYYY, MMM DD, YYYY
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  // DD/MMM/YYYY, DD-MMM-YYYY, or DD MMM YYYY (e.g. 01/JUN/2025, 16 FEB 2021)
  const dMonY = s.match(/^(\d{1,2})[\s\/\-.]+([A-Za-z]{3,9})[\s\/\-.]+(\d{4})$/);
  if (dMonY) {
    const mon = MONTH_MAP[dMonY[2].toLowerCase()];
    if (mon) {
      return `${dMonY[3]}-${mon}-${dMonY[1].padStart(2, '0')}`;
    }
  }

  // MMM DD, YYYY (e.g. June 01, 2025)
  const monDY = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monDY) {
    const mon = MONTH_MAP[monDY[1].toLowerCase()];
    if (mon) {
      return `${monDY[3]}-${mon}-${monDY[2].padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    let day = parseInt(dmy[1], 10);
    let month = parseInt(dmy[2], 10);
    const year = dmy[3];
    // Handle US MM/DD/YYYY when second number > 12
    if (month > 12 && day <= 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
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
