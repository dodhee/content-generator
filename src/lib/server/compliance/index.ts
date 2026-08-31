// src/lib/server/compliance/index.ts
// Unified compliance runner (called in quality gates or publish pipeline)

import { logAudit } from '../audit';
import type { Env } from '../db/index';
import { getSiteById } from '../sites';
import {
  type AffiliateConfig,
  type AffiliateResult,
  defaultAffiliateConfig,
  injectDisclosure,
} from './affiliate';
import { type GdprConfig, type GdprResult, defaultGdprConfig, injectGdprNotice } from './gdpr';
import {
  type IndonesiaConfig,
  type IndonesiaResult,
  defaultIndonesiaConfig,
  injectIndonesiaDisclaimers,
} from './indonesia';
import {
  type MedicalConfig,
  type MedicalResult,
  defaultMedicalConfig,
  injectMedicalDisclaimer,
} from './medical';

export interface ComplianceConfig {
  affiliate?: Partial<AffiliateConfig>;
  medical?: Partial<MedicalConfig>;
  gdpr?: Partial<GdprConfig>;
  indonesia?: Partial<IndonesiaConfig>;
}

export interface ComplianceResult {
  affiliate: AffiliateResult;
  medical: MedicalResult;
  gdpr: GdprResult;
  indonesia: IndonesiaResult;
  content: string;
  articleId: string;
  siteId: string;
  passed: boolean;
}

// Parse compliance config from site config_json
export function parseComplianceConfig(
  siteConfig: Record<string, unknown>,
  request?: Request,
): {
  affiliate: AffiliateConfig;
  medical: MedicalConfig;
  gdpr: GdprConfig;
  indonesia: IndonesiaConfig;
  ipCountry: string | null;
} {
  const raw = (siteConfig.compliance ?? {}) as Record<string, unknown>;
  const affiliateRaw = (raw.affiliate ?? {}) as Record<string, unknown>;
  const medicalRaw = (raw.medical ?? {}) as Record<string, unknown>;
  const gdprRaw = (raw.gdpr ?? {}) as Record<string, unknown>;
  const indonesiaRaw = (raw.indonesia ?? {}) as Record<string, unknown>;

  // Extract IP country from Cloudflare header
  let ipCountry: string | null = null;
  if (request) {
    ipCountry = request.headers.get('cf-ipcountry') ?? null;
  }

  return {
    affiliate: {
      enabled: affiliateRaw.enabled === true,
      position:
        (affiliateRaw.position as AffiliateConfig['position']) ?? defaultAffiliateConfig.position,
      template: String(affiliateRaw.template ?? defaultAffiliateConfig.template),
      custom_position_index:
        affiliateRaw.custom_position_index != null
          ? Number(affiliateRaw.custom_position_index)
          : undefined,
    },
    medical: {
      enabled: medicalRaw.enabled === true,
      position: (medicalRaw.position as MedicalConfig['position']) ?? defaultMedicalConfig.position,
      template: String(medicalRaw.template ?? defaultMedicalConfig.template),
      custom_position_index:
        medicalRaw.custom_position_index != null
          ? Number(medicalRaw.custom_position_index)
          : undefined,
    },
    gdpr: {
      enabled: gdprRaw.enabled === true,
      position: (gdprRaw.position as GdprConfig['position']) ?? defaultGdprConfig.position,
      template: String(gdprRaw.template ?? defaultGdprConfig.template),
      custom_position_index:
        gdprRaw.custom_position_index != null ? Number(gdprRaw.custom_position_index) : undefined,
    },
    indonesia: {
      enabled: indonesiaRaw.enabled === true,
      uuItePosition:
        (indonesiaRaw.uu_ite_position as IndonesiaConfig['uuItePosition']) ??
        defaultIndonesiaConfig.uuItePosition,
      uuIteTemplate: String(indonesiaRaw.uu_ite_template ?? defaultIndonesiaConfig.uuIteTemplate),
      ppnPosition:
        (indonesiaRaw.ppn_position as IndonesiaConfig['ppnPosition']) ??
        defaultIndonesiaConfig.ppnPosition,
      ppnTemplate: String(indonesiaRaw.ppn_template ?? defaultIndonesiaConfig.ppnTemplate),
      custom_position_index:
        indonesiaRaw.custom_position_index != null
          ? Number(indonesiaRaw.custom_position_index)
          : undefined,
    },
    ipCountry,
  };
}

export async function runComplianceChecks(
  articleId: string,
  siteId: string,
  text: string,
  env: Env,
  request?: Request,
): Promise<ComplianceResult> {
  // Read site config
  const site = await getSiteById(env.DB, siteId);
  const siteConfig = site?.config_json
    ? (JSON.parse(site.config_json) as Record<string, unknown>)
    : {};
  const cfg = parseComplianceConfig(siteConfig, request);

  // Run all checks sequentially (each may modify content)
  let content = text;

  const affiliate = injectDisclosure(content, cfg.affiliate);
  content = affiliate.content;

  const medical = injectMedicalDisclaimer(content, cfg.medical);
  content = medical.content;

  const gdpr = injectGdprNotice(content, cfg.gdpr, cfg.ipCountry);
  content = gdpr.content;

  const indonesia = injectIndonesiaDisclaimers(content, cfg.indonesia);
  content = indonesia.content;

  const passed = true; // compliance injections are advisory, not blocking

  const result: ComplianceResult = {
    affiliate,
    medical,
    gdpr,
    indonesia,
    content,
    articleId,
    siteId,
    passed,
  };

  // Audit log
  await logAudit(env.DB, {
    articleId,
    siteId,
    action: 'compliance_check',
    details: {
      affiliate: {
        hasAffiliateLinks: affiliate.hasAffiliateLinks,
        disclosureInjected: affiliate.disclosureInjected,
      },
      medical: {
        hasMedicalTerms: medical.hasMedicalTerms,
        disclaimerInjected: medical.disclaimerInjected,
      },
      gdpr: { isEuTraffic: gdpr.isEuTraffic, noticeInjected: gdpr.noticeInjected },
      indonesia: { uuIteInjected: indonesia.uuIteInjected, ppnInjected: indonesia.ppnInjected },
    },
  });

  return result;
}
