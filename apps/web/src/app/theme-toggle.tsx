'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'dark' | 'light';

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem('leitor_nfce_theme');

  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = getStoredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem('leitor_nfce_theme', nextTheme);
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      onClick={toggleTheme}
    >
      <span aria-hidden="true">{mounted && theme === 'dark' ? '☾' : '☼'}</span>
      <span>{mounted && theme === 'dark' ? 'Escuro' : 'Claro'}</span>
    </button>
  );
}
