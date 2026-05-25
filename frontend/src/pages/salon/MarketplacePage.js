/**
 * Phase 10 — Salon-side Marketplace page.
 * Salon admins browse the supplier catalog, filter by category/brand,
 * search, sort, and place an inquiry on items of interest.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Loader2, Search, ShoppingBag, Tag, IndianRupee, Star, MapPin,
  ArrowLeft, MessageSquare, Boxes, ChevronLeft, ChevronRight, X, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const SORT_OPTIONS = [
  { value: 'popular',    label: 'Most popular' },
  { value: 'price_asc',  label: 'Price: low → high' },
  { value: 'price_desc', label: 'Price: high → low' },
  { value: 'newest',     label: 'Newest first' },
];

export default function MarketplacePage() {
  const { salonId } = useParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState('popular');

  const [activeProduct, setActiveProduct] = useState(null);
  const [inquiryQty, setInquiryQty] = useState(1);
  const [inquiryMsg, setInquiryMsg] = useState('');
  const [inquirySending, setInquirySending] = useState(false);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('salon_admin_token') || localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 24, sort };
      if (search) params.q = search;
      if (category) params.category = category;
      if (brand) params.brand = brand;
      const r = await axios.get(`${API}/marketplace/products`, { headers: authHeaders, params });
      setProducts(r.data.products || []);
      setTotal(r.data.total || 0);
      setTotalPages(r.data.total_pages || 1);
    } catch (e) {
      if (e?.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        navigate('/salon/login');
        return;
      }
      toast.error('Failed to load marketplace');
    } finally { setLoading(false); }
  }, [authHeaders, page, search, category, brand, sort, navigate]);

  const fetchFilters = useCallback(async () => {
    try {
      const [c, b] = await Promise.all([
        axios.get(`${API}/marketplace/categories`, { headers: authHeaders }),
        axios.get(`${API}/marketplace/brands`,     { headers: authHeaders }),
      ]);
      setCategories(c.data.categories || []);
      setBrands(b.data.brands || []);
    } catch { /* non-fatal */ }
  }, [authHeaders]);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Submit search
  const onSearch = (e) => {
    e?.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  };

  const onCategoryChange = (c) => { setCategory(c); setPage(1); };
  const onBrandChange = (b) => { setBrand(b); setPage(1); };
  const onSortChange = (s) => { setSort(s); setPage(1); };

  const clearFilters = () => {
    setCategory(''); setBrand(''); setSearch(''); setSearchDraft(''); setSort('popular'); setPage(1);
  };

  // Inquiry flow
  const openInquiry = (p) => { setActiveProduct(p); setInquiryQty(p.min_order_qty || 1); setInquiryMsg(''); };
  const closeInquiry = () => { setActiveProduct(null); };

  const submitInquiry = async () => {
    if (!activeProduct) return;
    if (inquiryQty < 1) { toast.error('Quantity must be at least 1'); return; }
    setInquirySending(true);
    try {
      await axios.post(`${API}/marketplace/inquiries`, {
        product_id: activeProduct.id,
        qty: Number(inquiryQty),
        message: inquiryMsg.trim() || null,
      }, { headers: authHeaders });
      toast.success(`Inquiry sent to ${activeProduct.supplier?.business_name || 'supplier'}`);
      closeInquiry();
    } catch (e) {
      const raw = e?.response?.data?.detail;
      const msg = typeof raw === 'string' ? raw : (raw?.message || 'Failed to send inquiry');
      toast.error(msg);
    } finally { setInquirySending(false); }
  };

  const hasFilters = search || category || brand || sort !== 'popular';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(salonId ? `/salon/dashboard` : '/salon/dashboard')}
            data-testid="marketplace-back-btn"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h1 className="text-base font-bold">Marketplace</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {total} products</span>
          </div>
          <div className="w-24" />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Filter bar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-2 mb-5">
          <form onSubmit={onSearch} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="marketplace-search-input"
              placeholder="Search products, brands, descriptions"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </form>
          <select
            data-testid="marketplace-category-filter"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
          </select>
          <select
            data-testid="marketplace-brand-filter"
            value={brand}
            onChange={(e) => onBrandChange(e.target.value)}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm"
          >
            <option value="">All brands</option>
            {brands.map(b => <option key={b.name} value={b.name}>{b.name} ({b.count})</option>)}
          </select>
          <select
            data-testid="marketplace-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-center gap-2 mb-4 text-xs">
            <span className="text-muted-foreground">Filters active:</span>
            {category && <Pill label={category} onClear={() => onCategoryChange('')} />}
            {brand && <Pill label={brand} onClear={() => onBrandChange('')} />}
            {search && <Pill label={`"${search}"`} onClear={() => { setSearch(''); setSearchDraft(''); }} />}
            <button onClick={clearFilters} className="text-primary hover:opacity-80 font-bold uppercase tracking-widest text-[10px]">Clear all</button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-10 text-center">
            <Boxes className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-bold">No products match those filters</h3>
            <p className="text-sm text-muted-foreground mt-1">Try a different category or clear filters.</p>
            {hasFilters && <Button onClick={clearFilters} className="mt-4" variant="outline">Clear filters</Button>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onInquire={() => openInquiry(p)} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline" size="sm" disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  data-testid="marketplace-prev-page"
                ><ChevronLeft className="w-4 h-4" /> Prev</Button>
                <span className="text-sm text-muted-foreground" data-testid="marketplace-page-info">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline" size="sm" disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  data-testid="marketplace-next-page"
                >Next <ChevronRight className="w-4 h-4" /></Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Inquiry drawer / modal */}
      {activeProduct && (
        <InquiryModal
          product={activeProduct}
          qty={inquiryQty} setQty={setInquiryQty}
          msg={inquiryMsg} setMsg={setInquiryMsg}
          sending={inquirySending}
          onClose={closeInquiry}
          onSubmit={submitInquiry}
        />
      )}
    </div>
  );
}

function Pill({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
      {label}
      <button onClick={onClear} className="hover:opacity-70" aria-label={`Remove ${label}`}>
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function ProductCard({ product, onInquire }) {
  const img = product.images?.[0];
  const disc = product.mrp && product.mrp > product.selling_price
    ? Math.round(((product.mrp - product.selling_price) / product.mrp) * 100)
    : 0;
  return (
    <div
      data-testid={`marketplace-product-card-${product.id}`}
      className="rounded-2xl border border-border bg-card/40 overflow-hidden hover:border-primary/40 transition-colors flex flex-col"
    >
      <div className="aspect-square bg-background relative">
        {img ? (
          <img src={img} alt={product.name} className="w-full h-full object-cover" loading="lazy"
               onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Boxes className="w-12 h-12 text-muted-foreground/30" /></div>
        )}
        {disc > 0 && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest">
            -{disc}%
          </div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="text-[10px] uppercase tracking-widest font-bold text-primary flex items-center gap-1">
          <Tag className="w-3 h-3" /> {product.category}{product.sub_category ? ` · ${product.sub_category}` : ''}
        </div>
        <h3 className="text-sm font-bold mt-1 line-clamp-2">{product.name}</h3>
        {product.brand && <div className="text-xs text-muted-foreground">{product.brand}{product.pack_size ? ` · ${product.pack_size}` : ''}</div>}

        {product.supplier && (
          <div className="text-[11px] text-muted-foreground/90 mt-2 flex items-center gap-1">
            <span className="font-medium text-foreground/80">{product.supplier.business_name}</span>
            {product.supplier.rating_count > 0 && (
              <span className="flex items-center gap-0.5 text-amber-500">
                <Star className="w-3 h-3 fill-current" /> {product.supplier.rating_avg.toFixed(1)}
              </span>
            )}
            {product.supplier.city && (
              <span className="ml-auto flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {product.supplier.city}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="text-base font-bold text-primary flex items-center">
            <IndianRupee className="w-3.5 h-3.5" />{Number(product.selling_price).toLocaleString('en-IN')}
          </div>
          {product.mrp > product.selling_price && (
            <div className="text-xs text-muted-foreground line-through">{fmtMoney(product.mrp)}</div>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {product.inventory_available > 50 ? 'In stock' : `Only ${product.inventory_available} left`}
          {product.min_order_qty > 1 && <span> · MOQ {product.min_order_qty}</span>}
        </div>

        <Button
          data-testid={`marketplace-inquire-${product.id}`}
          onClick={onInquire}
          className="mt-3 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs"
        >
          <MessageSquare className="w-3.5 h-3.5 mr-1" /> Inquire
        </Button>
      </div>
    </div>
  );
}

function InquiryModal({ product, qty, setQty, msg, setMsg, sending, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-bold">Send inquiry</h3>
            <p className="text-xs text-muted-foreground">The supplier will respond on WhatsApp with a quote.</p>
          </div>
          <button onClick={onClose} data-testid="inquiry-close-btn" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl border border-border bg-background p-3 flex gap-3 mb-4">
          <div className="w-16 h-16 rounded-lg bg-card overflow-hidden flex-shrink-0">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Boxes className="w-6 h-6 text-muted-foreground/40" /></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-bold text-primary">{product.category}</div>
            <div className="text-sm font-bold line-clamp-1">{product.name}</div>
            <div className="text-xs text-muted-foreground">{product.brand} · {product.pack_size}</div>
            <div className="text-sm font-bold text-primary mt-1">{fmtMoney(product.selling_price)} <span className="text-[10px] text-muted-foreground font-normal">per {product.unit}</span></div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Quantity</label>
            <Input
              type="number"
              min={product.min_order_qty || 1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              data-testid="inquiry-qty-input"
              className="mt-1 bg-background border-border"
            />
            <div className="text-[10px] text-muted-foreground mt-1">
              MOQ: {product.min_order_qty || 1} {product.unit} · Available: {product.inventory_available}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Message (optional)</label>
            <textarea
              rows={3}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              data-testid="inquiry-message-input"
              placeholder="Specify shade, delivery timeline, bulk-pricing ask, etc."
              className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
            Estimated value: <span className="font-bold text-primary">{fmtMoney((Number(qty) || 0) * (product.selling_price || 0))}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={sending}
            data-testid="inquiry-submit-btn"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
          >
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Send inquiry
          </Button>
        </div>
      </div>
    </div>
  );
}
