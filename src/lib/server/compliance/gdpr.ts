// src/lib/server/compliance/gdpr.ts
// EU traffic detection via Cloudflare cf-ipcountry header + GDPR notice injection

export interface GdprConfig {
  enabled: boolean;
  position: 'top' | 'bottom' | 'inline' | 'custom';
  template: string;
  custom_position_index?: number;
}

export const defaultGdprConfig: GdprConfig = {
  enabled: false,
  position: 'bottom',
  template:
    'This website uses cookies and similar technologies to improve your experience. By continuing to browse, you consent to our use of cookies in accordance with our Privacy Policy. You can manage your preferences at any time.',
};

// EU/EEA country codes (ISO 3166-1 alpha-2)
const EU_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  // EEA
  'IS',
  'LI',
  'NO',
  // UK (retained GDPR)
  'GB',
]);

export function isEuCountry(ipCountry: string | null): boolean {
  if (!ipCountry) return false;
  return EU_COUNTRIES.has(ipCountry.toUpperCase());
}

export interface GdprResult {
  isEuTraffic: boolean;
  countryCode: string | null;
  noticeInjected: boolean;
  content: string;
}

export function injectGdprNotice(
  content: string,
  config: GdprConfig,
  ipCountry: string | null,
): GdprResult {
  const eu = isEuCountry(ipCountry);

  if (!eu || !config.enabled) {
    return {
      isEuTraffic: eu,
      countryCode: ipCountry,
      noticeInjected: false,
      content,
    };
  }

  const notice = `\n\n---\n\n**GDPR Notice:** ${config.template}\n\n---\n\n`;
  let modified: string;

  switch (config.position) {
    case 'top':
      modified = notice + content;
      break;
    case 'bottom':
      modified = content + notice;
      break;
    case 'inline': {
      const paraMatch = content.match(/^.*?\n\n/);
      if (paraMatch) {
        const idx = paraMatch[0].length;
        modified = content.slice(0, idx) + notice + content.slice(idx);
      } else {
        modified = notice + content;
      }
      break;
    }
    case 'custom': {
      const paragraphs = content.split(/\n\n+/);
      const idx = config.custom_position_index ?? 1;
      if (idx > 0 && idx < paragraphs.length) {
        paragraphs.splice(idx, 0, `---\n\n**GDPR Notice:** ${config.template}\n\n---`);
        modified = paragraphs.join('\n\n');
      } else {
        modified = notice + content;
      }
      break;
    }
    default:
      modified = notice + content;
  }

  return {
    isEuTraffic: eu,
    countryCode: ipCountry,
    noticeInjected: true,
    content: modified,
  };
}
