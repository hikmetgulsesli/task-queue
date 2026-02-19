import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/navigation';
import { MobileNav } from '@/components/mobile-nav';

export const metadata: Metadata = {
  title: 'Task Queue Dashboard',
  description: 'Agent Task Queue for OpenClaw antfarm pipeline',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Karla:wght@400;500;600&family=Fira+Code:wght@400;500;600&display=swap" 
          rel="stylesheet" 
        />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#111827" />
      </head>
      <body className="min-h-screen bg-[var(--surface-1)] text-[var(--text-primary)] antialiased">
        <div className="flex min-h-screen">
          {/* Desktop Sidebar Navigation */}
          <aside className="hidden lg:block w-64 fixed left-0 top-0 h-screen bg-[var(--surface-2)] border-r border-[var(--border-subtle)] z-[var(--z-sticky)]">
            <div className="p-6 border-b border-[var(--border-subtle)]">
              <h1 className="font-heading text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Task Queue
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">Agent Dashboard</p>
            </div>
            <Navigation />
          </aside>

          {/* Mobile Navigation */}
          <MobileNav />

          {/* Main Content */}
          <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
