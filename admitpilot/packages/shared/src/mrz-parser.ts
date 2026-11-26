export interface ParsedMRZ {
  valid: boolean;
  checkDigitsValid: boolean;
  documentCode: string;
  issuingState: string;
  issuingCountryName: string;
  familyName: string;
  givenNames: string;
  fullName: string;
  passportNumber: string;
  nationality: string;
  nationalityAdjective: string;
  dateOfBirth: string; // YYYY-MM-DD
  sex: string;
  expiryDate: string; // YYYY-MM-DD
  personalNumber?: string;
  rawLines: [string, string];
}

const ISO3_TO_COUNTRY: Record<string, { country: string; nationality: string }> = {
  PAK: { country: 'Pakistan', nationality: 'Pakistani' },
  GBR: { country: 'United Kingdom', nationality: 'British' },
  USA: { country: 'United States', nationality: 'American' },
  CAN: { country: 'Canada', nationality: 'Canadian' },
  AUS: { country: 'Australia', nationality: 'Australian' },
  NZL: { country: 'New Zealand', nationality: 'New Zealander' },
  IND: { country: 'India', nationality: 'Indian' },
  BGD: { country: 'Bangladesh', nationality: 'Bangladeshi' },
  NGA: { country: 'Nigeria', nationality: 'Nigerian' },
  CHN: { country: 'China', nationality: 'Chinese' },
  DEU: { country: 'Germany', nationality: 'German' },
  FRA: { country: 'France', nationality: 'French' },
  IRL: { country: 'Ireland', nationality: 'Irish' },
  NLD: { country: 'Netherlands', nationality: 'Dutch' },
  SWE: { country: 'Sweden', nationality: 'Swedish' },
  ARE: { country: 'United Arab Emirates', nationality: 'Emirati' },
  SAU: { country: 'Saudi Arabia', nationality: 'Saudi' },
  TUR: { country: 'Turkey', nationality: 'Turkish' },
  MYS: { country: 'Malaysia', nationality: 'Malaysian' },
  LKA: { country: 'Sri Lanka', nationality: 'Sri Lankan' },
  NPL: { country: 'Nepal', nationality: 'Nepali' },
  KEN: { country: 'Kenya', nationality: 'Kenyan' },
  GHA: { country: 'Ghana', nationality: 'Ghanaian' },
  EGY: { country: 'Egypt', nationality: 'Egyptian' },
};

/**
 * ICAO 9303 Modulo-10 check digit calculation (weights 7, 3, 1)
 */
export function computeMrzCheckDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    let val = 0;
    if (ch >= '0' && ch <= '9') {
      val = ch.charCodeAt(0) - 48;
    } else if (ch >= 'A' && ch <= 'Z') {
      val = ch.charCodeAt(0) - 55; // A=10 .. Z=35
    } else {
      val = 0; // '<' = 0
    }
    sum += val * weights[i % 3];
  }
  return sum % 10;
}

/**
 * Parses ICAO 9303 Machine Readable Zone (MRZ) for TD3 passports (2 lines x 44 characters).
 */
export function parseMRZTD3(text: string): ParsedMRZ | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().toUpperCase().replace(/[\s\t]+/g, ''))
    .filter((l) => l.length >= 40 && l.includes('<'));

  let line1 = '';
  let line2 = '';

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^P[A-Z0-9<]/.test(l) && l.length >= 42) {
      line1 = l.slice(0, 44).padEnd(44, '<');
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const next = lines[j];
        if (next.length >= 42 && /^[A-Z0-9<]{40,46}$/.test(next)) {
          line2 = next.slice(0, 44).padEnd(44, '<');
          break;
        }
      }
      if (line1 && line2) break;
    }
  }

  if (!line1 || !line2) {
    const td3Regex = /(P[A-Z0-9<]{43})[\r\n\s]*([A-Z0-9<]{44})/;
    const match = text.toUpperCase().replace(/[ \t]+/g, '').match(td3Regex);
    if (match) {
      line1 = match[1];
      line2 = match[2];
    }
  }

  if (!line1 || !line2 || line1.length < 44 || line2.length < 44) {
    return null;
  }

  const documentCode = line1.substring(0, 2).replace(/</g, '');
  const issuingState = line1.substring(2, 5).replace(/</g, '');
  const nameSection = line1.substring(5, 44);
  const nameParts = nameSection.split('<<');
  const familyName = (nameParts[0] || '').replace(/</g, ' ').trim();
  const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();
  const fullName = [givenNames, familyName].filter(Boolean).join(' ');

  const passportRaw = line2.substring(0, 9);
  const passportCheck = line2.charAt(9);
  const passportNumber = passportRaw.replace(/</g, '').trim();

  const nationality = line2.substring(10, 13).replace(/</g, '').trim();

  const dobRaw = line2.substring(13, 19);
  const dobCheck = line2.charAt(19);
  let dateOfBirth = '';
  if (/^\d{6}$/.test(dobRaw)) {
    const yy = parseInt(dobRaw.substring(0, 2), 10);
    const mm = dobRaw.substring(2, 4);
    const dd = dobRaw.substring(4, 6);
    const yyyy = yy <= 30 ? 2000 + yy : 1900 + yy;
    dateOfBirth = `${yyyy}-${mm}-${dd}`;
  }

  const sexChar = line2.charAt(20);
  const sex = sexChar === 'M' ? 'Male' : sexChar === 'F' ? 'Female' : 'Unspecified';

  const expRaw = line2.substring(21, 27);
  const expCheck = line2.charAt(27);
  let expiryDate = '';
  if (/^\d{6}$/.test(expRaw)) {
    const yy = parseInt(expRaw.substring(0, 2), 10);
    const mm = expRaw.substring(2, 4);
    const dd = expRaw.substring(4, 6);
    const yyyy = 2000 + yy;
    expiryDate = `${yyyy}-${mm}-${dd}`;
  }

  const personalNumber = line2.substring(28, 42).replace(/</g, '').trim();

  // Verify ICAO 9303 Modulo-10 check digits
  const passOk = /^\d$/.test(passportCheck) && computeMrzCheckDigit(passportRaw) === Number(passportCheck);
  const dobOk = /^\d$/.test(dobCheck) && computeMrzCheckDigit(dobRaw) === Number(dobCheck);
  const expOk = /^\d$/.test(expCheck) && computeMrzCheckDigit(expRaw) === Number(expCheck);
  const checkDigitsValid = passOk && dobOk && expOk;

  const issuingCountryName = ISO3_TO_COUNTRY[issuingState]?.country || issuingState;
  const nationalityAdjective = ISO3_TO_COUNTRY[nationality]?.nationality || nationality;

  return {
    valid: Boolean(passportNumber && dateOfBirth && expiryDate),
    checkDigitsValid,
    documentCode,
    issuingState,
    issuingCountryName,
    familyName,
    givenNames,
    fullName,
    passportNumber,
    nationality,
    nationalityAdjective,
    dateOfBirth,
    sex,
    expiryDate,
    personalNumber: personalNumber || undefined,
    rawLines: [line1, line2],
  };
}
