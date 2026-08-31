// src/lib/server/quality/index.ts
// Unified quality gate runner (called before publish)

import { logAudit } from '../audit';
import type { Env } from '../db/index';
import { getSiteById } from '../sites';
import { checkAiDetection } from './ai-detection';
import { type BrandSafetyHit, checkBrandSafety, parseBrandSafetyConfig } from './brand-safety';
import { verifyClaims } from './factcheck';
import { checkPlagiarism } from './plagiarism';
import { checkReadability } from './readability';

export interface QualityGateConfig {
  skipPlagiarism?: boolean;
  skipAiDetection?: boolean;
  skipReadability?: boolean;
  skipFactCheck?: boolean;
  skipBrandSafety?: boolean;
  plagiarismThreshold?: number;
  readabilityNiche?: string;
  readabilityLang?: 'en' | 'id';
  copyleaksKey?: string;
  gptzeroKey?: string;
}

export interface QualityGateResult {
  plagiarism: { score: number; passed: boolean; method: string };
  aiDetection: { aiScore: number; passed: boolean; method: string };
  readability: { score: number; passed: boolean; lang: string; level: string };
  factCheck: { totalClaims: number; verified: number };
  brandSafety: { flagged: boolean; hits: number };
  passed: boolean;
  articleId: string;
  siteId: string;
}

export async function runQualityGates(
  articleId: string,
  siteId: string,
  text: string,
  env: Env,
  config?: QualityGateConfig,
): Promise<QualityGateResult> {
  const cfg = config ?? {};

  // Read site config for brand safety
  const site = await getSiteById(env.DB, siteId);
  const siteConfig = site?.config_json
    ? (JSON.parse(site.config_json) as Record<string, unknown>)
    : {};
  const brandConfig = parseBrandSafetyConfig(siteConfig);

  const [plagiarism, aiDetection, readability, factCheck, brandSafety] = await Promise.all([
    cfg.skipPlagiarism
      ? Promise.resolve({ score: 0, passed: true, method: 'skipped' })
      : checkPlagiarism(text, env.DB, {
          threshold: cfg.plagiarismThreshold,
          articleId,
          siteId,
          workspaceId: undefined,
          copyleaksKey: cfg.copyleaksKey,
        }),
    cfg.skipAiDetection
      ? Promise.resolve({ aiScore: 0, passed: true, method: 'skipped' })
      : checkAiDetection(text, { gptzeroKey: cfg.gptzeroKey }),
    cfg.skipReadability
      ? Promise.resolve({ score: 0, passed: true, lang: cfg.readabilityLang ?? 'en', level: '' })
      : Promise.resolve(checkReadability(text, cfg.readabilityLang ?? 'en', cfg.readabilityNiche)),
    cfg.skipFactCheck
      ? Promise.resolve<{ totalClaims: number; verified: number }>({ totalClaims: 0, verified: 0 })
      : verifyClaims(text).then((claims) => ({
          totalClaims: claims.length,
          verified: claims.filter((c) => c.status === 'verified').length,
        })),
    cfg.skipBrandSafety
      ? Promise.resolve({ flagged: false, hits: [] as BrandSafetyHit[] })
      : Promise.resolve(checkBrandSafety(text, brandConfig)),
  ]);

  const passed = plagiarism.passed && readability.passed && !brandSafety.flagged;

  const result: QualityGateResult = {
    plagiarism: { score: plagiarism.score, passed: plagiarism.passed, method: plagiarism.method },
    aiDetection: {
      aiScore: aiDetection.aiScore,
      passed: aiDetection.passed,
      method: aiDetection.method,
    },
    readability: {
      score: readability.score,
      passed: readability.passed,
      lang: readability.lang,
      level: readability.level,
    },
    factCheck: { totalClaims: factCheck.totalClaims, verified: factCheck.verified },
    brandSafety: { flagged: brandSafety.flagged, hits: brandSafety.hits.length },
    passed,
    articleId,
    siteId,
  };

  // Audit log
  await logAudit(env.DB, {
    articleId,
    siteId,
    action: 'quality_gate',
    details: { result: JSON.parse(JSON.stringify(result)) },
  });

  return result;
}
