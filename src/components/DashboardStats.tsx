// src/components/DashboardStats.tsx
// Dashboard statistics cards component

import { createSignal, onMount } from 'solid-js';

interface StatData {
  articles_7d: { total: number; change_pct: string };
  scheduled_today: number;
  failed_publishes: number;
  cost_mtd: number;
}

export function DashboardStats() {
  const [stats, setStats] = createSignal<StatData | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Fallback to zeros
      setStats({
        articles_7d: { total: 0, change_pct: '0' },
        scheduled_today: 0,
        failed_publishes: 0,
        cost_mtd: 0,
      });
    } finally {
      setLoading(false);
    }
  });

  const formatCurrency = (val: number) => {
    if (val < 0.01) return '$0.00';
    return `$${val.toFixed(2)}`;
  };

  const changeClass = (pct: string) => {
    if (pct.startsWith('+')) return 'text-green-400';
    if (pct.startsWith('-')) return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <section class="mb-8" aria-label="Dashboard statistics">
      <h2 class="text-sm uppercase tracking-widest text-slate-500 mb-4">Overview</h2>

      {loading() ? (
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} class="bg-slate-800/50 border border-slate-700 rounded-lg p-6 animate-pulse">
              <div class="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
              <div class="h-8 bg-slate-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : error() ? (
        <div class="bg-red-900/20 border border-red-800 rounded-lg p-4 text-sm text-red-300">
          Failed to load stats: {error()}
        </div>
      ) : stats() ? (
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Articles 7d */}
          <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-slate-400">Articles (7d)</span>
              <span class="text-2xl">📝</span>
            </div>
            <div class="text-3xl font-bold text-white">{stats()!.articles_7d.total}</div>
            <span class={`text-sm font-medium ${changeClass(stats()!.articles_7d.change_pct)}`}>
              {stats()!.articles_7d.change_pct}% from last week
            </span>
          </div>

          {/* Scheduled Today */}
          <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-slate-400">Scheduled Today</span>
              <span class="text-2xl">📅</span>
            </div>
            <div class="text-3xl font-bold text-white">{stats()!.scheduled_today}</div>
            <span class="text-sm text-slate-400">ready to publish</span>
          </div>

          {/* Failed Publishes */}
          <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-slate-400">Failed Publishes</span>
              <span class="text-2xl">⚠️</span>
            </div>
            <div class="text-3xl font-bold text-white">{stats()!.failed_publishes}</div>
            <span class={`text-sm font-medium ${stats()!.failed_publishes > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {stats()!.failed_publishes > 0 ? 'needs attention' : 'all good'}
            </span>
          </div>

          {/* AI Cost MTD */}
          <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-slate-400">AI Cost (MTD)</span>
              <span class="text-2xl">💰</span>
            </div>
            <div class="text-3xl font-bold text-white">{formatCurrency(stats()!.cost_mtd)}</div>
            <span class="text-sm text-slate-400">this month</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}