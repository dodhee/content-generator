// src/lib/server/compliance/indonesia.ts
// Indonesia jurisdiction: UU ITE disclaimer + PPN (VAT) disclaimer templates

export interface IndonesiaConfig {
  enabled: boolean;
  uuItePosition: 'top' | 'bottom' | 'inline' | 'custom';
  uuIteTemplate: string;
  ppnPosition: 'top' | 'bottom' | 'inline' | 'custom';
  ppnTemplate: string;
  custom_position_index?: number;
}

export const defaultUuIteTemplate =
  'Konten ini disediakan untuk tujuan informasi umum saja dan tidak dimaksudkan sebagai nasihat hukum. Setiap tindakan yang Anda lakukan berdasarkan informasi ini adalah tanggung jawab Anda sendiri. Penulis tidak bertanggung jawab atas kerugian atau konsekuensi yang timbul dari penggunaan informasi ini.';

export const defaultPpnTemplate =
  'Harga yang tercantum belum termasuk Pajak Pertambahan Nilai (PPN) sebesar 11% sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.';

export const defaultIndonesiaConfig: IndonesiaConfig = {
  enabled: false,
  uuItePosition: 'bottom',
  uuIteTemplate: defaultUuIteTemplate,
  ppnPosition: 'bottom',
  ppnTemplate: defaultPpnTemplate,
};

export interface IndonesiaResult {
  uuIteInjected: boolean;
  ppnInjected: boolean;
  content: string;
}

function injectAtPosition(
  content: string,
  disclosure: string,
  position: 'top' | 'bottom' | 'inline' | 'custom',
  customIndex?: number,
): string {
  switch (position) {
    case 'top':
      return disclosure + content;
    case 'bottom':
      return content + disclosure;
    case 'inline': {
      const paraMatch = content.match(/^.*?\n\n/);
      if (paraMatch) {
        const idx = paraMatch[0].length;
        return content.slice(0, idx) + disclosure + content.slice(idx);
      }
      return disclosure + content;
    }
    case 'custom': {
      const paragraphs = content.split(/\n\n+/);
      const idx = customIndex ?? 1;
      if (idx > 0 && idx < paragraphs.length) {
        paragraphs.splice(idx, 0, disclosure.trim());
        return paragraphs.join('\n\n');
      }
      return disclosure + content;
    }
    default:
      return disclosure + content;
  }
}

export function injectIndonesiaDisclaimers(
  content: string,
  config: IndonesiaConfig,
): IndonesiaResult {
  if (!config.enabled) {
    return { uuIteInjected: false, ppnInjected: false, content };
  }

  let modified = content;
  let uuIteInjected = false;
  let ppnInjected = false;

  // Inject UU ITE disclaimer
  const uuIteBlock = `\n\n> **UU ITE Disclaimer:** ${config.uuIteTemplate}\n\n`;
  modified = injectAtPosition(
    modified,
    uuIteBlock,
    config.uuItePosition,
    config.custom_position_index,
  );
  uuIteInjected = true;

  // Inject PPN disclaimer
  const ppnBlock = `\n\n> **PPN Disclaimer:** ${config.ppnTemplate}\n\n`;
  modified = injectAtPosition(modified, ppnBlock, config.ppnPosition, config.custom_position_index);
  ppnInjected = true;

  return { uuIteInjected, ppnInjected, content: modified };
}
