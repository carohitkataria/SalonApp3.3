import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Search, Scissors, Package, Star, Clock, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ServicesBrowser() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('branch') || '';
  const { user, isUserLoggedIn } = useAuth();

  const [salon, setSalon] = useState(null);
  const [allServices, setAllServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [favoriteServices, setFavoriteServices] = useState([]);
  const [recentServices, setRecentServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('services');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoggedIn, salonId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Public calls — work without auth
      const [salonRes, servicesRes, packagesRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}`),
        axios.get(`${API}/services`),
        axios.get(`${API}/packages`),
      ]);

      setSalon(salonRes.data);
      setAllServices(servicesRes.data);
      setPackages(packagesRes.data);

      // Auth-only enrichments — skip silently when not logged in
      if (isUserLoggedIn) {
        try {
          const favoritesRes = await axios.get(`${API}/services/favorites`);
          setFavoriteServices(favoritesRes.data);
        } catch (err) { /* ignore */ }

        if (user?.id) {
          try {
            const recentRes = await axios.get(`${API}/users/${user.id}/recent-services`);
            setRecentServices(recentRes.data.services || []);
          } catch (err) {
            // No recent services — leave list empty.
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const filterServices = (services) => {
    if (!searchQuery) return services;
    
    const query = searchQuery.toLowerCase();
    return services.filter(service => 
      service.service_name?.toLowerCase().includes(query) ||
      service.description?.toLowerCase().includes(query) ||
      service.category?.toLowerCase().includes(query)
    );
  };

  const groupServicesByCategory = (services) => {
    const grouped = {};
    services.forEach(service => {
      const category = service.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(service);
    });
    return grouped;
  };

  const ServiceCard = ({ service }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border rounded-lg p-4 hover:border-gold transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-bold text-foreground mb-1">{service.service_name}</h3>
          {service.description && (
            <p className="text-xs text-muted-foreground mb-2">{service.description}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {service.category && (
              <span className="text-xs px-2 py-1 bg-background rounded border border-border">
                {service.category}
              </span>
            )}
            {service.gender_tag && (
              <span className="text-xs px-2 py-1 bg-background rounded border border-border">
                {service.gender_tag}
              </span>
            )}
          </div>
        </div>
        <div className="text-right ml-4">
          <div className="text-lg font-bold text-gold">
            ₹{service.base_price}
            {service.price_type === 'onwards' && <span className="text-xs">+</span>}
          </div>
          <div className="text-xs text-muted-foreground">{service.default_duration} min</div>
        </div>
      </div>
    </motion.div>
  );

  const PackageCard = ({ pkg }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border rounded-lg p-4 hover:border-gold transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-gold" />
            <h3 className="font-bold text-foreground">{pkg.package_name}</h3>
          </div>
          {pkg.description && (
            <p className="text-xs text-muted-foreground mb-2">{pkg.description}</p>
          )}
          <div className="text-xs text-muted-foreground">
            {pkg.service_ids?.length || 0} services included
          </div>
          {pkg.gender_tag && (
            <span className="inline-block text-xs px-2 py-1 bg-background rounded border border-border mt-2">
              {pkg.gender_tag}
            </span>
          )}
        </div>
        <div className="text-right ml-4">
          <div className="text-xl font-bold text-gold">₹{pkg.total_price}</div>
          <div className="text-xs text-green-500">Package Deal</div>
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-16 h-16 text-gold animate-spin mx-auto mb-4" />
          <p className="text-foreground">Loading services...</p>
        </div>
      </div>
    );
  }

  const filteredServices = filterServices(allServices);
  const groupedServices = groupServicesByCategory(filteredServices);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/book/${salonId}${branchId ? `?branch=${branchId}` : ''}`)}
              className="bg-gold text-black hover:bg-gold/90"
            >
              Book Now
            </Button>
          </div>

          <div className="text-center mb-4">
            <h1 className="text-2xl font-playfair font-bold text-foreground">Services & Packages</h1>
            {salon && <p className="text-sm text-muted-foreground">{salon.salon_name}</p>}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="services" className="flex items-center gap-1">
              <Scissors className="w-4 h-4" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
            <TabsTrigger value="packages" className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Packages</span>
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-1">
              <Star className="w-4 h-4" />
              <span className="hidden sm:inline">Favorites</span>
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Recent</span>
            </TabsTrigger>
          </TabsList>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-6">
            {Object.keys(groupedServices).length === 0 ? (
              <div className="text-center py-12">
                <Scissors className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No services found matching your search' : 'No services available'}
                </p>
              </div>
            ) : (
              Object.entries(groupedServices).map(([category, services]) => (
                <div key={category}>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center">
                    <Tag className="w-5 h-5 mr-2 text-gold" />
                    {category}
                  </h2>
                  <div className="space-y-3">
                    {services.map(service => (
                      <ServiceCard key={service.id} service={service} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Packages Tab */}
          <TabsContent value="packages" className="space-y-3">
            {packages.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">No packages available</p>
              </div>
            ) : (
              packages.map(pkg => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))
            )}
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="space-y-3">
            {favoriteServices.length === 0 ? (
              <div className="text-center py-12">
                <Star className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">No favorite services marked by salon</p>
              </div>
            ) : (
              favoriteServices.map(service => (
                <ServiceCard key={service.id} service={service} />
              ))
            )}
          </TabsContent>

          {/* Recent Tab */}
          <TabsContent value="recent" className="space-y-3">
            {recentServices.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">
                  No recent services found. Book your first service to see it here!
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Based on your last 5 bookings
                </p>
                {recentServices.map(service => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
