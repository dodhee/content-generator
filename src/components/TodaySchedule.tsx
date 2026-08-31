// src/components/TodaySchedule.tsx
// Today's schedule compact list component

import { createSignal, onMount } from 'solid-js';

interface ScheduleItem {
  id: string;
  title: string;
  site_name: string;
  scheduled_for: string;
  status: string;
}

export function TodaySchedule() {
  const [schedule, setSchedule] = createSignal<ScheduleItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch('/api/articles/scheduled-today', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSchedule(data.articles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  });

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const statusColor = (status: string) => {
    const colors = {
      scheduled: 'bg-blue-500/20 text-blue-400',
      queued: 'bg-amber-500/20 text-amber-400',
      generating: 'bg-purple-500/20 text-purple-400',
      ready: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-500/20 text-slate-400';
  };

  return (
    <section class="mb-8" aria-label="Today's schedule">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm uppercase tracking-widest text-slate-500">Today's Schedule</h2>
        <a href="/calendar" class="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
          View All Calendar →
        </a>
      </div>

      {loading() ? (
        <div class="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders, never reorder
              key={`skeleton-${i}`}
              class="bg-slate-800/50 border border-slate-700 rounded-lg p-4 animate-pulse"
            >
              <div class="flex items-center gap-4">
                <div class="w-16 h-4 bg-slate-700 rounded" />
                <div class="flex-1 h-4 bg-slate-700 rounded" />
                <div class="w-12 h-4 bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error() ? (
        <div class="bg-red-900/20 border border-red-800 rounded-lg p-4 text-sm text-red-300">
          Failed to load schedule: {error()}
        </div>
      ) : schedule().length === 0 ? (
        <div class="text-center py-8 text-slate-500 border border-slate-800 rounded-lg">
          <p class="mb-2">No articles scheduled for today</p>
          <a href="/calendar" class="text-cyan-400 hover:text-cyan-300 font-medium">
            Schedule an article →
          </a>
        </div>
      ) : (
        <div class="space-y-2">
          {schedule()
            .slice(0, 10)
            .map((item) => (
              <div
                key={item.id}
                class="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <span class="text-sm font-mono text-slate-500 w-16 shrink-0">
                  {formatTime(item.scheduled_for)}
                </span>
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-medium text-slate-100 truncate block">
                    {item.title || 'Untitled Article'}
                  </span>
                  <span class="text-xs text-slate-500 truncate">{item.site_name}</span>
                </div>
                <span
                  class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(item.status)}`}
                >
                  {item.status}
                </span>
              </div>
            ))}

          {schedule().length > 10 && (
            <div class="text-center pt-2">
              <a href="/calendar" class="text-cyan-400 hover:text-cyan-300 font-medium text-sm">
                +{schedule().length - 10} more →
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
