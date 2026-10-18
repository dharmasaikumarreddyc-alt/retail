'use client';

import { useEffect, useState } from 'react';

// Floating theme picker. Applies the chosen theme by setting html[data-theme]
// (and data-bs-theme for dark themes, so Bootstrap 5.3 components flip too),
// and persists the choice in localStorage. The initial value is applied by an
// inline script in layout.tsx to avoid a flash of the wrong theme.

type ThemeId = 'daylight' | 'ocean' | 'meadow' | 'lavender' | 'midnight';

interface ThemeDef {
  id: ThemeId;
  name: string;
  swatch: string;
  dark: boolean;
}

const THEMES: ThemeDef[] = [
  { id: 'daylight', name: 'Daylight', swatch: 'linear-gradient(135deg,#f2683c 50%,#fbe9df 50%)', dark: false },
  { id: 'ocean', name: 'Ocean', swatch: 'linear-gradient(135deg,#2563eb 50%,#e0ecff 50%)', dark: false },
  { id: 'meadow', name: 'Meadow', swatch: 'linear-gradient(135deg,#16a34a 50%,#e2f6e9 50%)', dark: false },
  { id: 'lavender', name: 'Lavender', swatch: 'linear-gradient(135deg,#7c5cfc 50%,#ece6ff 50%)', dark: false },
  { id: 'midnight', name: 'Midnight', swatch: 'linear-gradient(135deg,#fb7185 50%,#0f172a 50%)', dark: true },
];

export const STORAGE_KEY = 'app-theme';

export function applyTheme(id: ThemeId) {
  const def = THEMES.find((t) => t.id === id) ?? THEMES[0];
  document.documentElement.setAttribute('data-theme', def.id);
  document.documentElement.setAttribute('data-bs-theme', def.dark ? 'dark' : 'light');
}

export default function ThemeProvider() {
  const [theme, setTheme] = useState<ThemeId>('daylight');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const rawSaved = localStorage.getItem(STORAGE_KEY);
    const saved = THEMES.some((t) => t.id === rawSaved) ? (rawSaved as ThemeId) : 'daylight';
    if (rawSaved && rawSaved !== saved) localStorage.setItem(STORAGE_KEY, saved);
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const choose = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
    localStorage.setItem(STORAGE_KEY, id);
    setOpen(false);
  };

  return (
    <>
      <button
        className="theme-fab"
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
        aria-label="Change theme"
      >
        <i className="fas fa-palette"></i>
      </button>

      {open && (
        <div className="theme-pop" role="menu">
          <div className="theme-pop-title">Theme</div>
          {THEMES.map((t) => (
            <button key={t.id} className="theme-opt" onClick={() => choose(t.id)} role="menuitem">
              <span className="swatch" style={{ background: t.swatch }} />
              <span>{t.name}</span>
              {theme === t.id && <i className="fas fa-check check" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
