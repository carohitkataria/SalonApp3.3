import { useState, useRef, useEffect } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Dropdown theme picker — shows named swatches.
 * `compact` = 36px tile (sidebar / floating use). Otherwise pill button with label.
 * `direction` = 'down' | 'up' — controls dropdown placement (use 'up' inside sidebar footer).
 */
export default function ThemePicker({ compact = false, align = 'right', direction = 'down', className = '' }) {
  const { theme, themes, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        data-testid="theme-picker-btn"
        aria-label="Pick a theme"
        className={
          compact
            ? 'inline-flex items-center justify-center h-9 w-9 rounded-full border border-border bg-card hover:border-brass/60 transition-colors'
            : 'inline-flex items-center gap-2 h-9 px-3 rounded-full border border-border bg-card hover:border-brass/60 transition-colors text-sm'
        }
      >
        <Swatch primary={theme.swatch.primary} accent={theme.swatch.accent} size={compact ? 16 : 14} />
        {!compact && (
          <>
            <span className="text-foreground font-medium">{theme.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.6} />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-[60] w-64 lux-card bg-popover rounded-2xl p-2 shadow-lux-lg ${
              align === 'left' ? 'left-0' : 'right-0'
            } ${
              direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
            data-testid="theme-picker-menu"
          >
            <div className="px-3 pt-2 pb-1 flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-brass" strokeWidth={1.6} />
              <span className="eyebrow-brass">Theme</span>
            </div>
            <div className="space-y-0.5 py-1">
              {themes.map((t) => {
                const active = t.id === theme.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setTheme(t.id); setOpen(false); }}
                    data-testid={`theme-option-${t.id}`}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                      active ? 'bg-brass-soft' : 'hover:bg-muted'
                    }`}
                  >
                    <Swatch primary={t.swatch.primary} accent={t.swatch.accent} size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground leading-tight">{t.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{t.description}</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-brass flex-shrink-0" strokeWidth={2} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Swatch({ primary, accent, size = 18 }) {
  return (
    <span
      className="relative inline-flex flex-shrink-0 rounded-full overflow-hidden ring-1 ring-border"
      style={{ width: size, height: size, background: primary }}
      aria-hidden="true"
    >
      <span
        className="absolute right-0 top-0 bottom-0"
        style={{ width: size / 2, background: accent }}
      />
    </span>
  );
}
