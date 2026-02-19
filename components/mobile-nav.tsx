'use client';

import { useState } from 'react';
import Link from 'next/link';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/board', label: 'Board' },
  { href: '/stats', label: 'Stats' },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--surface-2)] border-b border-[var(--border-subtle)] z-[var(--z-sticky)] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Task Queue
          </h1>
        </div>
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] focus-visible:outline-offset-2"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-[calc(var(--z-modal)-1)]"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <nav 
            id="mobile-menu"
            aria-label="Mobile navigation"
            className="lg:hidden fixed top-16 left-0 right-0 bg-[var(--surface-2)] border-b border-[var(--border-subtle)] z-[var(--z-modal)] shadow-lg"
          >
            <ul className="p-4 space-y-1">
              {navItems.map((item) => {
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                    >
                      <span className="font-body">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}
