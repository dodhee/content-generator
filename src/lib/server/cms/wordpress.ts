import type { ArticleRow } from '../types/article';
import type { SiteRow } from '../types/sites';

export async function publishArticle(
  article: ArticleRow,
  site: SiteRow,
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (site.type !== 'wordpress' || !site.wp_url || !site.wp_username || !site.wp_app_password) {
    return { success: false, error: 'Invalid WordPress configuration' };
  }

  try {
    const auth = btoa(`${site.wp_username}:${site.wp_app_password}`);

    // Simple markdown to HTML (very basic)
    const htmlContent = (article.content_md || '')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*)\*/gim, '<i>$1</i>');

    const response = await fetch(`${site.wp_url}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: article.title,
        content: htmlContent,
        status: 'publish',
        date: article.scheduled_for,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || 'Failed to publish' };
    }

    const data = await response.json();
    return { success: true, url: data.link };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
