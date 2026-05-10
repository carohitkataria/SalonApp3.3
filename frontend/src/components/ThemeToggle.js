import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <motion.button
      onClick={toggleTheme}
      whileTap={{ scale: 0.95 }}
      data-testid="theme-toggle-btn"
      aria-label="Toggle theme"
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:border-brass/60 transition-colors ${className}`}
    >
      <motion.span
        key={isDark ? 'moon' : 'sun'}
        initial={{ rotate: -45, opacity: 0, scale: 0.7 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {isDark
          ? <Sun className="h-[18px] w-[18px] text-brass" strokeWidth={1.6} />
          : <Moon className="h-[18px] w-[18px] text-brass-700" strokeWidth={1.6} />}
      </motion.span>
    </motion.button>
  );
}
