/**
 * Phase 10 — Client-side cart context for the Salon Store.
 *
 * Persistence: the cart is kept in `localStorage` under `salon_store_cart_v1`,
 * scoped per-salon so a multi-tenant browser session (rare but possible) does
 * not cross-pollute. The cart is purely UI state — the server has no concept
 * of a persisted cart until `POST /api/salon/store/checkout` is called.
 *
 * Each line stores enough product data to render the cart drawer without a
 * round-trip, plus the canonical `product_id` and `qty` which are the only
 * fields the checkout API really cares about.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const CartContext = createContext(null);

const STORAGE_PREFIX = 'salon_store_cart_v1::';

function readCart(salonId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + (salonId || 'anon'));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(salonId, items) {
  try {
    localStorage.setItem(STORAGE_PREFIX + (salonId || 'anon'), JSON.stringify(items));
  } catch { /* quota/private mode — ignore */ }
}

export function CartProvider({ children }) {
  const { salonUser } = useAuth();
  const salonId = salonUser?.salonId || 'anon';

  const [items, setItems] = useState(() => readCart(salonId));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Re-hydrate when the salon changes (login/logout).
  useEffect(() => {
    setItems(readCart(salonId));
  }, [salonId]);

  // Persist on every change.
  useEffect(() => {
    writeCart(salonId, items);
  }, [salonId, items]);

  const addItem = useCallback((product, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product_id === product.id ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        image_url: (product.images || [])[0] || null,
        unit: product.unit,
        pack_size: product.pack_size,
        selling_price: Number(product.selling_price || 0),
        mrp: Number(product.mrp || product.selling_price || 0),
        gst_percent: Number(product.gst_percent || 0),
        supplier_id: product.supplier_id,
        supplier_name: product.supplier?.business_name || product.supplier_name,
        inventory_available: Number(product.inventory_available || 0),
        min_order_qty: Number(product.min_order_qty || 1),
        qty,
      }];
    });
  }, []);

  const updateQty = useCallback((product_id, qty) => {
    setItems(prev =>
      prev
        .map(i => (i.product_id === product_id ? { ...i, qty: Math.max(0, qty) } : i))
        .filter(i => i.qty > 0)
    );
  }, []);

  const removeItem = useCallback((product_id) => {
    setItems(prev => prev.filter(i => i.product_id !== product_id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const summary = useMemo(() => {
    let subtotal = 0;
    let gst = 0;
    for (const i of items) {
      const lineSub = (Number(i.selling_price) || 0) * i.qty;
      subtotal += lineSub;
      gst += lineSub * (Number(i.gst_percent) || 0) / 100;
    }
    const itemCount = items.reduce((acc, i) => acc + i.qty, 0);
    const distinctSuppliers = new Set(items.map(i => i.supplier_id)).size;
    return {
      itemCount,
      subtotal: Math.round(subtotal * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      total: Math.round((subtotal + gst) * 100) / 100,
      distinctSuppliers,
    };
  }, [items]);

  const value = useMemo(() => ({
    items,
    addItem,
    updateQty,
    removeItem,
    clear,
    drawerOpen,
    openDrawer,
    closeDrawer,
    summary,
  }), [items, addItem, updateQty, removeItem, clear, drawerOpen, openDrawer, closeDrawer, summary]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
