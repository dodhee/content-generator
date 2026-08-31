// src/components/SitesManager.tsx
// SolidJS component for site management with Style DNA panel

import { createEffect, createSignal, onMount } from 'solid-js';
import { StyleDNAPanel } from './StyleDNAPanel.solid';

interface Site {
  id: string;
  name: string;
  type: 'wordpress' | 'blogger' | 'astro' | 'webhook';
  config: Record<string, unknown>;
  is_active: boolean;
}

interface FormState {
  name: string;
  type: 'wordpress' | 'blogger' | 'astro' | 'webhook';
  wpUrl: string;
  wpUsername: string;
  wpAppPassword: string;
  bloggerBlogId: string;
  bloggerRefreshToken: string;
  githubRepo: string;
  githubBranch: string;
  webhookUrl: string;
  webhookSecret: string;
  defaultCategory: string;
}

export function SitesManager(_props: { workspaceId: string }) {
  const [sites, setSites] = createSignal<Site[]>([]);
  const [_loading, setLoading] = createSignal(true);
  const [_error, setError] = createSignal<string | null>(null);
  const [formError, setFormError] = createSignal<string | null>(null);
  const [selectedSite, setSelectedSite] = createSignal<Site | null>(null);
  const [siteDNA, setSiteDNA] = createSignal<{
    has_dna: boolean;
    dna: { examples: unknown[]; patterns: unknown; analyzedAt: string; postCount: number } | null;
  } | null>(null);

  const [form, setForm] = createSignal<FormState>({
    name: '',
    type: 'wordpress',
    wpUrl: '',
    wpUsername: '',
    wpAppPassword: '',
    bloggerBlogId: '',
    bloggerRefreshToken: '',
    githubRepo: '',
    githubBranch: 'main',
    webhookUrl: '',
    webhookSecret: '',
    defaultCategory: '',
  });

  const fetchSites = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sites', { credentials: 'include' });
      if (response.status === 401) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch sites');
      const data = await response.json();
      setSites(
        data.map(
          (item: {
            row: { id: string; name: string; type: string; is_active: number };
            config: Record<string, unknown>;
          }) => ({
            id: item.row.id,
            name: item.row.name,
            type: item.row.type as Site['type'],
            config: item.config,
            is_active: item.row.is_active === 1,
          }),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchSites();
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Delete site?')) return;
    try {
      const response = await fetch(`/api/sites/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Delete failed');
      fetchSites();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleSelectSite = (site: Site) => {
    setSelectedSite(site);
    // Fetch Style DNA status for this site
    fetch(`/api/style-dna?site_id=${site.id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSiteDNA(data);
      })
      .catch(() => setSiteDNA(null));
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setFormError(null);

    const f = form();
    const config: Record<string, unknown> = {};
    if (f.type === 'wordpress') {
      config.wp_url = f.wpUrl;
      config.wp_username = f.wpUsername;
      config.wp_app_password = f.wpAppPassword;
    } else if (f.type === 'blogger') {
      config.blogger_blog_id = f.bloggerBlogId;
      config.blogger_refresh_token = f.bloggerRefreshToken;
    } else if (f.type === 'astro') {
      config.github_repo = f.githubRepo;
      config.github_branch = f.githubBranch;
    } else if (f.type === 'webhook') {
      config.webhook_url = f.webhookUrl;
      config.webhook_secret = f.webhookSecret;
    }
    if (f.defaultCategory) {
      config.default_category = f.defaultCategory;
    }

    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name,
          type: f.type,
          config,
          is_active: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create site');
      }

      setForm({
        name: '',
        type: 'wordpress',
        wpUrl: '',
        wpUsername: '',
        wpAppPassword: '',
        bloggerBlogId: '',
        bloggerRefreshToken: '',
        githubRepo: '',
        githubBranch: 'main',
        webhookUrl: '',
        webhookSecret: '',
        defaultCategory: '',
      });
      fetchSites();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const getUrl = (site: Site): string => {
    if (site.type === 'wordpress') return (site.config.wp_url as string) || '';
    if (site.type === 'blogger')
      return `https://www.blogger.com/blog/posts/${site.config.blogger_blog_id}` || '';
    if (site.type === 'astro') return (site.config.github_repo as string) || '';
    if (site.type === 'webhook') return (site.config.webhook_url as string) || '';
    return '';
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const typeOptions = [
    { value: 'wordpress', label: 'WordPress' },
    { value: 'blogger', label: 'Blogger' },
    { value: 'astro', label: 'Astro' },
    { value: 'webhook', label: 'Webhook' },
  ] as const;

  return (
    <div class="space-y-8">
      <div class="border border-slate-700 rounded-lg p-6 bg-slate-900">
        <h2 class="text-xl font-semibold mb-4">Sites</h2>
        {sites().length === 0 ? (
          <div class="text-slate-400">No sites</div>
        ) : (
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="text-left py-2 px-3 text-slate-400">Name</th>
                <th class="text-left py-2 px-3 text-slate-400">Type</th>
                <th class="text-left py-2 px-3 text-slate-400">URL</th>
                <th class="text-left py-2 px-3 text-slate-400">Active</th>
                <th class="text-left py-2 px-3 text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites().map((site) => (
                <tr key={site.id} class="border-b border-slate-800">
                  <td class="py-2 px-3">
                    <button
                      type="button"
                      class="w-full text-left cursor-pointer hover:text-blue-400"
                      onClick={() => handleSelectSite(site)}
                    >
                      {site.name}
                    </button>
                  </td>
                  <td class="py-2 px-3">
                    <span class="inline-block px-2 py-1 text-xs rounded bg-slate-700 text-slate-300">
                      {site.type}
                    </span>
                  </td>
                  <td class="py-2 px-3 text-slate-400 truncate max-w-xs">{getUrl(site)}</td>
                  <td class="py-2 px-3">{site.is_active ? '✓' : '—'}</td>
                  <td class="py-2 px-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(site.id)}
                      class="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedSite() && (
        <div class="border border-slate-700 rounded-lg p-6 bg-slate-900">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold">{selectedSite().name} — Style DNA</h2>
            <button
              type="button"
              onClick={() => {
                setSelectedSite(null);
                setSiteDNA(null);
              }}
              class="text-slate-400 hover:text-slate-300"
            >
              ✕
            </button>
          </div>
          <StyleDNAPanel siteId={selectedSite().id} initialDNA={siteDNA() ?? undefined} />
        </div>
      )}

      <div class="border border-slate-700 rounded-lg p-6 bg-slate-900">
        <h2 class="text-xl font-semibold mb-4">Add Site</h2>
        {formError() && <div class="mb-4 text-red-500">{formError()}</div>}
        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label htmlFor="site-name" class="block text-sm text-slate-400 mb-1">
              Name
            </label>
            <input
              id="site-name"
              type="text"
              value={form().name}
              onInput={(e) => updateField('name', (e.target as HTMLInputElement).value)}
              required
              class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="site-type" class="block text-sm text-slate-400 mb-1">
              Type
            </label>
            <select
              id="site-type"
              value={form().type}
              onChange={(e) =>
                updateField('type', (e.target as HTMLSelectElement).value as FormState['type'])
              }
              class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {form().type === 'wordpress' && (
            <>
              <div>
                <label htmlFor="wp-url" class="block text-sm text-slate-400 mb-1">
                  WordPress URL
                </label>
                <input
                  id="wp-url"
                  type="url"
                  value={form().wpUrl}
                  onInput={(e) => updateField('wpUrl', (e.target as HTMLInputElement).value)}
                  required
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="wp-username" class="block text-sm text-slate-400 mb-1">
                  Username
                </label>
                <input
                  id="wp-username"
                  type="text"
                  value={form().wpUsername}
                  onInput={(e) => updateField('wpUsername', (e.target as HTMLInputElement).value)}
                  required
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="wp-app-password" class="block text-sm text-slate-400 mb-1">
                  App Password
                </label>
                <input
                  id="wp-app-password"
                  type="password"
                  value={form().wpAppPassword}
                  onInput={(e) =>
                    updateField('wpAppPassword', (e.target as HTMLInputElement).value)
                  }
                  required
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
            </>
          )}

          {form().type === 'blogger' && (
            <>
              <div>
                <label htmlFor="blogger-blog-id" class="block text-sm text-slate-400 mb-1">
                  Blog ID
                </label>
                <input
                  id="blogger-blog-id"
                  type="text"
                  value={form().bloggerBlogId}
                  onInput={(e) =>
                    updateField('bloggerBlogId', (e.target as HTMLInputElement).value)
                  }
                  required
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="blogger-refresh-token" class="block text-sm text-slate-400 mb-1">
                  Refresh Token
                </label>
                <input
                  id="blogger-refresh-token"
                  type="password"
                  value={form().bloggerRefreshToken}
                  onInput={(e) =>
                    updateField('bloggerRefreshToken', (e.target as HTMLInputElement).value)
                  }
                  required
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
            </>
          )}

          {form().type === 'astro' && (
            <>
              <div>
                <label htmlFor="github-repo" class="block text-sm text-slate-400 mb-1">
                  GitHub Repo
                </label>
                <input
                  id="github-repo"
                  type="text"
                  value={form().githubRepo}
                  onInput={(e) => updateField('githubRepo', (e.target as HTMLInputElement).value)}
                  required
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                  placeholder="owner/repo"
                />
              </div>
              <div>
                <label htmlFor="github-branch" class="block text-sm text-slate-400 mb-1">
                  Branch
                </label>
                <input
                  id="github-branch"
                  type="text"
                  value={form().githubBranch}
                  onInput={(e) => updateField('githubBranch', (e.target as HTMLInputElement).value)}
                  required
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                  placeholder="main"
                />
              </div>
            </>
          )}

          {form().type === 'webhook' && (
            <>
              <div>
                <label htmlFor="webhook-url" class="block text-sm text-slate-400 mb-1">
                  Webhook URL
                </label>
                <input
                  id="webhook-url"
                  type="url"
                  value={form().webhookUrl}
                  onInput={(e) => updateField('webhookUrl', (e.target as HTMLInputElement).value)}
                  required
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="webhook-secret" class="block text-sm text-slate-400 mb-1">
                  Webhook Secret
                </label>
                <input
                  id="webhook-secret"
                  type="password"
                  value={form().webhookSecret}
                  onInput={(e) =>
                    updateField('webhookSecret', (e.target as HTMLInputElement).value)
                  }
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="default-category" class="block text-sm text-slate-400 mb-1">
              Default Category (optional)
            </label>
            <input
              id="default-category"
              type="text"
              value={form().defaultCategory}
              onInput={(e) => updateField('defaultCategory', (e.target as HTMLInputElement).value)}
              class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
            />
          </div>

          <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">
            Add Site
          </button>
        </form>
      </div>
    </div>
  );
}
