import { createContext, useContext, useState, useEffect } from 'react';

/**
 * SalonHub — Multi-theme system
 * Each theme has: id, name, swatch (hex pair for picker preview),
 * mode ('light' | 'dark' for the .dark class) and matches a CSS selector
 * `[data-theme="<id>"]` defined in index.css.
 */
export const THEMES = [
  {
    id: 'ivory',
    name: 'Ivory',
    description: 'Original light · pure white & brass',
    mode: 'light',
    swatch: { primary: '#FFFFFF', accent: '#A88438' },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Warm charcoal & brass',
    mode: 'dark',
    swatch: { primary: '#0E0C09', accent: '#C9A961' },
  },
  {
    id: 'velvet',
    name: 'Velvet Royal',
    description: 'Deep purple & gold',
    mode: 'dark',
    swatch: { primary: '#5C2B84', accent: '#FFC000' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Navy & champagne',
    mode: 'dark',
    swatch: { primary: '#0A1628', accent: '#D4B896' },
  },
  {
    id: 'sand',
    name: 'Sand',
    description: 'Warm beige & terracotta',
    mode: 'light',
    swatch: { primary: '#E8DDC9', accent: '#A66B3F' },
  },
];

const STORAGE_KEY = 'salon_theme_id';
const LEGACY_KEY = 'salon_theme'; // 'light' | 'dark' (old)

const getInitialThemeId = () => {
  if (typeof window === 'undefined') return 'ivory';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some(t => t.id === saved)) return saved;
    // migrate legacy light/dark choice
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'dark') return 'obsidian';
    if (legacy === 'light') return 'ivory';
  } catch { /* noop */ }
  return 'ivory';
};

const applyTheme = (themeId) => {
  if (typeof document === 'undefined') return;
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);
  document.documentElement.classList.toggle('dark', theme.mode === 'dark');
};

// Apply theme synchronously on module load to avoid first-paint flash
applyTheme(getInitialThemeId());

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeId, setThemeId] = useState(getInitialThemeId);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  const setTheme = (id) => {
    if (!THEMES.some(t => t.id === id)) return;
    setThemeId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
      // sync legacy key too so any old code reading it still gets a sensible value
      const t = THEMES.find(x => x.id === id);
      localStorage.setItem(LEGACY_KEY, t?.mode === 'dark' ? 'dark' : 'light');
    } catch { /* noop */ }
  };

  // Backwards-compat: toggleTheme cycles between light <-> first dark
  const toggleTheme = () => {
    const current = THEMES.find(t => t.id === themeId);
    if (current?.mode === 'dark') setTheme('ivory');
    else setTheme('obsidian');
  };

  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];

  return (
    <ThemeContext.Provider value={{
      themeId,
      theme,
      themes: THEMES,
      setTheme,
      // Legacy API
      toggleTheme,
      get isDark() { return theme.mode === 'dark'; },
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
