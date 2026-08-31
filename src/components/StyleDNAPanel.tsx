// src/components/StyleDNAPanel.tsx
// UI for Style DNA: Analyze button, progress, patterns, few-shot preview

import { createSignal, onMount } from 'solid-js';

interface StyleDNAPatterns {
  avgSentenceLength: number;
  vocabDiversity: number;
  commonTransitions: string[];
  headingDepth: number;
  ctaPatterns: string[];
  paragraphLength: number;
  toneMarkers: string[];
}

interface StyleDNAExample {
  title: string;
  content: string;
}

interface StyleDNAResult {
  examples: StyleDNAExample[];
  patterns: StyleDNAPatterns;
  analyzedAt: string;
  postCount: number;
}

interface StyleDNAPanelProps {
  siteId: string;
  initialDNA?: {
    has_dna: boolean;
    dna: StyleDNAResult | null;
  };
}

export function StyleDNAPanel({ siteId, initialDNA }: StyleDNAPanelProps) {
  const [loading, setLoading] = createSignal(false);
  const [analyzing, setAnalyzing] = createSignal(false);
  const [result, setResult] = createSignal<StyleDNAResult | null>(initialDNA?.dna ?? null);
  const [hasDNA, setHasDNA] = createSignal(initialDNA?.has_dna ?? false);
  const [error, setError] = createSignal<string | null>(null);
  const [progress, setProgress] = createSignal<string>('');

  const fetchStatus = async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/style-dna?site_id=${encodeURIComponent(siteId)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setHasDNA(data.has_dna);
      setResult(data.dna);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalyze = async (reanalyze = false) => {
    if (!siteId) return;
    setAnalyzing(true);
    setError(null);
    setProgress('Fetching posts...');
    try {
      const endpoint = reanalyze ? '/api/style-dna/reanalyze' : '/api/style-dna/analyze';
      const res = await fetch(`${endpoint}?site_id=${encodeURIComponent(siteId)}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(errData.error || 'Analysis failed');
      }

      const data = await res.json();
      setProgress('Analysis complete');
      setHasDNA(true);
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAnalyzing(false);
      setProgress('');
    }
  };

  onMount(() => {
    if (!initialDNA) fetchStatus();
  });

  const formatNumber = (n: number) => n.toFixed(1);
  const formatPercent = (n: number) => (n * 100).toFixed(1);

  return (
    <div class="bg-white rounded-lg border border-slate-200 p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-slate-900">Style DNA</h2>
        <div class="flex gap-2">
          {hasDNA() && !analyzing() && (
            <button
              type="button"
              onClick={() => triggerAnalyze(true)}
              disabled={loading()}
              class="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              Re-analyze
            </button>
          )}
          {!hasDNA() && !analyzing() && (
            <button
              type="button"
              onClick={() => triggerAnalyze(false)}
              disabled={loading()}
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Analyze Site
            </button>
          )}
        </div>
      </div>

      {error() && (
        <div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error()}
        </div>
      )}

      {analyzing() && (
        <div class="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded text-sm">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>{progress() || 'Analyzing site content...'}</span>
          </div>
        </div>
      )}

      {result() && (
        <div class="space-y-6">
          {/* Summary */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-slate-50 p-4 rounded">
              <p class="text-xs text-slate-500 uppercase tracking-wide">Posts Analyzed</p>
              <p class="text-2xl font-bold text-slate-900">{result().postCount}</p>
            </div>
            <div class="bg-slate-50 p-4 rounded">
              <p class="text-xs text-slate-500 uppercase tracking-wide">Avg Sentence Length</p>
              <p class="text-2xl font-bold text-slate-900">
                {formatNumber(result().patterns.avgSentenceLength)} words
              </p>
            </div>
            <div class="bg-slate-50 p-4 rounded">
              <p class="text-xs text-slate-500 uppercase tracking-wide">Vocab Diversity</p>
              <p class="text-2xl font-bold text-slate-900">
                {formatPercent(result().patterns.vocabDiversity)}%
              </p>
            </div>
            <div class="bg-slate-50 p-4 rounded">
              <p class="text-xs text-slate-500 uppercase tracking-wide">Analyzed</p>
              <p class="text-sm font-medium text-slate-900 truncate">
                {new Date(result().analyzedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Patterns */}
          <div class="border-t border-slate-200 pt-6">
            <h3 class="text-lg font-medium text-slate-900 mb-4">Detected Patterns</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 class="text-sm font-medium text-slate-700 mb-2">Transitions</h4>
                <div class="flex flex-wrap gap-1">
                  {result().patterns.commonTransitions.length > 0 ? (
                    result().patterns.commonTransitions.map((t) => (
                      <span key={t} class="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span class="text-slate-400 text-xs">None detected</span>
                  )}
                </div>
              </div>
              <div>
                <h4 class="text-sm font-medium text-slate-700 mb-2">CTA Patterns</h4>
                <div class="flex flex-wrap gap-1">
                  {result().patterns.ctaPatterns.length > 0 ? (
                    result().patterns.ctaPatterns.map((c) => (
                      <span key={c} class="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded">
                        {c}
                      </span>
                    ))
                  ) : (
                    <span class="text-slate-400 text-xs">None detected</span>
                  )}
                </div>
              </div>
              <div>
                <h4 class="text-sm font-medium text-slate-700 mb-2">Tone Markers</h4>
                <div class="flex flex-wrap gap-1">
                  {result().patterns.toneMarkers.map((t) => (
                    <span key={t} class="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 class="text-sm font-medium text-slate-700 mb-2">Structure</h4>
                <div class="space-y-1 text-sm text-slate-600">
                  <div>
                    Heading depth: {formatNumber(result().patterns.headingDepth)} H2/H3 per post
                  </div>
                  <div>
                    Paragraph length: {formatNumber(result().patterns.paragraphLength)} sentences
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Few-shot Examples */}
          <div class="border-t border-slate-200 pt-6">
            <h3 class="text-lg font-medium text-slate-900 mb-4">
              Few-Shot Examples ({result().examples.length})
            </h3>
            <div class="space-y-3 max-h-96 overflow-y-auto">
              {result().examples.map((ex) => (
                <div key={ex.title} class="bg-slate-50 border border-slate-200 rounded p-4">
                  <h4 class="font-medium text-slate-900 mb-2 text-sm">{ex.title}</h4>
                  <p class="text-slate-600 text-sm whitespace-pre-wrap max-h-32 overflow-hidden">
                    {ex.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!hasDNA() && !analyzing() && !loading() && !error() && (
        <div class="text-center py-8 text-slate-500">
          <p class="mb-2">No Style DNA generated yet.</p>
          <p class="text-sm">
            Click "Analyze Site" to crawl content and extract brand voice patterns.
          </p>
        </div>
      )}

      {loading() && !analyzing() && (
        <div class="text-center py-8 text-slate-500">
          <div class="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
          <p>Loading status...</p>
        </div>
      )}
    </div>
  );
}
