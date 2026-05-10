import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  try {
    return localStorage.getItem('salon_theme') || 'light';
  } catch {
    return 'light';
  }
};

// Apply theme synchronously on module load to avoid first-paint flash
if (typeof document !== 'undefined') {
  const initial = getInitialTheme();
  document.documentElement.classList.toggle('dark', initial === 'dark');
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try { localStorage.setItem('salon_theme', newTheme); } catch { /* noop */ }
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
