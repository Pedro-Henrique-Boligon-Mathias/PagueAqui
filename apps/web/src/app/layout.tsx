import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ThemeToggle } from './theme-toggle';

export const metadata: Metadata = {
  title: 'Leitor NFC-e',
  description: 'Painel para leitura de QR Codes de notas fiscais.',
};

const themeScript = `
  try {
    const storedTheme = window.localStorage.getItem('leitor_nfce_theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : systemTheme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
