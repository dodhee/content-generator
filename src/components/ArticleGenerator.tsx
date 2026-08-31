// src/components/ArticleGenerator.tsx
// Review step + Full article generation (streaming per section)

import { For, createSignal, onMount } from 'solid-js';
import type { OutlineData, Section } from './OutlineEditor';

interface SectionContent {
  sectionId: string;
  heading: string;
  level: 2 | 3;
  content: string;
  status: 'pending' | 'generating' | 'completed' | 'accepted' | 'rejected';
  error?: string;
}

interface ArticleGeneratorProps {
  articleId: string;
  outline: OutlineData;
  onComplete: (articleData: {
    title: string;
    description?: string;
    content_md: string;
    frontmatter_json: string;
  }) => Promise<void>;
}

export function ArticleGenerator(props: ArticleGeneratorProps) {
  const [sections, setSections] = createSignal<SectionContent[]>(
    props.outline.sections.map((s) => ({
      sectionId: s.id,
      heading: s.heading,
      level: s.level,
      content: '',
      status: 'pending' as const,
    })),
  );
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [allCompleted, setAllCompleted] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // const currentSection = sections()[currentIndex()]; // unused

  const generateSection = async (index: number) => {
    const section = sections()[index];
    if (!section || section.status !== 'pending') return;

    setSections((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, status: 'generating' as const, error: undefined } : s,
      ),
    );

    try {
      const response = await fetch('/api/generate/section', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: props.articleId,
          section_id: section.sectionId,
          heading: section.heading,
          level: section.level,
          outline: props.outline,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let content = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          setSections((prev) =>
            prev.map((s, i) =>
              i === index ? { ...s, content, status: 'generating' as const } : s,
            ),
          );
        }
      }

      setSections((prev) =>
        prev.map((s, i) => (i === index ? { ...s, content, status: 'completed' as const } : s)),
      );

      // Auto-advance to next section
      if (index < sections().length - 1) {
        setCurrentIndex(index + 1);
      } else {
        setAllCompleted(true);
      }
    } catch (err) {
      setSections((prev) =>
        prev.map((s, i) =>
          i === index
            ? {
                ...s,
                status: 'rejected' as const,
                error: err instanceof Error ? err.message : 'Generation failed',
              }
            : s,
        ),
      );
    }
  };

  const regenerateSection = (index: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, content: '', status: 'pending' as const, error: undefined } : s,
      ),
    );
    generateSection(index);
  };

  const acceptSection = (index: number) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'accepted' as const } : s)),
    );
    if (index < sections().length - 1) {
      setCurrentIndex(index + 1);
    } else {
      setAllCompleted(true);
    }
  };

  const rejectSection = (index: number) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'rejected' as const } : s)),
    );
  };

  const handleSaveArticle = async () => {
    setSaving(true);
    setError(null);

    try {
      const contentMd = sections()
        .map((s) => `${'#'.repeat(s.level)} ${s.heading}\n\n${s.content}`)
        .join('\n\n');

      const frontmatter = {
        title: props.outline.title,
        description: props.outline.description,
        tags: props.outline.suggested_tags,
        categories: props.outline.suggested_categories,
        date: new Date().toISOString(),
        draft: false,
      };

      await props.onComplete({
        title: props.outline.title,
        description: props.outline.description,
        content_md: contentMd,
        frontmatter_json: JSON.stringify(frontmatter),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  // Auto-generate first section on mount
  onMount(() => {
    if (sections().length > 0 && sections()[0].status === 'pending') {
      generateSection(0);
    }
  });

  const statusColors = {
    pending: 'bg-slate-700/50 text-slate-400',
    generating: 'bg-cyan-500/20 text-cyan-400 animate-pulse',
    completed: 'bg-green-500/20 text-green-400',
    accepted: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-300">Article Generation Progress</span>
          <span className="font-mono text-cyan-400">
            {sections().filter((s) => s.status === 'accepted' || s.status === 'completed').length} /{' '}
            {sections().length} sections
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{
              width: `${(sections().filter((s) => s.status === 'accepted' || s.status === 'completed').length / sections().length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Section Cards */}
      <div className="space-y-4">
        <For each={sections()}>
          {(section, index) => (
            <div
              className={`bg-slate-800/50 border rounded-lg p-4 transition-colors ${
                index === currentIndex() && section.status !== 'accepted'
                  ? 'border-cyan-500/50 ring-1 ring-cyan-500/20'
                  : 'border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[section.status]}`}
                    >
                      {section.status === 'pending'
                        ? '⏳ Pending'
                        : section.status === 'generating'
                          ? '🔄 Generating...'
                          : section.status === 'completed'
                            ? '✅ Generated'
                            : section.status === 'accepted'
                              ? '✓ Accepted'
                              : '✗ Rejected'}
                    </span>
                    <span className="text-sm text-slate-500 font-mono">
                      Section {index + 1} / {sections().length}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{section.heading}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {section.status === 'completed' && (
                    <>
                      <button
                        type="button"
                        onClick={() => acceptSection(index)}
                        className="px-3 py-1.5 text-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => regenerateSection(index)}
                        className="px-3 py-1.5 text-sm bg-slate-700 text-white border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors"
                      >
                        Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectSection(index)}
                        className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {section.status === 'generating' && (
                    <span className="text-sm text-cyan-400 flex items-center gap-1">
                      <svg
                        className="animate-spin w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-label="Generating"
                      >
                        <title>Generating</title>
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Generating...
                    </span>
                  )}
                  {section.status === 'accepted' && (
                    <span className="text-sm text-emerald-400">✓ Accepted</span>
                  )}
                  {section.status === 'rejected' && (
                    <span className="text-sm text-red-400">✗ Rejected</span>
                  )}
                </div>
              </div>

              {/* Content Display/Edit */}
              <div className="prose prose-invert max-w-none">
                {section.status === 'generating' ||
                section.status === 'completed' ||
                section.status === 'accepted' ? (
                  <div
                    className="whitespace-pre-wrap text-slate-100 leading-relaxed min-h-[100px]"
                    contentEditable={section.status === 'accepted'}
                    onInput={(e) =>
                      setSections((prev) =>
                        prev.map((s, i) =>
                          i === index ? { ...s, content: e.currentTarget.innerText } : s,
                        ),
                      )
                    }
                  >
                    {section.content ||
                      (section.status === 'generating' ? 'Generating content...' : '')}
                  </div>
                ) : (
                  <div className="text-slate-500 italic">
                    {section.error ? `Error: ${section.error}` : 'Waiting for generation...'}
                  </div>
                )}
              </div>

              {section.error && section.status === 'rejected' && (
                <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-300">
                  {section.error}
                </div>
              )}
            </div>
          )}
        </For>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setCurrentIndex(Math.max(0, currentIndex() - 1))}
          disabled={currentIndex() === 0}
          className="px-4 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>

        {allCompleted() ? (
          <button
            type="button"
            onClick={handleSaveArticle}
            disabled={saving()}
            className="px-6 py-2.5 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving() ? 'Saving Article...' : 'Save Article'}
          </button>
        ) : (
          <span className="text-slate-500 text-sm">Complete all sections to save</span>
        )}

        <button
          type="button"
          onClick={() => setCurrentIndex(Math.min(sections().length - 1, currentIndex() + 1))}
          disabled={currentIndex() >= sections().length - 1}
          className="px-4 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>

      {error() && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
          {error()}
        </div>
      )}
    </div>
  );
}
