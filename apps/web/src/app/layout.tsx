import type { Metadata } from 'next';
import '../styles/globals.css';
import { Providers } from '../components/providers';

export const metadata: Metadata = {
  title: 'Home Inventory — The Digital Twin for Your Home',
  description: 'Production-quality Home Inventory Management System. Know what you own and where it is without opening boxes.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
