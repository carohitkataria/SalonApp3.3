/**
 * GlobalSearchOverlay.js — Ribbon "Search" magnifier → full-app search.
 *
 * Wired from HomeV2Shell so any salon-side page can open it. Debounced
 * calls to `/api/salons/{id}/search?q=…`. Also filters a static list of
 * app features (nav items) locally with the same fuzzy rules so
 * "hair cut" jumps to Services if the user is really navigating.
 *
 * Fuzzy matching (mirrors backend rules exactly):
 *   • space-insensitive substring   ("hair cut" ↔ "haircut")
 *   • all-tokens-present, order-agnostic ("dettol cream" → "Dettol Shaving Cream")
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.REACT_APP_BACKEND_URL) ||
  '';
const API = `${BACKEND_URL}/api`;

// Static list of navigable features. `keywords` is what we fuzzy-match against.
const APP_FEATURES = [
  { id: 'home',            title: 'Home',             subtitle: 'Dashboard overview',           route: '/salon/dashboard?tab=home',            keywords: 'home dashboard overview main today kpi' },
  { id: 'queue',           title: 'Queue',            subtitle: 'Live token queue',             route: '/salon/dashboard?tab=queue',           keywords: 'queue tokens live bookings today waiting' },
  { id: 'staff',           title: 'Staff',            subtitle: 'Manage staff & barbers',       route: '/salon/dashboard?tab=staff',           keywords: 'staff barber employee stylist team manage' },
  { id: 'services',        title: 'Services',         subtitle: 'Enable & price your services', route: '/salon/dashboard?tab=services',        keywords: 'services haircut catalog offerings menu pricing' },
  { id: 'financials',      title: 'Finance',          subtitle: 'Revenue, expenses, cash',      route: '/salon/dashboard?tab=financials',      keywords: 'finance financials revenue expense cash transactions accounting money' },
  { id: 'analytics',       title: 'Analytics',        subtitle: 'Reports & insights',           route: '/salon/dashboard?tab=analytics',       keywords: 'analytics reports insights charts performance sales' },
  { id: 'customer-master', title: 'Guests',           subtitle: 'Customer database',            route: '/salon/dashboard?tab=customer-master', keywords: 'guests customers clients members contacts crm' },
  { id: 'memberships',     title: 'Memberships',      subtitle: 'Plans & subscriptions',        route: '/salon/dashboard?tab=memberships',     keywords: 'memberships plans subscriptions vip loyalty' },
  { id: 'marketing',       title: 'Marketing',        subtitle: 'Campaigns, templates, WhatsApp', route: '/salon/dashboard?tab=marketing',     keywords: 'marketing campaigns whatsapp email sms templates dlt' },
  { id: 'inventory',       title: 'Stock',            subtitle: 'Inventory & retail',           route: '/salon/dashboard?tab=inventory',       keywords: 'stock inventory retail products supplies' },
  { id: 'notifications',   title: 'Notifications',    subtitle: 'Recent alerts',                route: '/salon/dashboard?tab=notifications',   keywords: 'notifications alerts inbox bell messages' },
  { id: 'marketplace',     title: 'Shop',             subtitle: 'Salon store — order supplies', route: '/salon/marketplace',                   keywords: 'shop store marketplace supplies buy order products' },
  { id: 'salon',           title: 'Settings',         subtitle: 'Salon profile & branding',     route: '/salon/dashboard?tab=salon',           keywords: 'settings salon profile branding config preferences' },
];

// ---- shared fuzzy match helpers (mirror the backend) --------------------
function _norm(s) { return (s == null ? '' : String(s)).toLowerCase(); }
function _compact(s) { return _norm(s).replace(/\s+/g, ''); }
function _match(text, qNorm, qTokens, qCompact) {
  if (!text) return false;
  const t = _norm(text);
  if (!qNorm) return false;
  if (t.indexOf(qNorm) !== -1) return true;
  if (qCompact && _compact(t).indexOf(qCompact) !== -1) return true;
  if (qTokens.length && qTokens.every(tok => t.indexOf(tok) !== -1)) return true;
  return false;
}

// ---- icons --------------------------------------------------------------
const IC = {
  search: () => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  x:      () => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  user:   () => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/></svg>),
  scissors:()=> (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>),
  badge:  () => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15l-2 5-3-4-4 1 3-6"/><path d="M12 15l2 5 3-4 4 1-3-6"/><circle cx="12" cy="9" r="6"/></svg>),
  shop:   () => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h2l3 12h13l3-8H6"/><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>),
  chip:   () => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 9h6v6H9z"/></svg>),
};
const TYPE_META = {
  customer:   { label: 'Guests',       icon: IC.user     },
  service:    { label: 'Services',     icon: IC.scissors },
  staff:      { label: 'Staff',        icon: IC.user     },
  membership: { label: 'Memberships',  icon: IC.badge    },
  product:    { label: 'Shop',         icon: IC.shop     },
  feature:    { label: 'App features', icon: IC.chip     },
};

// -----------------------------------------------------------------------

export default function GlobalSearchOverlay({ open, onClose, salonId, getAuthHeaders }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [remoteResults, setRemoteResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Focus input whenever we open + reset state on close
  useEffect(() => {
    if (open) {
      setQ('');
      setRemoteResults([]);
      setHighlight(0);
      // defer focus until after portal mount
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Debounced backend fetch
  useEffect(() => {
    if (!open) return undefined;
    if (!q || q.trim().length < 2) { setRemoteResults([]); setLoading(false); return undefined; }
    if (!salonId) { setRemoteResults([]); return undefined; }
    setLoading(true);
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      try {
        const headers = (typeof getAuthHeaders === 'function') ? (getAuthHeaders() || {}) : {};
        const url = `${API}/salons/${salonId}/search?q=${encodeURIComponent(q)}`;
        const r = await axios.get(url, { headers, signal: controller.signal });
        setRemoteResults(r.data?.results || []);
      } catch (e) {
        if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') {
          // Non-fatal — just log & show empty
          // eslint-disable-next-line no-console
          console.warn('[globalSearch] error:', e?.message || e);
        }
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, open, salonId, getAuthHeaders]);

  // Local feature matches (fuzzy)
  const featureResults = useMemo(() => {
    const qNorm = _norm(q).trim();
    if (qNorm.length < 2) return [];
    const qTokens = qNorm.split(/\s+/).filter(Boolean);
    const qCompact = qNorm.replace(/\s+/g, '');
    return APP_FEATURES
      .filter(f => _match(`${f.title} ${f.keywords}`, qNorm, qTokens, qCompact))
      .slice(0, 6)
      .map(f => ({ ...f, type: 'feature' }));
  }, [q]);

  // Combined ordered list (features first — nav is usually intent)
  const combined = useMemo(() => {
    return [...featureResults, ...remoteResults];
  }, [featureResults, remoteResults]);

  const groups = useMemo(() => {
    const g = {};
    combined.forEach((r) => {
      const key = r.type || 'other';
      if (!g[key]) g[key] = [];
      g[key].push(r);
    });
    // Preserve visual order (features first, then customer, service, staff, membership, product)
    const order = ['feature', 'customer', 'service', 'staff', 'membership', 'product'];
    return order.filter(k => g[k]?.length).map(k => ({ key: k, items: g[k] }));
  }, [combined]);

  const flat = useMemo(() => groups.flatMap(g => g.items), [groups]);

  const go = useCallback((item) => {
    if (!item?.route) return;
    onClose?.();
    // Slight delay so the overlay unmounts before route swap
    setTimeout(() => navigate(item.route), 50);
  }, [navigate, onClose]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(flat.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flat[highlight];
        if (item) go(item);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, highlight, go]);

  useEffect(() => { setHighlight(0); }, [combined.length]);

  if (!open) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(15, 12, 30, 0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <div
        style={{
          width: 'min(680px, 92vw)',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 30px 60px -20px rgba(15,10,40,0.35), 0 8px 20px -8px rgba(15,10,40,0.2)',
          overflow: 'hidden',
          border: '1px solid rgba(150, 140, 200, 0.25)',
        }}
      >
        {/* Search input row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', borderBottom: '1px solid #F0EEF7',
        }}>
          <span style={{ color: '#6B5FA6' }}><IC.search /></span>
          <input
            ref={inputRef}
            type="text"
            data-testid="global-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customers, services, staff, products, or app features…"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 16,
              background: 'transparent', color: '#211a3d',
            }}
          />
          <kbd style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 6,
            background: '#F3F0FA', color: '#6B5FA6', border: '1px solid #E3DFF3',
          }}>ESC</kbd>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#8880a8', padding: 4,
            }}
          ><IC.x /></button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {q.trim().length < 2 && (
            <div style={{ padding: '38px 24px', textAlign: 'center', color: '#8880a8' }}>
              <div style={{ fontSize: 14, marginBottom: 6 }}>Type to search.</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Try <em>hair cut</em>, <em>priya</em>, <em>shampoo</em>, or <em>marketing</em>.
              </div>
            </div>
          )}

          {q.trim().length >= 2 && loading && flat.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#8880a8', fontSize: 13 }}>Searching…</div>
          )}

          {q.trim().length >= 2 && !loading && flat.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#8880a8', fontSize: 13 }}>
              No matches for &ldquo;<strong>{q}</strong>&rdquo;.
            </div>
          )}

          {groups.map((group) => {
            const meta = TYPE_META[group.key] || { label: group.key, icon: IC.chip };
            return (
              <div key={group.key} style={{ padding: '8px 0' }}>
                <div style={{
                  padding: '6px 18px', fontSize: 10, letterSpacing: 1,
                  textTransform: 'uppercase', color: '#8880a8', fontWeight: 700,
                }}>{meta.label}</div>
                {group.items.map((item) => {
                  const globalIndex = flat.indexOf(item);
                  const active = globalIndex === highlight;
                  return (
                    <button
                      key={`${item.type}:${item.id}`}
                      type="button"
                      data-testid={`global-search-hit-${item.type}`}
                      onMouseEnter={() => setHighlight(globalIndex)}
                      onClick={() => go(item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        padding: '10px 18px', border: 'none',
                        background: active ? '#F5F1FF' : 'transparent',
                        color: '#211a3d', textAlign: 'left', cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, background: '#F3F0FA',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: '#6B5FA6', flexShrink: 0,
                      }}><meta.icon /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        {item.subtitle && (
                          <div style={{ fontSize: 11, color: '#6B6489', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtitle}</div>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: '#a89fc6' }}>↵</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div style={{
          display: 'flex', gap: 14, padding: '8px 18px',
          borderTop: '1px solid #F0EEF7', color: '#a89fc6', fontSize: 11,
        }}>
          <span>↑ ↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
          <span style={{ marginLeft: 'auto' }}>Global search</span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
