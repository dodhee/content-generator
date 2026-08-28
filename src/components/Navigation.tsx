// src/components/Navigation.tsx
// Global navigation bar with active state, user dropdown, logout

import { createSignal, onCleanup, onMount } from 'solid-js';

interface NavigationProps {
  workspaceId: string;
  userName?: string;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/sites', label: 'Sites', icon: '🌐' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/publish-queue', label: 'Queue', icon: '📦' },
];

export function Navigation(props: NavigationProps) {
  const [activePath, setActivePath] = createSignal(window.location.pathname);
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [userName] = createSignal(props.userName || 'User');

  onMount(() => {
    const handlePopState = () => setActivePath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    onCleanup(() => window.removeEventListener('popstate', handlePopState));
  });

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/api/auth/login';
    } catch {
      window.location.href = '/api/auth/login';
    }
  };

  const toggleDropdown = (e: Event) => {
    e.stopPropagation();
    setDropdownOpen(!dropdownOpen());
  };

  const closeDropdown = () => setDropdownOpen(false);

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.user-menu')) {
        closeDropdown();
      }
    };
    document.addEventListener('click', handleClickOutside);
    onCleanup(() => document.removeEventListener('click', handleClickOutside));
  });

  return (
    <nav class="fixed top-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div class="container mx-auto px-6">
        <div class="flex h-16 items-center justify-between">
          {/* Logo + Nav Links */}
          <div class="flex items-center gap-8">
            <a href="/" class="flex items-center gap-2 text-xl font-bold text-cyan-400" title="Dashboard">
              <span>⚡</span>
              <span class="hidden sm:inline">AI Content Gen</span>
            </a>

            <div class="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  class={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activePath() === item.href || (item.href !== '/' && activePath().startsWith(item.href))
                      ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-500'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'
                  }`}
                >
                  <span class="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* User Menu */}
          <div class="user-menu relative">
            <button
              onClick={toggleDropdown}
              class="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
              aria-expanded={dropdownOpen()}
              aria-haspopup="true"
            >
              <div class="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-medium text-sm">
                {userName().charAt(0).toUpperCase()}
              </div>
              <span class="hidden sm:inline text-sm font-medium text-slate-100">{userName()}</span>
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen() && (
              <div class="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 animate-fade-in">
                <div class="px-4 py-3 border-b border-slate-700">
                  <p class="text-xs text-slate-500 uppercase tracking-wide">Workspace</p>
                  <p class="text-sm font-mono text-slate-300 truncate">{props.workspaceId}</p>
                </div>
                <button
                  onClick={handleLogout}
                  class="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}