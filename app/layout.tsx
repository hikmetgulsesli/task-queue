import type { Metadata } from 'next';
import './globals.css';

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
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Fira+Code:wght@400;500;600&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="min-h-screen bg-[var(--surface-1)] text-[var(--text-primary)] font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
