import type { Metadata } from 'next';
import { Libre_Franklin, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const sans = Libre_Franklin({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = { title: 'StratScope', description: 'Strategic planning analysis workbench' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
