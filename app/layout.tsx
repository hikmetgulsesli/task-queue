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
      <body className="min-h-screen bg-gray-900 text-gray-100 font-mono">
        {children}
      </body>
    </html>
  );
}
