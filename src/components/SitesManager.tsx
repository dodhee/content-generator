import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

interface Site {
  id: string;
  name: string;
  type: 'wordpress' | 'blogger' | 'astro' | 'webhook';
  config: Record<string, unknown>;
  is_active: boolean;
}

export default function SitesManager({ workspaceId }: { workspaceId: string }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<'wordpress' | 'blogger' | 'astro' | 'webhook'>('wordpress');
  const [wpUrl, setWpUrl] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [bloggerBlogId, setBloggerBlogId] = useState('');
  const [bloggerRefreshToken, setBloggerRefreshToken] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [defaultCategory, setDefaultCategory] = useState('');

  const fetchSites = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sites');
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
            type: item.row.type,
            config: item.config,
            is_active: item.row.is_active === 1,
          }),
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete site?')) return;
      try {
        const response = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Delete failed');
        fetchSites();
      } catch (err) {
        console.error('Delete failed', err);
      }
    },
    [fetchSites],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      const config: Record<string, unknown> = {};
      if (type === 'wordpress') {
        config.wp_url = wpUrl;
        config.wp_username = wpUsername;
        config.wp_app_password = wpAppPassword;
      } else if (type === 'blogger') {
        config.blogger_blog_id = bloggerBlogId;
        config.blogger_refresh_token = bloggerRefreshToken;
      } else if (type === 'astro') {
        config.github_repo = githubRepo;
        config.github_branch = githubBranch;
      } else if (type === 'webhook') {
        config.webhook_url = webhookUrl;
        config.webhook_secret = webhookSecret;
      }
      if (defaultCategory) {
        config.default_category = defaultCategory;
      }

      try {
        const response = await fetch('/api/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            type,
            config,
            is_active: true,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create site');
        }

        setName('');
        setType('wordpress');
        setWpUrl('');
        setWpUsername('');
        setWpAppPassword('');
        setBloggerBlogId('');
        setBloggerRefreshToken('');
        setGithubRepo('');
        setGithubBranch('');
        setWebhookUrl('');
        setWebhookSecret('');
        setDefaultCategory('');
        fetchSites();
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [
      name,
      type,
      wpUrl,
      wpUsername,
      wpAppPassword,
      bloggerBlogId,
      bloggerRefreshToken,
      githubRepo,
      githubBranch,
      webhookUrl,
      webhookSecret,
      defaultCategory,
      fetchSites,
    ],
  );

  const getUrl = (site: Site): string => {
    if (site.type === 'wordpress') return (site.config.wp_url as string) || '';
    if (site.type === 'blogger')
      return `https://www.blogger.com/blog/posts/${site.config.blogger_blog_id}` || '';
    if (site.type === 'astro') return (site.config.github_repo as string) || '';
    if (site.type === 'webhook') return (site.config.webhook_url as string) || '';
    return '';
  };

  if (loading) return <div className="text-slate-400">Loading...</div>;
  if (error) {
    if (error === 'Not authenticated') {
      return (
        <div className="text-slate-400">
          Not authenticated.{' '}
          <a href="/api/auth/login" className="text-blue-400 underline">
            Login
          </a>
        </div>
      );
    }
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="border border-slate-700 rounded-lg p-6 bg-slate-900">
        <h2 className="text-xl font-semibold mb-4">Sites</h2>
        {sites.length === 0 ? (
          <div className="text-slate-400">No sites</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400">Name</th>
                <th className="text-left py-2 px-3 text-slate-400">Type</th>
                <th className="text-left py-2 px-3 text-slate-400">URL</th>
                <th className="text-left py-2 px-3 text-slate-400">Active</th>
                <th className="text-left py-2 px-3 text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className="border-b border-slate-800">
                  <td className="py-2 px-3">{site.name}</td>
                  <td className="py-2 px-3">
                    <span className="inline-block px-2 py-1 text-xs rounded bg-slate-700 text-slate-300">
                      {site.type}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 truncate max-w-xs">{getUrl(site)}</td>
                  <td className="py-2 px-3">{site.is_active ? '✓' : '—'}</td>
                  <td className="py-2 px-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(site.id)}
                      className="text-red-400 hover:text-red-300"
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

      <div className="border border-slate-700 rounded-lg p-6 bg-slate-900">
        <h2 className="text-xl font-semibold mb-4">Add Site</h2>
        {formError && <div className="mb-4 text-red-500">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="site-name" className="block text-sm text-slate-400 mb-1">
              Name
            </label>
            <input
              id="site-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="site-type" className="block text-sm text-slate-400 mb-1">
              Type
            </label>
            <select
              id="site-type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
            >
              <option value="wordpress">WordPress</option>
              <option value="blogger">Blogger</option>
              <option value="astro">Astro</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>

          {type === 'wordpress' && (
            <>
              <div>
                <label htmlFor="wp-url" className="block text-sm text-slate-400 mb-1">
                  WordPress URL
                </label>
                <input
                  id="wp-url"
                  type="url"
                  value={wpUrl}
                  onChange={(e) => setWpUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="wp-username" className="block text-sm text-slate-400 mb-1">
                  Username
                </label>
                <input
                  id="wp-username"
                  type="text"
                  value={wpUsername}
                  onChange={(e) => setWpUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="wp-app-password" className="block text-sm text-slate-400 mb-1">
                  App Password
                </label>
                <input
                  id="wp-app-password"
                  type="password"
                  value={wpAppPassword}
                  onChange={(e) => setWpAppPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
            </>
          )}

          {type === 'blogger' && (
            <>
              <div>
                <label htmlFor="blogger-blog-id" className="block text-sm text-slate-400 mb-1">
                  Blog ID
                </label>
                <input
                  id="blogger-blog-id"
                  type="text"
                  value={bloggerBlogId}
                  onChange={(e) => setBloggerBlogId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="blogger-refresh-token"
                  className="block text-sm text-slate-400 mb-1"
                >
                  Refresh Token
                </label>
                <input
                  id="blogger-refresh-token"
                  type="password"
                  value={bloggerRefreshToken}
                  onChange={(e) => setBloggerRefreshToken(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
            </>
          )}

          {type === 'astro' && (
            <>
              <div>
                <label htmlFor="github-repo" className="block text-sm text-slate-400 mb-1">
                  GitHub Repo
                </label>
                <input
                  id="github-repo"
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                  placeholder="owner/repo"
                />
              </div>
              <div>
                <label htmlFor="github-branch" className="block text-sm text-slate-400 mb-1">
                  Branch
                </label>
                <input
                  id="github-branch"
                  type="text"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                  placeholder="main"
                />
              </div>
            </>
          )}

          {type === 'webhook' && (
            <>
              <div>
                <label htmlFor="webhook-url" className="block text-sm text-slate-400 mb-1">
                  Webhook URL
                </label>
                <input
                  id="webhook-url"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="webhook-secret" className="block text-sm text-slate-400 mb-1">
                  Webhook Secret
                </label>
                <input
                  id="webhook-secret"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="default-category" className="block text-sm text-slate-400 mb-1">
              Default Category (optional)
            </label>
            <input
              id="default-category"
              type="text"
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
          >
            Add Site
          </button>
        </form>
      </div>
    </div>
  );
}
