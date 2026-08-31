// src/lib/server/compliance/medical.ts
// Health/medical term detection + medical disclaimer injection

export interface MedicalConfig {
  enabled: boolean;
  position: 'top' | 'bottom' | 'inline' | 'custom';
  template: string;
  custom_position_index?: number;
}

export const defaultMedicalConfig: MedicalConfig = {
  enabled: false,
  position: 'bottom',
  template:
    'The information provided in this article is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare professional regarding your health. Do not disregard professional medical advice or delay seeking it based on content you read here.',
};

// Health/medical keywords
const MEDICAL_TERMS = [
  'diagnosis',
  'diagnose',
  'diagnosed',
  'diagnostic',
  'treatment',
  'treat',
  'treating',
  'therapeutic',
  'dosage',
  'dose',
  'dosing',
  'overdose',
  'prescription',
  'prescribe',
  'prescribed',
  'medication',
  'symptoms',
  'symptom',
  'symptomatic',
  'disease',
  'illness',
  'condition',
  'disorder',
  'cancer',
  'tumor',
  'tumour',
  'malignant',
  'benign',
  'diabetes',
  'hypertension',
  'cardiovascular',
  'stroke',
  'infection',
  'virus',
  'viral',
  'bacterial',
  'vaccine',
  'vaccination',
  'immunization',
  'surgery',
  'surgical',
  'operation',
  'therapy',
  'therapies',
  'radiation',
  'chemotherapy',
  'clinical trial',
  'clinical study',
  'patient',
  'patients',
  'doctor',
  'physician',
  'specialist',
  'hospital',
  'clinic',
  'medical center',
  'cure',
  'cured',
  'heal',
  'healing',
  'pain relief',
  'painkiller',
  'analgesic',
  'antibiotic',
  'chronic',
  'acute',
  'inflammation',
  'inflammatory',
  'heart attack',
  'heart disease',
  'cardiac',
  'mental health',
  'depression',
  'anxiety',
  'bipolar',
  'schizophrenia',
  'weight loss',
  'diet',
  'nutritional supplement',
];

export interface MedicalResult {
  hasMedicalTerms: boolean;
  termCount: number;
  matchedTerms: string[];
  disclaimerInjected: boolean;
  content: string;
}

export function detectMedicalTerms(content: string): {
  found: boolean;
  count: number;
  terms: string[];
} {
  const lower = content.toLowerCase();
  const matched = new Set<string>();

  for (const term of MEDICAL_TERMS) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower)) {
      matched.add(term);
    }
  }

  const terms = [...matched];
  return { found: terms.length > 0, count: terms.length, terms };
}

export function injectMedicalDisclaimer(content: string, config: MedicalConfig): MedicalResult {
  const { found, count, terms } = detectMedicalTerms(content);

  if (!found || !config.enabled) {
    return {
      hasMedicalTerms: found,
      termCount: count,
      matchedTerms: terms,
      disclaimerInjected: false,
      content,
    };
  }

  const disclaimer = `\n\n> **Medical Disclaimer:** ${config.template}\n\n`;
  let modified: string;

  switch (config.position) {
    case 'top':
      modified = disclaimer + content;
      break;
    case 'bottom':
      modified = content + disclaimer;
      break;
    case 'inline': {
      const paraMatch = content.match(/^.*?\n\n/);
      if (paraMatch) {
        const idx = paraMatch[0].length;
        modified = content.slice(0, idx) + disclaimer + content.slice(idx);
      } else {
        modified = disclaimer + content;
      }
      break;
    }
    case 'custom': {
      const paragraphs = content.split(/\n\n+/);
      const idx = config.custom_position_index ?? 1;
      if (idx > 0 && idx < paragraphs.length) {
        paragraphs.splice(idx, 0, `> **Medical Disclaimer:** ${config.template}`);
        modified = paragraphs.join('\n\n');
      } else {
        modified = disclaimer + content;
      }
      break;
    }
    default:
      modified = disclaimer + content;
  }

  return {
    hasMedicalTerms: found,
    termCount: count,
    matchedTerms: terms,
    disclaimerInjected: true,
    content: modified,
  };
}
