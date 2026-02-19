'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Layers, ChevronRight } from 'lucide-react';

const breadcrumbMap: Record<string, string> = {
  '/': 'Dashboard',
  '/tasks': 'Tasks',
  '/queue': 'Queue',
  '/settings': 'Settings',
};

export function Header() {
  const pathname = usePathname();
  
  const getBreadcrumb = () => {
    const label = breadcrumbMap[pathname];
    if (!label || pathname === '/') return null;
    return label;
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--surface-1)]/95 backdrop-blur-sm border-b border-[var(--border-subtle)]">
      <div className="flex items-center h-16 px-4 lg:px-8">
        {/* Left spacer for mobile hamburger */}
        <div className="w-10 lg:hidden" aria-hidden="true" />
        
        {/* Title and Breadcrumb */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            <Layers className="w-5 h-5 text-[var(--primary)]" aria-hidden="true" />
          </div>
          
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Görev Kuyruğu
            </h1>
            
            {breadcrumb && (
              <>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                <span className="text-[var(--text-secondary)]">{breadcrumb}</span>
              </>
            )}
          </div>
        </div>

        {/* Right side - placeholder for future actions */}
        <div className="flex-1" />
        
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--status-done)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--status-done)]"></span>
            </span>
            <span className="text-xs text-[var(--text-secondary)]">System Online</span>
          </div>
        </div>
      </div>
    </header>
  );
}
