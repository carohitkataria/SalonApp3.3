import React from 'react';
import { Crown } from 'lucide-react';

// Default colors for tiers — match backend defaults (see MembershipManagement.js TIER_PRESETS)
const TIER_COLORS = {
  Diamond: '#38bdf8',
  Gold:    '#f59e0b',
  Silver:  '#94a3b8',
  Custom:  '#a855f7',
};

/**
 * Small color-tier badge used to mark customers who have an active membership.
 *
 * Props:
 *   tier   — "Diamond" | "Gold" | "Silver" | "Custom" (optional)
 *   color  — hex color override (optional)
 *   name   — membership plan name (optional, shown next to the crown icon)
 *   size   — "xs" | "sm" | "md" (default "sm")
 */
export default function MembershipBadge({ tier, color, name, size = 'sm', className = '' }) {
  const resolvedColor = color || TIER_COLORS[tier] || TIER_COLORS.Custom;
  const sizes = {
    xs: { pad: 'px-1.5 py-0.5', text: 'text-[10px]', icon: 10 },
    sm: { pad: 'px-2 py-0.5', text: 'text-[11px]', icon: 12 },
    md: { pad: 'px-2.5 py-1', text: 'text-xs', icon: 14 },
  }[size] || { pad: 'px-2 py-0.5', text: 'text-[11px]', icon: 12 };

  const label = tier || 'Member';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider ${sizes.pad} ${sizes.text} ${className}`}
      style={{ color: resolvedColor, borderColor: resolvedColor, backgroundColor: resolvedColor + '1A' }}
      title={name ? `${name} • ${label} member` : `${label} member`}
    >
      <Crown size={sizes.icon} style={{ color: resolvedColor }} />
      {label}
    </span>
  );
}
