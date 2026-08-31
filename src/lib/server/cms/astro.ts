// src/lib/server/cms/astro.ts
// GitHub App client for Astro/Git publisher
// JWT auth → create file → trigger deploy → poll for completion

import type { ArticleRow } from '../types/article';

export interface AstroConfig {
  github_repo: string;
  github_branch: string;
  github_content_path: string;
  github_installation_id: string;
  github_workflow_file?: string;
  live_url?: string;
}

// ── Helpers ─────────────────────────────────────────────────

function concatBytes(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const r = new Uint8Array(new ArrayBuffer(total));
  let off = 0;
  for (const a of arrays) {
    r.set(a, off);
    off += a.length;
  }
  return r;
}

function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  const b64 = pem
    .replace(/-----BEGIN .*-----/, '')
    .replace(/-----END .*-----/, '')
    .replace(/\s/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Wrap PKCS#1 DER in PKCS#8 structure (for GitHub App keys)
function wrapPkcs1InPkcs8(pkcs1Der: Uint8Array): Uint8Array<ArrayBuffer> {
  const len = pkcs1Der.length;
  const octetHdr = new Uint8Array([0x04, 0x82, (len >> 8) & 0xff, len & 0xff]);
  const algoId = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const inner = concatBytes(version, algoId, octetHdr, pkcs1Der);
  const outerHdr = new Uint8Array([0x30, 0x82, (inner.length >> 8) & 0xff, inner.length & 0xff]);
  return concatBytes(outerHdr, inner);
}

function normalizePem(pem: string): Uint8Array<ArrayBuffer> {
  const trimmed = pem.trim();
  if (trimmed.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    // PKCS#1 → wrap in PKCS#8
    return wrapPkcs1InPkcs8(pemToBytes(trimmed));
  }
  // Assume PKCS#8 already
  return pemToBytes(trimmed);
}

// ── JWT Generation (RS256) ──────────────────────────────────

async function generateAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 60, exp: now + 600, iss: appId };

  const enc = new TextEncoder();
  const hdrB64 = btoa(JSON.stringify(header));
  const payB64 = btoa(JSON.stringify(payload));
  const msg = `${hdrB64}.${payB64}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    normalizePem(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, enc.encode(msg));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${msg}.${sigB64}`;
}

// ── Installation Token ──────────────────────────────────────

async function getInstallationToken(jwt: string, installationId: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub installation token error (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

// ── GitHub Contents API ─────────────────────────────────────

async function createOrUpdateFile(
  token: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
): Promise<{ sha: string }> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const enc = new TextEncoder();
  const contentBytes = enc.encode(content);
  const b64 = btoa(String.fromCharCode(...contentBytes));

  const mkBody = (sha?: string) => {
    const b: Record<string, unknown> = { message, content: b64, branch };
    if (sha) b.sha = sha;
    return JSON.stringify(b);
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json',
  };

  // Try create first
  let res = await fetch(url, { method: 'PUT', headers, body: mkBody() });
  if (res.ok) {
    const d = (await res.json()) as { content?: { sha: string } };
    return { sha: d.content?.sha ?? '' };
  }

  // 422 = file exists, get sha and update
  if (res.status === 422) {
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const existing = (await getRes.json()) as { sha: string };
      res = await fetch(url, { method: 'PUT', headers, body: mkBody(existing.sha) });
      if (res.ok) {
        const d = (await res.json()) as { content?: { sha: string } };
        return { sha: d.content?.sha ?? '' };
      }
    }
  }

  const errBody = await res.text();
  throw new Error(`GitHub Contents API error (${res.status}): ${errBody}`);
}

// ── Workflow Dispatch ───────────────────────────────────────

async function triggerWorkflow(
  token: string,
  repo: string,
  workflowFile: string,
  ref: string,
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref }),
    },
  );
  // 204 = accepted (no content)
  if (res.ok || res.status === 204) return;
  const err = await res.text();
  throw new Error(`GitHub workflow dispatch error (${res.status}): ${err}`);
}

// ── Poll Workflow Run ───────────────────────────────────────

interface WorkflowRunResult {
  success: boolean;
  htmlUrl: string;
}

async function pollWorkflowRun(
  token: string,
  repo: string,
  branch: string,
  triggerTime: string,
  timeoutMs = 300_000,
): Promise<WorkflowRunResult> {
  const pollInterval = 15_000;
  const start = Date.now();

  // Initial wait for workflow to appear
  await new Promise((r) => setTimeout(r, 10_000));

  while (Date.now() - start < timeoutMs) {
    const url = `https://api.github.com/repos/${repo}/actions/runs?event=workflow_dispatch&branch=${encodeURIComponent(branch)}&per_page=5`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      await new Promise((r) => setTimeout(r, pollInterval));
      continue;
    }

    const data = (await res.json()) as {
      workflow_runs: Array<{
        id: number;
        status: string;
        conclusion: string | null;
        created_at: string;
        html_url: string;
      }>;
    };

    const runs = data.workflow_runs || [];
    const latestRun = runs.find((run) => run.created_at >= triggerTime);

    if (!latestRun) {
      await new Promise((r) => setTimeout(r, pollInterval));
      continue;
    }

    if (latestRun.status === 'completed') {
      return { success: latestRun.conclusion === 'success', htmlUrl: latestRun.html_url };
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error('Deploy poll timeout: workflow did not complete within 5 minutes');
}

// ── Frontmatter Builder ─────────────────────────────────────

function escapeYaml(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function buildFrontmatter(article: ArticleRow, config: AstroConfig): string {
  let fm: Record<string, unknown> = {};
  try {
    fm = article.frontmatter_json ? JSON.parse(article.frontmatter_json) : {};
  } catch {
    // ignore parse errors
  }

  const lines: string[] = ['---'];
  lines.push(`title: "${escapeYaml(article.title || 'Untitled')}"`);

  if (fm.description) {
    lines.push(`description: "${escapeYaml(String(fm.description))}"`);
  }

  if (Array.isArray(fm.tags) && fm.tags.length > 0) {
    const s = fm.tags.map((t: unknown) => `"${escapeYaml(String(t))}"`).join(', ');
    lines.push(`tags: [${s}]`);
  }

  if (Array.isArray(fm.categories) && fm.categories.length > 0) {
    const s = fm.categories.map((c: unknown) => `"${escapeYaml(String(c))}"`).join(', ');
    lines.push(`categories: [${s}]`);
  } else if (fm.category) {
    lines.push(`categories: ["${escapeYaml(String(fm.category))}"]`);
  }

  const date = article.scheduled_for || new Date().toISOString();
  lines.push(`date: "${date}"`);

  // Construct canonical URL
  const slug = article.slug || '';
  const repoParts = config.github_repo.split('/');
  const defaultDeployUrl =
    repoParts.length === 2
      ? `https://${repoParts[0]}.github.io/${repoParts[1]}`
      : `https://github.com/${config.github_repo}`;
  const deployUrl = config.live_url || defaultDeployUrl;
  const canonical = fm.canonical
    ? String(fm.canonical)
    : `${deployUrl.replace(/\/+$/, '')}/${slug}`;
  lines.push(`canonical: "${escapeYaml(canonical)}"`);

  if (fm['og:image']) {
    lines.push(`og:image: "${escapeYaml(String(fm['og:image']))}"`);
  }

  lines.push('draft: false');
  lines.push('---');

  return lines.join('\n');
}

// ── Public API ──────────────────────────────────────────────

export async function publishArticle(
  article: ArticleRow,
  config: AstroConfig,
  env: { GITHUB_APP_ID?: string; GITHUB_APP_PRIVATE_KEY?: string },
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
  deployUrl?: string;
}> {
  try {
    if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
      return {
        success: false,
        error: 'GitHub App credentials not configured (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY)',
      };
    }

    if (!config.github_repo || !config.github_installation_id) {
      return { success: false, error: 'GitHub repo and installation ID required in site config' };
    }

    // 1. Authenticate as GitHub App
    const jwt = await generateAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
    const token = await getInstallationToken(jwt, config.github_installation_id);

    // 2. Build file content
    const contentPath = config.github_content_path || 'src/content/posts';
    const slug = article.slug || article.id;
    const filePath = `${contentPath.replace(/\/+$/, '')}/${slug}.md`;
    const frontmatter = buildFrontmatter(article, config);
    const fileContent = `${frontmatter}\n\n${article.content_md || ''}`;

    // 3. Create/update file in repo
    await createOrUpdateFile(
      token,
      config.github_repo,
      filePath,
      fileContent,
      `feat: publish "${article.title || 'Untitled'}" [skip ci]`,
      config.github_branch || 'main',
    );

    // 4. Trigger GitHub Actions deploy
    const workflowFile = config.github_workflow_file || 'deploy.yml';
    const triggerTime = new Date().toISOString();
    await triggerWorkflow(token, config.github_repo, workflowFile, config.github_branch || 'main');

    // 5. Poll for deploy completion
    const deployResult = await pollWorkflowRun(
      token,
      config.github_repo,
      config.github_branch || 'main',
      triggerTime,
    );

    if (!deployResult.success) {
      return {
        success: false,
        error: `Deploy failed: ${deployResult.htmlUrl}`,
        deployUrl: deployResult.htmlUrl,
      };
    }

    // 6. Construct live URL
    const repoParts = config.github_repo.split('/');
    const defaultDeployUrl =
      repoParts.length === 2
        ? `https://${repoParts[0]}.github.io/${repoParts[1]}`
        : `https://github.com/${config.github_repo}`;
    const baseUrl = config.live_url || defaultDeployUrl;
    const liveUrl = `${baseUrl.replace(/\/+$/, '')}/${slug}`;

    return { success: true, url: liveUrl, deployUrl: deployResult.htmlUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
