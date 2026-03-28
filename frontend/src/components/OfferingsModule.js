import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Search, Plus, Star, Package, Sparkles, 
  ChevronDown, ChevronRight, Edit, Trash2,
  Image as ImageIcon, Heart
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Service categories from the menu
const SERVICE_CATEGORIES = [
  "Clean Up",
  "Facial",
  "Advance Facial",
  "Menicure",
  "Pedicure",
  "Hair Cut",
  "Hair Styling",
  "Makeup",
  "Hair Treatment",
  "Hair Spa",
  "Hair Colour",
  "Normal Waxing",
  "Rica Waxing",
  "Body Care",
  "Massage",
  "Bleach",
  "Face Treatments",
  "Shampoo",
  "Threading"
];

export default function OfferingsModule({ salonId, token }) {
  const [activeTab, setActiveTab] = useState('services');
  const [services, setServices] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [packages, setPackages] = useState([]);
  const [categorizedServices, setCategorizedServices] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddPackage, setShowAddPackage] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [servicesRes, favoritesRes, packagesRes] = await Promise.all([
        axios.get(`${API}/services`),
        axios.get(`${API}/services/favorites`),
        axios.get(`${API}/packages`)
      ]);

      setServices(servicesRes.data);
      setFavorites(favoritesRes.data);
      setPackages(packagesRes.data);

      // Categorize services
      const categorized = {};
      servicesRes.data.forEach(service => {
        const category = service.category || 'General';
        if (!categorized[category]) {
          categorized[category] = [];
        }
        categorized[category].push(service);
      });
      setCategorizedServices(categorized);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load offerings');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleFavorite = async (serviceId, currentStatus) => {
    try {
      await axios.put(
        `${API}/services/${serviceId}/favorite?is_favorite=${!currentStatus}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(currentStatus ? 'Removed from favorites' : 'Added to favorites');
      fetchAllData();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const deleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    
    try {
      await axios.delete(`${API}/services/${serviceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Service deleted successfully');
      fetchAllData();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Failed to delete service');
    }
  };

  const filteredServices = Object.entries(categorizedServices).reduce((acc, [category, servicesList]) => {
    const filtered = servicesList.filter(service => {
      const matchesSearch = service.service_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGender = genderFilter === 'all' || 
                           service.gender_tag === genderFilter || 
                           service.gender_tag === 'Unisex';
      return matchesSearch && matchesGender;
    });
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Offerings</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="favorites" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Favorites ({favorites.length})
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Services ({services.length})
          </TabsTrigger>
          <TabsTrigger value="packages" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Packages ({packages.length})
          </TabsTrigger>
        </TabsList>

        {/* FAVORITES TAB */}
        <TabsContent value="favorites" className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Quick Access Favorites</h3>
              <p className="text-sm text-muted-foreground">Drag to reorder</p>
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No favorites yet</p>
                <p className="text-sm">Mark services as favorites to see them here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {favorites.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onToggleFavorite={toggleFavorite}
                    onDelete={deleteService}
                    token={token}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* SERVICES TAB */}
        <TabsContent value="services" className="space-y-4">
          {/* Filters and Search */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-md text-foreground"
                >
                  <option value="all">All Genders</option>
                  <option value="Men">Men Only</option>
                  <option value="Women">Women Only</option>
                  <option value="Unisex">Unisex</option>
                </select>
              </div>
            </div>

            <Button onClick={() => setShowAddService(true)} className="mt-4 w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add New Service
            </Button>
          </div>

          {/* Categorized Services */}
          <div className="space-y-3">
            {Object.entries(filteredServices).map(([category, servicesList]) => (
              <div key={category} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-6 py-4 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedCategories[category] ? (
                      <ChevronDown className="w-5 h-5 text-gold" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                    <h3 className="text-lg font-semibold text-foreground">{category}</h3>
                    <span className="text-sm text-muted-foreground">
                      ({servicesList.length})
                    </span>
                  </div>
                </button>

                {expandedCategories[category] && (
                  <div className="p-4 space-y-2">
                    {servicesList.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        onToggleFavorite={toggleFavorite}
                        onDelete={deleteService}
                        token={token}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {Object.keys(filteredServices).length === 0 && (
              <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-lg">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No services found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* PACKAGES TAB */}
        <TabsContent value="packages" className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <Button onClick={() => setShowAddPackage(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Create New Package
            </Button>
          </div>

          {packages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-lg">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No packages created yet</p>
              <p className="text-sm">Create combo packages to offer deals</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} package={pkg} token={token} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Service Card Component
function ServiceCard({ service, onToggleFavorite, onDelete, token }) {
  const getGenderBadge = (gender) => {
    const colors = {
      Men: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      Women: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      Unisex: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return colors[gender] || colors.Unisex;
  };

  return (
    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-lg hover:border-gold/50 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        {service.images && service.images.length > 0 ? (
          <img
            src={service.images[0]}
            alt={service.service_name}
            className="w-12 h-12 rounded-lg object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-foreground">{service.service_name}</h4>
            <span className={`px-2 py-0.5 text-xs border rounded ${getGenderBadge(service.gender_tag)}`}>
              {service.gender_tag}
            </span>
          </div>
          {service.description && (
            <p className="text-sm text-muted-foreground">{service.description}</p>
          )}
        </div>

        <div className="text-right">
          <p className="text-lg font-bold text-gold">
            ₹{service.base_price}
            {service.price_type === 'onwards' && <span className="text-sm font-normal"> onwards</span>}
          </p>
          <p className="text-xs text-muted-foreground">{service.default_duration} min</p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={() => onToggleFavorite(service.id, service.is_favorite)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          {service.is_favorite ? (
            <Heart className="w-5 h-5 text-gold fill-gold" />
          ) : (
            <Heart className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
        <button className="p-2 hover:bg-muted rounded-lg transition-colors">
          <Edit className="w-5 h-5 text-muted-foreground" />
        </button>
        <button
          onClick={() => onDelete(service.id)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <Trash2 className="w-5 h-5 text-red-500" />
        </button>
      </div>
    </div>
  );
}

// Package Card Component
function PackageCard({ package: pkg, token }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-gold/50 transition-colors">
      {pkg.image_url && (
        <img
          src={pkg.image_url}
          alt={pkg.package_name}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold text-foreground">{pkg.package_name}</h3>
          <span className="px-3 py-1 bg-gold/20 text-gold rounded-full text-sm font-semibold">
            ₹{pkg.total_price}
          </span>
        </div>

        {pkg.description && (
          <p className="text-sm text-muted-foreground mb-4">{pkg.description}</p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Includes:</p>
          <p className="text-sm text-muted-foreground">{pkg.service_ids.length} services</p>
        </div>

        <div className="mt-4 pt-4 border-t border-border flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="text-red-500 border-red-500/50 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
