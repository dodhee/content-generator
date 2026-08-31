// src/lib/server/ai/image.ts
// Media Management: AI image generation (Pollinations), R2 upload, alt text, compression

import type { Env } from '../../db/index';

export interface GeneratedImage {
  url: string; // R2 public URL
  alt: string;
  prompt: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ImageGenerationOptions {
  prompt: string;
  articleId?: string;
  topic?: string;
  width?: number;
  height?: number;
  model?: 'flux' | 'gptimage' | 'midjourney';
  seed?: number;
}

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt/';
const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 0.8;

function buildPollinationsUrl(prompt: string, options: ImageGenerationOptions): string {
  const encodedPrompt = encodeURIComponent(prompt);
  const params = new URLSearchParams();
  params.set('model', options.model || 'flux');
  params.set('width', String(options.width || 1024));
  params.set('height', String(options.height || 1024));
  params.set('nologo', 'true');
  params.set('private', 'true');
  if (options.seed) params.set('seed', String(options.seed));
  return `${POLLINATIONS_BASE}${encodedPrompt}?${params.toString()}`;
}

async function fetchImageBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return response.arrayBuffer();
}

async function compressToWebP(
  buffer: ArrayBuffer,
  maxWidth: number,
  quality: number,
): Promise<{ buffer: ArrayBuffer; width: number; height: number }> {
  // Use Canvas API via OffscreenCanvas (available in Cloudflare Workers)
  const imageBitmap = await createImageBitmap(new Blob([buffer]));
  const originalWidth = imageBitmap.width;
  const originalHeight = imageBitmap.height;

  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  if (originalWidth > maxWidth) {
    const ratio = maxWidth / originalWidth;
    targetWidth = maxWidth;
    targetHeight = Math.round(originalHeight * ratio);
  }

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  imageBitmap.close();

  const webpBlob = await canvas.convertToBlob({ type: 'image/webp', quality });
  return {
    buffer: await webpBlob.arrayBuffer(),
    width: targetWidth,
    height: targetHeight,
  };
}

async function uploadToR2(
  env: Env,
  key: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const bucket = env.R2_MEDIA;
  if (!bucket) {
    throw new Error('R2_MEDIA binding not configured');
  }

  await bucket.put(key, buffer, {
    httpMetadata: { contentType },
    customMetadata: { uploadedAt: new Date().toISOString() },
  });

  // Return public URL (assumes custom domain or public bucket)
  const baseUrl =
    env.R2_PUBLIC_URL || `https://${env.R2_BUCKET_NAME}.${env.ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return `${baseUrl}/${key}`;
}

function generateAltText(prompt: string, topic?: string): string {
  const base = prompt.trim();
  if (topic) {
    return `${base} — illustration for article about ${topic}`;
  }
  return `${base} — AI generated illustration`;
}

function generateR2Key(workspaceId: string, articleId: string | undefined): string {
  const uuid = crypto.randomUUID();
  const articlePart = articleId || 'draft';
  return `images/${workspaceId}/${articlePart}/${uuid}.webp`;
}

export async function generateImage(
  env: Env,
  workspaceId: string,
  options: ImageGenerationOptions,
): Promise<GeneratedImage> {
  const pollinationsUrl = buildPollinationsUrl(options.prompt, options);

  // Fetch image from Pollinations
  const imageBuffer = await fetchImageBuffer(pollinationsUrl);

  // Compress to WebP
  const {
    buffer: webpBuffer,
    width,
    height,
  } = await compressToWebP(imageBuffer, MAX_DIMENSION, WEBP_QUALITY);

  // Generate alt text
  const alt = generateAltText(options.prompt, options.topic);

  // Upload to R2
  const key = generateR2Key(workspaceId, options.articleId);
  const publicUrl = await uploadToR2(env, key, webpBuffer, 'image/webp');

  return {
    url: publicUrl,
    alt,
    prompt: options.prompt,
    width,
    height,
    sizeBytes: webpBuffer.byteLength,
  };
}

export async function uploadImage(
  env: Env,
  workspaceId: string,
  articleId: string | undefined,
  file: File,
): Promise<GeneratedImage> {
  const buffer = await file.arrayBuffer();

  // Compress to WebP
  const {
    buffer: webpBuffer,
    width,
    height,
  } = await compressToWebP(buffer, MAX_DIMENSION, WEBP_QUALITY);

  // Generate alt text from filename
  const alt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

  // Upload to R2
  const key = generateR2Key(workspaceId, articleId);
  const publicUrl = await uploadToR2(env, key, webpBuffer, 'image/webp');

  return {
    url: publicUrl,
    alt,
    prompt: '',
    width,
    height,
    sizeBytes: webpBuffer.byteLength,
  };
}

export async function listImages(
  env: Env,
  workspaceId: string,
  articleId?: string,
  limit = 50,
): Promise<Array<{ key: string; url: string; size: number; uploadedAt: string }>> {
  const bucket = env.R2_MEDIA;
  if (!bucket) {
    throw new Error('R2_MEDIA binding not configured');
  }

  const prefix = articleId ? `images/${workspaceId}/${articleId}/` : `images/${workspaceId}/`;
  const objects = await bucket.list({ prefix, limit });

  const baseUrl =
    env.R2_PUBLIC_URL || `https://${env.R2_BUCKET_NAME}.${env.ACCOUNT_ID}.r2.cloudflarestorage.com`;

  return objects.objects.map((obj) => ({
    key: obj.key,
    url: `${baseUrl}/${obj.key}`,
    size: obj.size,
    uploadedAt:
      obj.customMetadata?.uploadedAt || obj.httpMetadata?.lastModified?.toISOString() || '',
  }));
}
