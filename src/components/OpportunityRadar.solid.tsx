// src/components/OpportunityRadar.tsx
// Content Opportunity Radar — scan trends + holidays, queue articles

import { For, createSignal, onMount } from 'solid-js';

interface Opportunity {
  keyword: string;
  trendScore: number;
  searchIntent: 'informational' | 'commercial' | 'transactional';
  suggestedAngle: string;
  outlinePreview: string;
  source: 'trends' | 'holiday' | 'both';
  traffic: number;
  holidayName?: string;
  holidayDate?: string;
}

interface RadarResult {
  opportunities: Opportunity[];
  generatedAt: string;
  niche: string;
  geo: string;
}

interface QueuedArticle {
  id: string;
  title: string | null;
  status: string;
  scheduled_for: string | null;
}

const INTENT_BADGE: Record<string, string> = {
  informational: 'bg-blue-500/20 text-blue-400',
  commercial: 'bg-amber-500/20 text-amber-400',
  transactional: 'bg-purple-500/20 text-purple-400',
};

const GEO_OPTIONS = [
  { value: 'Global', label: '🌍 Global' },
  { value: 'US', label: '🇺🇸 US' },
  { value: 'ID', label: '🇮🇩 Indonesia' },
];

export function OpportunityRadar() {
  const [niche, setNiche] = createSignal('');
  const [geo, setGeo] = createSignal('Global');
  const [results, setResults] = createSignal<RadarResult | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [siteId, setSiteId] = createSignal('');
  const [sites, setSites] = createSignal<Array<{ id: string; name: string }>>([]);
  const [queuing, setQueuing] = createSignal(false);
  const [queued, setQueued] = createSignal<QueuedArticle[]>([]);
  const [selected, setSelected] = createSignal<Set<number>>(new Set());

  const scan = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setQueued([]);
    setSelected(new Set());

    try {
      const res = await fetch(
        `/api/opportunity/radar?niche=${encodeURIComponent(niche())}&geo=${encodeURIComponent(geo())}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RadarResult;
      setResults(data);
      // Auto-select top 5
      setSelected(new Set(data.opportunities.slice(0, 5).map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const res = await fetch('/api/sites', { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as Array<{ id: string; name: string }>;
      setSites(data);
      const first = data[0];
      if (first) setSiteId(first.id);
    } catch {
      // silent
    }
  };

  const queueArticles = async () => {
    const r = results();
    if (!siteId() || !r) return;
    setQueuing(true);
    setError(null);

    try {
      const opps = r.opportunities.filter((_, i) => selected().has(i));
      if (opps.length === 0) {
        setError('Select at least 1 opportunity');
        setQueuing(false);
        return;
      }

      const res = await fetch('/api/opportunity/queue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: siteId(),
          opportunities: opps.map((o) => ({
            keyword: o.keyword,
            searchIntent: o.searchIntent,
            suggestedAngle: o.suggestedAngle,
            outlinePreview: o.outlinePreview,
          })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQueued(data.articles as QueuedArticle[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Queue failed');
    } finally {
      setQueuing(false);
    }
  };

  const toggleSelect = (idx: number) => {
    const next = new Set(selected());
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelected(next);
  };

  const selectAll = () => {
    const opps = currentOpps();
    setSelected(new Set(opps.map((_, i) => i)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const currentOpps = () => results()?.opportunities ?? [];

  // Load sites on mount
  onMount(() => loadSites());

  return (
    <div class="space-y-6">
      {/* Input Section */}
      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 class="text-lg font-semibold text-white mb-4">Content Opportunity Radar</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-sm text-slate-400 mb-1" for="radar-niche">
              Niche Keywords
            </label>
            <input
              id="radar-niche"
              type="text"
              value={niche()}
              onInput={(e) => setNiche(e.currentTarget.value)}
              placeholder="e.g. tech, travel, health"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label class="block text-sm text-slate-400 mb-1" for="radar-geo">
              Target Geo
            </label>
            <select
              id="radar-geo"
              value={geo()}
              onChange={(e) => setGeo(e.currentTarget.value)}
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:ring-1 focus:ring-cyan-500"
            >
              <For each={GEO_OPTIONS}>
                {(opt) => <option value={opt.value}>{opt.label}</option>}
              </For>
            </select>
          </div>
          <div>
            <label class="block text-sm text-slate-400 mb-1" for="radar-site">
              Target Site
            </label>
            <select
              id="radar-site"
              value={siteId()}
              onChange={(e) => setSiteId(e.currentTarget.value)}
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">Select site</option>
              <For each={sites()}>{(s) => <option value={s.id}>{s.name}</option>}</For>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={scan}
          disabled={loading() || !niche()}
          class="px-6 py-2.5 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading() ? 'Scanning...' : '🔍 Scan Opportunities'}
        </button>
      </div>

      {/* Error */}
      {error() && (
        <div class="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm">
          {error()}
        </div>
      )}

      {/* Results */}
      {results() && (
        <>
          <div class="flex items-center justify-between">
            <div class="text-sm text-slate-400">
              {currentOpps().length} opportunities found
              <span class="mx-2">·</span>
              {results()?.niche ?? ''}
              <span class="mx-2">·</span>
              {results()?.geo ?? ''}
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                class="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearSelection}
                class="text-xs text-slate-400 hover:text-slate-300"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={queueArticles}
                disabled={queuing() || selected().size === 0 || !siteId()}
                class="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg text-sm hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {queuing() ? 'Queuing...' : `📦 Queue ${Math.min(selected().size, 5)} Articles`}
              </button>
            </div>
          </div>

          {/* Table */}
          <div class="overflow-x-auto bg-slate-800/50 border border-slate-700 rounded-lg">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-700 text-left text-slate-400">
                  <th class="p-3 w-8">
                    <span class="sr-only">Select</span>
                  </th>
                  <th class="p-3">Keyword</th>
                  <th class="p-3 w-20">Score</th>
                  <th class="p-3 w-24">Intent</th>
                  <th class="p-3 w-20">Source</th>
                  <th class="p-3 w-20">Traffic</th>
                  <th class="p-3">Angle</th>
                  <th class="p-3">Outline</th>
                </tr>
              </thead>
              <tbody>
                <For each={currentOpps()}>
                  {(opp, idx) => (
                    <tr
                      class={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                        selected().has(idx()) ? 'bg-cyan-500/5' : ''
                      }`}
                    >
                      <td class="p-3">
                        <input
                          type="checkbox"
                          checked={selected().has(idx())}
                          onChange={() => toggleSelect(idx())}
                          class="w-4 h-4 rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                        />
                      </td>
                      <td class="p-3 font-medium text-white">{opp.keyword}</td>
                      <td class="p-3">
                        <span class="font-mono text-cyan-400">
                          {(opp.trendScore * 100).toFixed(0)}
                        </span>
                      </td>
                      <td class="p-3">
                        <span
                          class={`px-2 py-0.5 rounded text-xs font-medium ${
                            INTENT_BADGE[opp.searchIntent]
                          }`}
                        >
                          {opp.searchIntent}
                        </span>
                      </td>
                      <td class="p-3">
                        <span
                          class={`text-xs ${
                            opp.source === 'holiday'
                              ? 'text-yellow-400'
                              : opp.source === 'both'
                                ? 'text-green-400'
                                : 'text-slate-400'
                          }`}
                        >
                          {opp.source === 'holiday' ? '📅' : opp.source === 'both' ? '🔥' : '📈'}
                          {opp.source}
                        </span>
                      </td>
                      <td class="p-3 text-slate-300 font-mono">
                        {opp.traffic > 0 ? `${(opp.traffic / 1000).toFixed(1)}k` : '-'}
                      </td>
                      <td class="p-3 text-slate-300 max-w-xs truncate" title={opp.suggestedAngle}>
                        {opp.suggestedAngle}
                      </td>
                      <td
                        class="p-3 text-slate-400 text-xs max-w-sm truncate"
                        title={opp.outlinePreview}
                      >
                        {opp.outlinePreview || '-'}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* Queued confirmation */}
          {queued().length > 0 && (
            <div class="p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg">
              <h3 class="text-emerald-400 font-medium mb-2">
                ✓ {queued().length} articles queued for generation
              </h3>
              <ul class="space-y-1">
                <For each={queued()}>
                  {(a) => (
                    <li class="text-sm text-slate-300">
                      {a.title ?? 'Untitled'}
                      <span class="text-slate-500 ml-2">
                        → {a.status}
                        {a.scheduled_for ? ` (scheduled ${a.scheduled_for})` : ''}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
