// src/components/OutlineEditor.tsx
// Outline editor with drag-drop reorder, add/remove sections, edit points

import { For, createSignal, onMount } from 'solid-js';

interface Section {
  id: string;
  heading: string;
  level: 2 | 3;
  key_points: string[];
  target_words: number;
}

interface OutlineData {
  title: string;
  description?: string;
  sections: Section[];
  suggested_faq?: Array<{ question: string; answer: string }>;
  suggested_tags?: string[];
  suggested_categories?: string[];
}

export type { Section, OutlineData };

interface OutlineEditorProps {
  articleId: string;
  initialOutline?: OutlineData;
  onSave: (outline: OutlineData) => Promise<void>;
  onGenerateArticle: (outline: OutlineData) => void;
}

export function OutlineEditor(props: OutlineEditorProps) {
  const [outline, setOutline] = createSignal<OutlineData>(
    props.initialOutline || {
      title: '',
      description: '',
      sections: [],
      suggested_faq: [],
      suggested_tags: [],
      suggested_categories: [],
    },
  );
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [draggedId, setDraggedId] = createSignal<string | null>(null);

  onMount(() => {
    if (props.initialOutline) {
      setOutline(props.initialOutline);
    }
  });

  const addSection = (afterId?: string) => {
    const newSection: Section = {
      id: `sec_${crypto.randomUUID()}`,
      heading: '',
      level: 2,
      key_points: [''],
      target_words: 300,
    };

    setOutline((prev) => {
      const sections = [...prev.sections];
      if (afterId) {
        const idx = sections.findIndex((s) => s.id === afterId);
        sections.splice(idx + 1, 0, newSection);
      } else {
        sections.push(newSection);
      }
      return { ...prev, sections };
    });
  };

  const removeSection = (id: string) => {
    setOutline((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== id),
    }));
  };

  const updateSection = (id: string, updates: Partial<Section>) => {
    setOutline((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  };

  const addKeyPoint = (sectionId: string) => {
    setOutline((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, key_points: [...s.key_points, ''] } : s,
      ),
    }));
  };

  const removeKeyPoint = (sectionId: string, pointIndex: number) => {
    setOutline((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, key_points: s.key_points.filter((_, i) => i !== pointIndex) }
          : s,
      ),
    }));
  };

  const updateKeyPoint = (sectionId: string, pointIndex: number, value: string) => {
    setOutline((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              key_points: s.key_points.map((p, i) => (i === pointIndex ? value : p)),
            }
          : s,
      ),
    }));
  };

  const handleDragStart = (e: DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer?.setData('text/plain', id);
    e.dataTransfer!.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer?.getData('text/plain');
    if (!sourceId || sourceId === targetId || !draggedId()) return;

    setOutline((prev) => {
      const sections = [...prev.sections];
      const sourceIdx = sections.findIndex((s) => s.id === sourceId);
      const targetIdx = sections.findIndex((s) => s.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1) return prev;

      const [removed] = sections.splice(sourceIdx, 1);
      sections.splice(targetIdx, 0, removed);
      return { ...prev, sections };
    });
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const saveOutline = async () => {
    setSaving(true);
    setError(null);
    try {
      await props.onSave(outline());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save outline');
    } finally {
      setSaving(false);
    }
  };

  const proceedToArticle = () => {
    props.onGenerateArticle(outline());
  };

  return (
    <div class="space-y-6">
      {/* Title & Description */}
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Article Title</label>
          <input
            type="text"
            class="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Enter article title"
            value={outline().title}
            onInput={(e) => updateSection('meta', { title: e.currentTarget.value })}
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">
            Description (optional)
          </label>
          <textarea
            class="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Brief description for meta/social"
            rows={2}
            value={outline().description || ''}
            onInput={(e) => updateSection('meta', { description: e.currentTarget.value })}
          />
        </div>
      </div>

      {/* Sections List */}
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-slate-100">Sections</h3>
          <button
            type="button"
            onClick={() => addSection()}
            class="px-3 py-1.5 text-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/30 transition-colors"
          >
            + Add Section
          </button>
        </div>

        <div class="space-y-3">
          <For each={outline().sections}>
            {(section, index) => (
              <div
                class={`bg-slate-800/50 border rounded-lg p-4 transition-colors ${
                  draggedId() === section.id
                    ? 'border-cyan-500/50 bg-cyan-500/5'
                    : 'border-slate-700'
                }`}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, section.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, section.id)}
                onDragEnd={handleDragEnd}
              >
                <div class="flex items-start gap-4">
                  {/* Drag Handle */}
                  <button
                    type="button"
                    class="text-slate-500 hover:text-cyan-400 cursor-grab active:cursor-grabbing p-1"
                    aria-label="Drag to reorder"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8h16M4 16h16"
                      />
                    </svg>
                  </button>

                  {/* Section Content */}
                  <div class="flex-1 space-y-3 min-w-0">
                    {/* Section Header */}
                    <div class="flex items-center gap-3">
                      <select
                        class="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:ring-1 focus:ring-cyan-500"
                        value={section.level}
                        onChange={(e) =>
                          updateSection(section.id, {
                            level: Number(e.currentTarget.value) as 2 | 3,
                          })
                        }
                      >
                        <option value={2}>H2</option>
                        <option value={3}>H3</option>
                      </select>
                      <input
                        type="text"
                        class="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder={`Section ${index + 1} heading`}
                        value={section.heading}
                        onInput={(e) =>
                          updateSection(section.id, { heading: e.currentTarget.value })
                        }
                      />
                      <input
                        type="number"
                        class="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:ring-1 focus:ring-cyan-500"
                        min="50"
                        max="2000"
                        step="50"
                        value={section.target_words}
                        onChange={(e) =>
                          updateSection(section.id, { target_words: Number(e.currentTarget.value) })
                        }
                      />
                      <span class="text-slate-500 text-sm">words</span>
                      <button
                        type="button"
                        onClick={() => removeSection(section.id)}
                        class="text-slate-500 hover:text-red-400 p-1"
                        aria-label="Remove section"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Key Points */}
                    <div class="space-y-2 ml-6 pl-3 border-l border-slate-700">
                      <For each={section.key_points}>
                        {(point, pointIdx) => (
                          <div class="flex items-center gap-2">
                            <input
                              type="text"
                              class="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                              placeholder={`Key point ${pointIdx + 1}`}
                              value={point}
                              onInput={(e) =>
                                updateKeyPoint(section.id, pointIdx, e.currentTarget.value)
                              }
                            />
                            <button
                              type="button"
                              onClick={() => removeKeyPoint(section.id, pointIdx)}
                              class="text-slate-500 hover:text-red-400 p-0.5"
                              aria-label="Remove key point"
                            >
                              <svg
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </For>
                      <button
                        type="button"
                        onClick={() => addKeyPoint(section.id)}
                        class="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        Add key point
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </For>

          {outline().sections.length === 0 && (
            <div class="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-lg">
              <p>No sections yet. Click "Add Section" to start building your outline.</p>
            </div>
          )}
        </div>
      </div>

      {/* Suggested FAQ */}
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-slate-100">Suggested FAQ (optional)</h3>
        <div class="space-y-2">
          <For each={outline().suggested_faq || []}>
            {(faq, idx) => (
              <div class="flex gap-2">
                <input
                  type="text"
                  class="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                  placeholder="Question"
                  value={faq.question}
                  onInput={(e) => {
                    const faqs = [...(outline().suggested_faq || [])];
                    faqs[idx] = { ...faqs[idx], question: e.currentTarget.value };
                    setOutline((prev) => ({ ...prev, suggested_faq: faqs }));
                  }}
                />
                <input
                  type="text"
                  class="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                  placeholder="Answer"
                  value={faq.answer}
                  onInput={(e) => {
                    const faqs = [...(outline().suggested_faq || [])];
                    faqs[idx] = { ...faqs[idx], answer: e.currentTarget.value };
                    setOutline((prev) => ({ ...prev, suggested_faq: faqs }));
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const faqs = [...(outline().suggested_faq || [])];
                    faqs.splice(idx, 1);
                    setOutline((prev) => ({ ...prev, suggested_faq: faqs }));
                  }}
                  class="text-slate-500 hover:text-red-400 p-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </For>
          <button
            type="button"
            onClick={() => {
              setOutline((prev) => ({
                ...prev,
                suggested_faq: [...(prev.suggested_faq || []), { question: '', answer: '' }],
              }));
            }}
            class="text-sm text-cyan-400 hover:text-cyan-300"
          >
            + Add FAQ
          </button>
        </div>
      </div>

      {/* Tags & Categories */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500"
            placeholder="tag1, tag2, tag3"
            value={outline().suggested_tags?.join(', ') || ''}
            onInput={(e) =>
              setOutline((prev) => ({
                ...prev,
                suggested_tags: e.currentTarget.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">
            Categories (comma-separated)
          </label>
          <input
            type="text"
            class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500"
            placeholder="cat1, cat2, cat3"
            value={outline().suggested_categories?.join(', ') || ''}
            onInput={(e) =>
              setOutline((prev) => ({
                ...prev,
                suggested_categories: e.currentTarget.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
      </div>

      {/* Actions */}
      <div class="flex flex-wrap gap-3 pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={saveOutline}
          disabled={saving()}
          class="px-6 py-2.5 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving() ? 'Saving...' : 'Save Outline'}
        </button>
        <button
          type="button"
          onClick={proceedToArticle}
          class="px-6 py-2.5 bg-slate-700 text-white font-medium border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors"
        >
          Continue to Article Generation →
        </button>
        {error() && <span class="text-red-400 text-sm self-center">{error()}</span>}
      </div>
    </div>
  );
}
