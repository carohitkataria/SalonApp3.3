import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Scissors, Clock, Search, Check, Calendar, ShoppingCart,
  ArrowDownAZ, Home, Flame, X, Plus, Minus
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GENDER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'male', label: 'Men' },
  { id: 'female', label: 'Women' },
];

export default function SalonServicesTab({ salonId, branchId, initialCategory = 'all' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedServices, setSelectedServices] = useState([]);
  // A2: New filter state
  // Normalize initial gender from user profile to 'all' | 'male' | 'female'
  const initialGender = (() => {
    const g = (user?.gender || '').toLowerCase();
    if (g === 'male' || g === 'men' || g === 'm') return 'male';
    if (g === 'female' || g === 'women' || g === 'w' || g === 'f') return 'female';
    return 'all';
  })();
  const [genderFilter, setGenderFilter] = useState(initialGender); // 'all' | 'male' | 'female'
  const [sortByPrice, setSortByPrice] = useState('default'); // 'default' | 'asc' | 'desc'
  const [atHomeOnly, setAtHomeOnly] = useState(false);

  // Sync category when prop changes (deep-link from home category tile)
  useEffect(() => {
    if (initialCategory && initialCategory !== selectedCategory) {
      setSelectedCategory(initialCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory]);

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId, branchId]);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/services/enabled`);
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const getTotalAmount = () => {
    return selectedServices.reduce((total, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return total + (service?.base_price || 0);
    }, 0);
  };

  const handleBookNow = () => {
    const params = new URLSearchParams();
    if (selectedServices.length) params.set('services', selectedServices.join(','));
    if (branchId) params.set('branch', branchId);
    navigate(`/book/${salonId}?${params.toString()}`);
  };

  // A2: gender filter applied to all services first
  // Unisex services always show. When Men is selected → Men + Unisex; Women → Women + Unisex.
  // gender_tag stored as 'Men' | 'Women' | 'Unisex'; filter IDs are 'male' | 'female' | 'all'.
  const genderFilteredServices = useMemo(() => services.filter(s => {
    const tag = (s.gender_tag || 'Unisex').toLowerCase();
    if (genderFilter === 'all' || tag === 'unisex') return true;
    if (genderFilter === 'male') return tag === 'men' || tag === 'male';
    if (genderFilter === 'female') return tag === 'women' || tag === 'female';
    return true;
  }), [services, genderFilter]);

  // Most booked: prefer is_favorite, fall back to first 2 (by index)
  const mostBookedIds = useMemo(() => {
    const favs = genderFilteredServices.filter(s => s.is_favorite).map(s => s.id);
    if (favs.length >= 2) return new Set(favs.slice(0, 3));
    return new Set(genderFilteredServices.slice(0, Math.min(2, genderFilteredServices.length)).map(s => s.id));
  }, [genderFilteredServices]);

  // Categories
  const categories = useMemo(() => ['all', ...Array.from(new Set(genderFilteredServices.map(s => s.category || 'General')))], [genderFilteredServices]);

  // Filter services
  const filteredServices = useMemo(() => {
    let list = genderFilteredServices.filter(service => {
      const matchesSearch = service.service_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || (service.category || 'General') === selectedCategory;
      const matchesAtHome = !atHomeOnly || service.available_at_home;
      return matchesSearch && matchesCategory && matchesAtHome;
    });
    if (sortByPrice === 'asc') list = [...list].sort((a, b) => (a.base_price || 0) - (b.base_price || 0));
    else if (sortByPrice === 'desc') list = [...list].sort((a, b) => (b.base_price || 0) - (a.base_price || 0));
    return list;
  }, [genderFilteredServices, searchQuery, selectedCategory, atHomeOnly, sortByPrice]);

  // Group by category (when category="all")
  const groupedServices = useMemo(() => {
    if (selectedCategory !== 'all') return { [selectedCategory]: filteredServices };
    return filteredServices.reduce((acc, service) => {
      const category = service.category || 'General';
      if (!acc[category]) acc[category] = [];
      acc[category].push(service);
      return acc;
    }, {});
  }, [filteredServices, selectedCategory]);

  const cycleSort = () => {
    setSortByPrice(prev => prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default');
  };

  const clearAllFilters = () => {
    setGenderFilter('all');
    setAtHomeOnly(false);
    setSortByPrice('default');
    setSelectedCategory('all');
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Scissors className="w-8 h-8 text-brass animate-spin" strokeWidth={1.4} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div>
          <span className="eyebrow-brass">Pick what you love</span>
          <h2 className="font-fraunces text-3xl font-medium leading-none mt-1">Our Services</h2>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.7} />
          <Input
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-full bg-card border-border focus:border-brass"
            data-testid="services-search-input"
          />
        </div>
      </div>

      {/* === A2: PINNED FILTER BAR (sticky, glass) === */}
      <div className="sticky top-[60px] sm:top-[64px] z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/85 backdrop-blur-md border-y border-border/60" data-testid="services-pinned-filter-bar">
        {/* On mobile, the filter row is horizontally-scrollable so ALL chips
            (gender, sort, at-home, categories) are reachable via touch swipe.
            On sm+ we wrap normally. */}
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Gender pill group */}
          <div className="inline-flex items-center bg-card border border-border rounded-full p-0.5 flex-shrink-0" data-testid="gender-filter-group">
            {GENDER_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setGenderFilter(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  genderFilter === opt.id
                    ? 'bg-brass text-espresso shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`gender-filter-${opt.id}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort by price */}
          <button
            onClick={cycleSort}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              sortByPrice !== 'default'
                ? 'bg-brass-soft border-brass/50 text-foreground'
                : 'bg-card border-border text-muted-foreground hover:border-brass/40'
            }`}
            data-testid="sort-by-price-btn"
          >
            <ArrowDownAZ className="w-3.5 h-3.5" strokeWidth={1.7} />
            {sortByPrice === 'asc' ? 'Price: Low → High' : sortByPrice === 'desc' ? 'Price: High → Low' : 'Sort'}
          </button>

          {/* At-home toggle */}
          <button
            onClick={() => setAtHomeOnly(v => !v)}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              atHomeOnly
                ? 'bg-sage/15 border-sage/50 text-foreground'
                : 'bg-card border-border text-muted-foreground hover:border-brass/40'
            }`}
            data-testid="at-home-filter-btn"
          >
            <Home className="w-3.5 h-3.5" strokeWidth={1.7} />
            At-home
          </button>

          {/* Category chips (scrollable) */}
          <div className="flex gap-1.5 flex-shrink-0">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-foreground text-background'
                    : 'bg-card border border-border text-foreground hover:border-brass/50'
                }`}
                data-testid={`category-chip-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              >
                {category === 'all' ? 'All' : category}
              </button>
            ))}
          </div>

          {/* Clear all (when active) */}
          {(genderFilter !== 'all' || atHomeOnly || sortByPrice !== 'default' || selectedCategory !== 'all' || searchQuery) && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground"
              data-testid="clear-filters-btn"
            >
              <X className="w-3 h-3" strokeWidth={1.7} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Services list */}
      {Object.keys(groupedServices).length > 0 && filteredServices.length > 0 ? (
        <div className="space-y-7">
          {Object.entries(groupedServices).map(([category, categoryServices]) => (
            <div key={category}>
              {selectedCategory === 'all' && (
                <h3 className="font-fraunces text-xl font-medium text-foreground mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-brass rounded-full" />
                  {category}
                  <span className="text-sm text-muted-foreground font-normal">· {categoryServices.length}</span>
                </h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryServices.map((service) => {
                  const isSelected = selectedServices.includes(service.id);
                  const thumb = service.thumbnail_url || service.image_url || (Array.isArray(service.images) && service.images[0]) || null;
                  const isMostBooked = mostBookedIds.has(service.id);
                  const isOnwards = service.price_type === 'onwards';
                  return (
                    <motion.div
                      key={service.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => toggleService(service.id)}
                      className={`relative lux-card rounded-2xl bg-card border-2 cursor-pointer overflow-hidden transition-all ${
                        isSelected
                          ? 'border-brass shadow-lux'
                          : 'border-border hover:border-brass/50'
                      }`}
                      data-testid={`service-card-${service.id}`}
                    >
                      <div className="flex gap-3 p-3">
                        {/* Thumbnail */}
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                          {thumb ? (
                            <img src={thumb} alt={service.service_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[rgb(var(--brass-rgb)/0.10)]">
                              <Scissors className="w-6 h-6 text-brass/70" strokeWidth={1.4} />
                            </div>
                          )}
                          {isMostBooked && (
                            <span
                              className="absolute -top-1 -left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-brass text-espresso text-[8px] font-bold uppercase tracking-wider shadow-lux"
                              data-testid={`service-most-booked-${service.id}`}
                            >
                              <Flame className="w-2 h-2" strokeWidth={2.4} />
                              Hot
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-fraunces text-[15px] font-medium text-foreground leading-tight line-clamp-2">{service.service_name}</h4>
                            {isSelected && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-brass flex items-center justify-center flex-shrink-0"
                              >
                                <Check className="w-3 h-3 text-espresso" strokeWidth={3} />
                              </motion.span>
                            )}
                          </div>
                          {service.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{service.description}</p>
                          )}
                          <div className="mt-auto pt-1.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" strokeWidth={1.8} />
                                {service.default_duration || 30}m
                              </span>
                              {service.gender_tag && service.gender_tag !== 'Unisex' && (
                                <span className="px-1.5 py-0.5 rounded-md bg-muted text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                                  {service.gender_tag}
                                </span>
                              )}
                              {service.available_at_home && (
                                <span className="inline-flex items-center gap-0.5 text-sage">
                                  <Home className="w-3 h-3" strokeWidth={1.8} />
                                </span>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bebas text-xl brass-text leading-none">₹{Math.round(service.base_price || 0)}</p>
                              {isOnwards && (
                                <p className="text-[9px] font-semibold text-brass uppercase tracking-wider leading-none mt-0.5">Onwards</p>
                              )}
                              {/* Item 4 — show at-home price next to base when set */}
                              {service.available_at_home && service.home_price != null && service.home_price !== service.base_price && (
                                <p
                                  className="text-[9px] font-semibold text-sage uppercase tracking-wider leading-none mt-0.5 inline-flex items-center gap-0.5"
                                  data-testid={`service-home-price-${service.id}`}
                                  title="Price when delivered at home"
                                >
                                  <Home className="w-2.5 h-2.5" strokeWidth={2} /> ₹{Math.round(service.home_price)} at home
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stepper bar (visible on selection) */}
                      {isSelected && (
                        <div className="border-t border-border/60 bg-brass-soft/40 px-3 py-1.5 flex items-center justify-between text-[11px] text-foreground">
                          <span className="font-medium">Added to cart</span>
                          <span className="inline-flex items-center gap-1">
                            <Plus className="w-3 h-3" strokeWidth={1.8} /> Tap card to remove
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // === A2: SMART EMPTY STATE with one-tap switch ===
        <div className="lux-card rounded-2xl bg-card p-10 text-center" data-testid="services-empty-state">
          <Scissors className="w-12 h-12 text-brass/40 mx-auto mb-4" strokeWidth={1.4} />
          <p className="font-fraunces text-lg text-foreground">No services match your filters</p>
          <p className="text-sm text-muted-foreground mt-1.5">
            {searchQuery
              ? `Nothing for "${searchQuery}" right now.`
              : genderFilter !== 'all'
                ? `Try expanding to all genders.`
                : `Try a different category or remove filters.`}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            {genderFilter !== 'all' && (
              <Button
                onClick={() => setGenderFilter('all')}
                className="bg-brass text-espresso hover:bg-brass-hover rounded-full"
                data-testid="empty-state-switch-gender-btn"
              >
                Show all genders
              </Button>
            )}
            <Button
              onClick={clearAllFilters}
              variant="outline"
              className="rounded-full border-brass/50 hover:bg-brass-soft"
              data-testid="empty-state-clear-all-btn"
            >
              Clear all filters
            </Button>
          </div>
        </div>
      )}

      {/* === Sticky bottom cart bar === */}
      <AnimatePresence>
        {selectedServices.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-brass/30 p-3.5 z-40 shadow-lux"
            data-testid="services-cart-bar"
          >
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-brass-soft border border-brass/30 rounded-full flex-shrink-0">
                  <ShoppingCart className="w-4 h-4 text-brass" strokeWidth={1.7} />
                </div>
                <div className="min-w-0">
                  <p className="font-fraunces text-sm text-foreground leading-tight truncate">
                    {selectedServices.length} service{selectedServices.length === 1 ? '' : 's'} added
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total: <span className="font-bebas brass-text text-lg leading-none">₹{getTotalAmount()}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setSelectedServices([])}
                  className="text-xs text-muted-foreground hover:text-foreground px-2"
                  data-testid="services-cart-clear-btn"
                >
                  <Minus className="w-4 h-4" strokeWidth={1.7} />
                </button>
                <Button
                  onClick={handleBookNow}
                  className="bg-brass text-espresso hover:bg-brass-hover rounded-full px-5 h-10 font-semibold"
                  data-testid="services-cart-book-btn"
                >
                  <Calendar className="w-4 h-4 mr-1.5" strokeWidth={1.8} />
                  Book Now
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
