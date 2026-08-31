// src/lib/server/quality/readability.ts
// Flesch-Kincaid (EN) + Flesch-Douma (ID) + niche targets

export interface ReadabilityResult {
  score: number;
  level: string;
  grade: number;
  targetScore: number;
  passed: boolean;
  lang: 'en' | 'id';
}

// Flesch-Kincaid grade level (US English)
export function fleschKincaid(text: string): { score: number; grade: number } {
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  const syllables = countSyllables(text);

  if (sentences.length === 0 || words.length === 0) {
    return { score: 100, grade: 0 };
  }

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

  // Flesch-Kincaid Grade Level: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
  const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

  return {
    score: Math.max(0, Math.min(100, score)),
    grade: Math.max(0, grade),
  };
}

// Flesch-Douma for Indonesian (adjusted formula)
// Indonesian is more phonetic — simpler syllable rules, shorter words
// Adopted formula: 220 - 0.9 * (words/sentences) - 60 * (syllables/words)
export function fleschDouma(text: string): { score: number; grade: number } {
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  const syllables = countSyllables(text);

  if (sentences.length === 0 || words.length === 0) {
    return { score: 100, grade: 0 };
  }

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Adjusted for Indonesian: higher base, gentler penalties
  const score = 220 - 0.9 * avgWordsPerSentence - 60 * avgSyllablesPerWord;

  // Grade approximation for ID
  const grade = 0.3 * avgWordsPerSentence + 10 * avgSyllablesPerWord - 10;

  return {
    score: Math.max(0, Math.min(100, score)),
    grade: Math.max(0, grade),
  };
}

// Syllable counter (approximate, English)
function countSyllables(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  let count = 0;
  for (const word of words) {
    count += syllableCountWord(word);
  }
  return count;
}

function syllableCountWord(w: string): number {
  const clean = w.replace(/[^a-z]/g, '');
  if (clean.length <= 3) return 1;

  const vowels = clean.match(/[aeiouy]/g);
  if (!vowels) return 1;

  let count = vowels.length;
  // Subtract for silent e at end
  if (clean.endsWith('e') && !clean.endsWith('le') && count > 1) count--;
  if (clean.endsWith('es') || clean.endsWith('ed')) {
    if (count > 1) count--;
  }
  // Subtract for consecutive vowels
  count -= (clean.match(/[aeiouy]{2}/g) ?? []).length;
  return Math.max(1, count);
}

function levelLabel(score: number): string {
  if (score >= 90) return 'Very Easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Confusing';
}

// Default niche targets: Flesch Reading Ease score
const NICHE_TARGETS: Record<string, { en: number; id: number }> = {
  general: { en: 60, id: 65 },
  technology: { en: 50, id: 55 },
  health: { en: 55, id: 60 },
  finance: { en: 45, id: 50 },
  legal: { en: 35, id: 40 },
  education: { en: 55, id: 60 },
  lifestyle: { en: 65, id: 70 },
  news: { en: 55, id: 60 },
  travel: { en: 60, id: 65 },
  food: { en: 65, id: 70 },
  sports: { en: 55, id: 60 },
  entertainment: { en: 60, id: 65 },
  business: { en: 50, id: 55 },
  marketing: { en: 55, id: 60 },
  science: { en: 45, id: 50 },
};

export function getNicheTarget(niche: string, lang: 'en' | 'id'): number {
  const entry =
    NICHE_TARGETS[niche.toLowerCase()] ?? (NICHE_TARGETS.general as { en: number; id: number });
  return entry[lang];
}

export function checkReadability(
  text: string,
  lang: 'en' | 'id',
  niche?: string,
): ReadabilityResult {
  const result = lang === 'id' ? fleschDouma(text) : fleschKincaid(text);
  const targetScore = getNicheTarget(niche ?? 'general', lang);

  return {
    score: Number(result.score.toFixed(1)),
    level: levelLabel(result.score),
    grade: Number(result.grade.toFixed(1)),
    targetScore,
    passed: result.score >= targetScore,
    lang,
  };
}
