// src/lib/server/compliance/affiliate.ts
// Affiliate link detection + FTC disclosure injection

export interface AffiliateConfig {
  enabled: boolean;
  position: 'top' | 'bottom' | 'inline' | 'custom';
  template: string;
  custom_position_index?: number; // paragraph index for inline/custom
}

export const defaultAffiliateConfig: AffiliateConfig = {
  enabled: false,
  position: 'top',
  template:
    'This post contains affiliate links. We may earn a commission if you make a purchase through these links at no extra cost to you.',
};

// Affiliate domain patterns (amazon, lazada, shopee, tokopedia, referral codes)
const AFFILIATE_PATTERNS = [
  /\bamazon\.[a-z.]+\/(?:dp|gp\/product|exec\/obidos\/ASIN)\/[A-Z0-9]{10}(?:[?/]|$)/i,
  /\bamazon\.[a-z.]+\/(?:[A-Z0-9]{10})(?:[?/]|$)/i,
  /\blazada\.[a-z.]+\/.*[?&]subaffiliate=/i,
  /\blazada\.[a-z.]+\/.*[?&]affiliate=/i,
  /\bshopee\.[a-z.]+\/.*[?&]af=/i,
  /\bshopee\.[a-z.]+\/.*[?&]affiliate=/i,
  /\btokopedia\.[a-z.]+\/.*[?&]af_id=/i,
  /\btokopedia\.[a-z.]+\/.*[?&]src=affiliate/i,
  /[?&]ref=partner[-_]/i,
  /[?&]tag=[a-z0-9]+-20/i, // Amazon affiliate tag
  /[?&]af_[a-z]+=/i, // generic affiliate parameter
];

export interface AffiliateResult {
  hasAffiliateLinks: boolean;
  linkCount: number;
  disclosureInjected: boolean;
  content: string;
}

export function detectAffiliateLinks(content: string): { found: boolean; count: number } {
  let count = 0;
  for (const pattern of AFFILIATE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return { found: count > 0, count };
}

export function injectDisclosure(content: string, config: AffiliateConfig): AffiliateResult {
  const { found, count } = detectAffiliateLinks(content);

  if (!found || !config.enabled) {
    return { hasAffiliateLinks: found, linkCount: count, disclosureInjected: false, content };
  }

  const disclosure = `\n\n*${config.template}*\n\n`;
  let modified: string;

  switch (config.position) {
    case 'top':
      modified = disclosure + content;
      break;
    case 'bottom':
      modified = content + disclosure;
      break;
    case 'inline': {
      // After first paragraph
      const paraMatch = content.match(/^.*?\n\n/);
      if (paraMatch) {
        const idx = paraMatch[0].length;
        modified = content.slice(0, idx) + disclosure + content.slice(idx);
      } else {
        modified = disclosure + content;
      }
      break;
    }
    case 'custom': {
      // After Nth paragraph
      const paragraphs = content.split(/\n\n+/);
      const idx = config.custom_position_index ?? 1;
      if (idx > 0 && idx < paragraphs.length) {
        paragraphs.splice(idx, 0, `*${config.template}*`);
        modified = paragraphs.join('\n\n');
      } else {
        modified = disclosure + content;
      }
      break;
    }
    default:
      modified = disclosure + content;
  }

  return {
    hasAffiliateLinks: found,
    linkCount: count,
    disclosureInjected: true,
    content: modified,
  };
}
