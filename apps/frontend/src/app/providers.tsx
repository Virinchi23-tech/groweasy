'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  HomeIcon, 
  ArrowUpTrayIcon, 
  UserGroupIcon, 
  ArrowRightOnRectangleIcon, 
  MoonIcon, 
  SunIcon, 
  Bars3Icon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClientState] = useState(() => queryClient);
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { accessToken, user, clearAuth } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === '/login' || pathname === '/register';

  // Toggle Dark Mode
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    const isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (mounted && !accessToken && !isAuthPage) {
      router.replace('/login');
    }
  }, [accessToken, pathname, mounted, isAuthPage, router]);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900" />;
  }

  // Auth pages (full screen, no layout)
  if (isAuthPage || !accessToken) {
    return (
      <QueryClientProvider client={queryClientState}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center">
          <div className="absolute top-4 right-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700"
            >
              {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
          </div>
          {children}
        </div>
      </QueryClientProvider>
    );
  }

  const handleLogout = () => {
    clearAuth();
    router.replace('/login');
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Import Leads', href: '/import', icon: ArrowUpTrayIcon },
    { name: 'CRM Leads', href: '/leads', icon: UserGroupIcon },
  ];

  return (
    <QueryClientProvider client={queryClientState}>
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950">
        {/* Sidebar for Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
          <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white font-extrabold text-lg">G</span>
              GrowEasy
            </span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                    active
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">{user?.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role?.toLowerCase()}</span>
              </div>
              <button
                onClick={toggleDarkMode}
                className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700"
              >
                {darkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Mobile Header / Navigation */}
        <header className="md:hidden h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 w-full animate-fadeIn">
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white font-extrabold text-lg">G</span>
            GrowEasy
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700"
            >
              {darkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-slate-600 dark:text-slate-300"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Mobile Drawer menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/60 backdrop-blur-sm">
            <div className="w-64 bg-white dark:bg-slate-900 p-6 flex flex-col h-full border-r border-slate-200 dark:border-slate-800 animate-slideRight">
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">GrowEasy</span>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <XMarkIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                {navItems.map((item) => {
                  const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                        active
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{user?.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role?.toLowerCase()}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </QueryClientProvider>
  );
}
