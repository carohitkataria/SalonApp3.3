/**
 * Phase 10 — Slide-in cart drawer.
 *
 * Listens to CartContext. Renders one section per supplier so the salon can
 * see exactly which order will go to which vendor at checkout time. The
 * "Proceed to checkout" CTA simply routes to /salon/checkout — all server
 * interaction (reservation, Cashfree session) happens there.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { X, ShoppingBag, Trash2, Plus, Minus, IndianRupee, Boxes } from 'lucide-react';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function CartDrawer() {
  const navigate = useNavigate();
  const { drawerOpen, closeDrawer, items, updateQty, removeItem, summary, clear } = useCart();

  // Group items by supplier so the drawer shows one block per vendor.
  const groups = React.useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = it.supplier_id || 'unknown';
      if (!map.has(key)) {
        map.set(key, { supplier_id: key, supplier_name: it.supplier_name || 'Supplier', items: [] });
      }
      map.get(key).items.push(it);
    }
    return Array.from(map.values());
  }, [items]);

  if (!drawerOpen) return null;

  const proceedToCheckout = () => {
    closeDrawer();
    navigate('/salon/checkout');
  };

  return (
    <div className="fixed inset-0 z-50" aria-modal data-testid="cart-drawer">
      <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-background border-l border-border shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-14 px-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <ShoppingBag className="w-4 h-4 text-primary" /> Your cart ({summary.itemCount})
          </div>
          <button onClick={closeDrawer} className="p-2 rounded hover:bg-muted" data-testid="cart-close-btn">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Boxes className="w-10 h-10 mx-auto mb-3 opacity-60" />
              <div className="text-sm font-semibold mb-1">Your cart is empty</div>
              <div className="text-xs">Browse the store and add products you need.</div>
            </div>
          ) : (
            groups.map(g => (
              <div key={g.supplier_id} className="border border-border rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                  Supplier · {g.supplier_name}
                </div>
                <div className="divide-y divide-border">
                  {g.items.map(it => (
                    <CartLine
                      key={it.product_id}
                      it={it}
                      onInc={() => updateQty(it.product_id, it.qty + 1)}
                      onDec={() => updateQty(it.product_id, it.qty - 1)}
                      onRm={() => removeItem(it.product_id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <footer className="border-t border-border p-4 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(summary.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>{fmt(summary.gst)}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-border"><span>Total</span><span className="flex items-center"><IndianRupee className="w-4 h-4" />{Number(summary.total).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
              {summary.distinctSuppliers > 1 && (
                <div className="text-[10px] text-muted-foreground pt-1">Your cart spans {summary.distinctSuppliers} suppliers — they will be billed in one payment but fulfilled as separate shipments.</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clear} data-testid="cart-clear-btn">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
              <Button className="flex-1" onClick={proceedToCheckout} data-testid="cart-checkout-btn">
                Proceed to checkout
              </Button>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}


function CartLine({ it, onInc, onDec, onRm }) {
  const lineTotal = (it.selling_price * it.qty) * (1 + (it.gst_percent || 0) / 100);
  return (
    <div className="py-3 flex items-start gap-3" data-testid={`cart-line-${it.product_id}`}>
      <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
        {it.image_url
          ? <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
          : <Boxes className="w-5 h-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground line-clamp-1">{it.brand}</div>
        <div className="text-sm font-semibold line-clamp-2">{it.name}</div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button onClick={onDec} className="px-2 py-0.5 hover:bg-muted" data-testid={`cart-qty-minus-${it.product_id}`}><Minus className="w-3 h-3" /></button>
            <div className="px-2 text-xs font-bold min-w-6 text-center" data-testid={`cart-qty-${it.product_id}`}>{it.qty}</div>
            <button onClick={onInc} className="px-2 py-0.5 hover:bg-muted disabled:opacity-50" disabled={it.qty >= it.inventory_available} data-testid={`cart-qty-plus-${it.product_id}`}><Plus className="w-3 h-3" /></button>
          </div>
          <button onClick={onRm} className="p-1.5 rounded hover:bg-muted text-muted-foreground" data-testid={`cart-rm-${it.product_id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="text-sm font-bold">{fmt(lineTotal)}</div>
    </div>
  );
}
