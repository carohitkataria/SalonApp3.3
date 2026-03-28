import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Search, Plus, Star, Package, Sparkles, 
  ChevronDown, ChevronRight, Edit, Trash2,
  Image as ImageIcon, Heart, Home, Save, X, GripVertical
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
  
  // Modal states
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);

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

  const toggleServiceEnabled = async (serviceId, currentStatus) => {
    try {
      await axios.put(
        `${API}/services/${serviceId}`,
        { is_enabled: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(currentStatus ? 'Service disabled' : 'Service enabled');
      fetchAllData();
    } catch (error) {
      console.error('Error toggling service:', error);
      toast.error('Failed to update service');
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

  const deletePackage = async (packageId) => {
    if (!window.confirm('Are you sure you want to delete this package?')) return;
    
    try {
      await axios.delete(`${API}/packages/${packageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Package deleted successfully');
      fetchAllData();
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error('Failed to delete package');
    }
  };

  const handleEditService = (service) => {
    setEditingService(service);
    setShowServiceModal(true);
  };

  const handleEditPackage = (pkg) => {
    setEditingPackage(pkg);
    setShowPackageModal(true);
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(favorites);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setFavorites(items);

    try {
      const serviceIds = items.map(item => item.id);
      await axios.put(
        `${API}/services/favorites/reorder`,
        serviceIds,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Favorites reordered');
    } catch (error) {
      console.error('Error reordering favorites:', error);
      toast.error('Failed to reorder favorites');
      fetchAllData();
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
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="favorites">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {favorites.map((service, index) => (
                        <Draggable key={service.id} draggableId={service.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="bg-background border border-border rounded-lg p-4 hover:border-gold/50 transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                                </div>
                                <ServiceCardContent 
                                  service={service} 
                                  onToggleFavorite={toggleFavorite}
                                  onToggleEnabled={toggleServiceEnabled}
                                  onEdit={handleEditService}
                                  onDelete={deleteService}
                                />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </TabsContent>

        {/* SERVICES TAB */}
        <TabsContent value="services" className="space-y-4">
          {/* Filters and Search */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="px-4 py-2 bg-background border border-border rounded-md text-foreground"
              >
                <option value="all">All Genders</option>
                <option value="Men">Men Only</option>
                <option value="Women">Women Only</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>

            <Button onClick={() => { setEditingService(null); setShowServiceModal(true); }} className="mt-4 w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add New Service
            </Button>
          </div>

          {/* Categorized Services */}
          <div className="space-y-3">
            {Object.entries(filteredServices).sort().map(([category, servicesList]) => (
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
                      <div key={service.id} className="bg-background border border-border rounded-lg p-4 hover:border-gold/50 transition-colors">
                        <ServiceCardContent 
                          service={service} 
                          onToggleFavorite={toggleFavorite}
                          onToggleEnabled={toggleServiceEnabled}
                          onEdit={handleEditService}
                          onDelete={deleteService}
                        />
                      </div>
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
            <Button onClick={() => { setEditingPackage(null); setShowPackageModal(true); }} className="w-full">
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
                <PackageCard 
                  key={pkg.id} 
                  package={pkg} 
                  onEdit={handleEditPackage}
                  onDelete={deletePackage}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Service Modal */}
      {showServiceModal && (
        <ServiceModal
          service={editingService}
          open={showServiceModal}
          onClose={() => { setShowServiceModal(false); setEditingService(null); }}
          onSave={fetchAllData}
          token={token}
        />
      )}

      {/* Package Modal */}
      {showPackageModal && (
        <PackageModal
          package={editingPackage}
          services={services}
          open={showPackageModal}
          onClose={() => { setShowPackageModal(false); setEditingPackage(null); }}
          onSave={fetchAllData}
          token={token}
        />
      )}
    </div>
  );
}

// Service Card Content Component
function ServiceCardContent({ service, onToggleFavorite, onToggleEnabled, onEdit, onDelete }) {
  const getGenderBadge = (gender) => {
    const colors = {
      Men: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      Women: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      Unisex: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return colors[gender] || colors.Unisex;
  };

  return (
    <div className="flex items-center justify-between w-full">
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
            {service.available_at_home && (
              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded flex items-center gap-1">
                <Home className="w-3 h-3" />
                Home
              </span>
            )}
            {!service.is_enabled && (
              <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded">
                Disabled
              </span>
            )}
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
        <Checkbox
          checked={service.is_enabled}
          onCheckedChange={() => onToggleEnabled(service.id, service.is_enabled)}
          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
        />
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
        <button 
          onClick={() => onEdit(service)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
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
function PackageCard({ package: pkg, onEdit, onDelete }) {
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
          <p className="text-sm text-muted-foreground">{pkg.service_ids?.length || 0} services</p>
        </div>

        <div className="mt-4 pt-4 border-t border-border flex gap-2">
          <Button 
            onClick={() => onEdit(pkg)}
            variant="outline" 
            size="sm" 
            className="flex-1"
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button 
            onClick={() => onDelete(pkg.id)}
            variant="outline" 
            size="sm" 
            className="text-red-500 border-red-500/50 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// Service Modal Component
function ServiceModal({ service, open, onClose, onSave, token }) {
  const [formData, setFormData] = useState({
    service_name: '',
    description: '',
    category: 'General',
    gender_tag: 'Unisex',
    default_duration: 30,
    base_price: 0,
    price_type: 'fixed',
    images: [],
    available_at_home: false,
    is_enabled: true
  });

  useEffect(() => {
    if (service) {
      setFormData(service);
    } else {
      setFormData({
        service_name: '',
        description: '',
        category: 'General',
        gender_tag: 'Unisex',
        default_duration: 30,
        base_price: 0,
        price_type: 'fixed',
        images: [],
        available_at_home: false,
        is_enabled: true
      });
    }
  }, [service]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (service) {
        // Update
        await axios.put(
          `${API}/services/${service.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Service updated successfully');
      } else {
        // Create
        await axios.post(
          `${API}/services`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Service created successfully');
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Failed to save service');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? 'Edit Service' : 'Add New Service'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Service Name *</Label>
              <Input
                value={formData.service_name}
                onChange={(e) => setFormData({...formData, service_name: e.target.value})}
                required
              />
            </div>

            <div>
              <Label>Category *</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                required
              />
            </div>

            <div>
              <Label>Gender *</Label>
              <select
                value={formData.gender_tag}
                onChange={(e) => setFormData({...formData, gender_tag: e.target.value})}
                className="w-full p-2 bg-background border border-border rounded-md"
              >
                <option value="Unisex">Unisex</option>
                <option value="Men">Men</option>
                <option value="Women">Women</option>
              </select>
            </div>

            <div>
              <Label>Duration (minutes) *</Label>
              <Input
                type="number"
                value={formData.default_duration}
                onChange={(e) => setFormData({...formData, default_duration: parseInt(e.target.value)})}
                required
              />
            </div>

            <div>
              <Label>Base Price (₹) *</Label>
              <Input
                type="number"
                value={formData.base_price}
                onChange={(e) => setFormData({...formData, base_price: parseFloat(e.target.value)})}
                required
              />
            </div>

            <div>
              <Label>Price Type *</Label>
              <select
                value={formData.price_type}
                onChange={(e) => setFormData({...formData, price_type: e.target.value})}
                className="w-full p-2 bg-background border border-border rounded-md"
              >
                <option value="fixed">Fixed</option>
                <option value="onwards">Onwards</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full p-2 bg-background border border-border rounded-md min-h-[80px]"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formData.available_at_home}
                onCheckedChange={(checked) => setFormData({...formData, available_at_home: checked})}
              />
              <Home className="w-4 h-4" />
              <span className="text-sm">Available at Home</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formData.is_enabled}
                onCheckedChange={(checked) => setFormData({...formData, is_enabled: checked})}
              />
              <span className="text-sm">Service Enabled</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit">
              <Save className="w-4 h-4 mr-2" />
              {service ? 'Update' : 'Create'} Service
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Package Modal Component
function PackageModal({ package: pkg, services, open, onClose, onSave, token }) {
  const [formData, setFormData] = useState({
    package_name: '',
    description: '',
    service_ids: [],
    total_price: 0,
    image_url: '',
    gender_tag: 'Unisex'
  });

  useEffect(() => {
    if (pkg) {
      setFormData(pkg);
    } else {
      setFormData({
        package_name: '',
        description: '',
        service_ids: [],
        total_price: 0,
        image_url: '',
        gender_tag: 'Unisex'
      });
    }
  }, [pkg]);

  const toggleService = (serviceId) => {
    setFormData(prev => ({
      ...prev,
      service_ids: prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter(id => id !== serviceId)
        : [...prev.service_ids, serviceId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (pkg) {
        await axios.put(
          `${API}/packages/${pkg.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Package updated successfully');
      } else {
        await axios.post(
          `${API}/packages`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Package created successfully');
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Failed to save package');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pkg ? 'Edit Package' : 'Create New Package'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Package Name *</Label>
              <Input
                value={formData.package_name}
                onChange={(e) => setFormData({...formData, package_name: e.target.value})}
                required
              />
            </div>

            <div>
              <Label>Total Price (₹) *</Label>
              <Input
                type="number"
                value={formData.total_price}
                onChange={(e) => setFormData({...formData, total_price: parseFloat(e.target.value)})}
                required
              />
            </div>

            <div>
              <Label>Gender Tag</Label>
              <select
                value={formData.gender_tag}
                onChange={(e) => setFormData({...formData, gender_tag: e.target.value})}
                className="w-full p-2 bg-background border border-border rounded-md"
              >
                <option value="Unisex">Unisex</option>
                <option value="Men">Men</option>
                <option value="Women">Women</option>
              </select>
            </div>

            <div>
              <Label>Image URL (optional)</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full p-2 bg-background border border-border rounded-md min-h-[80px]"
              placeholder="Package description..."
            />
          </div>

          <div>
            <Label>Select Services ({formData.service_ids.length} selected)</Label>
            <div className="mt-2 max-h-60 overflow-y-auto border border-border rounded-md p-3 space-y-2">
              {services.map(service => (
                <label key={service.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                  <Checkbox
                    checked={formData.service_ids.includes(service.id)}
                    onCheckedChange={() => toggleService(service.id)}
                  />
                  <span className="text-sm">{service.service_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">₹{service.base_price}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={formData.service_ids.length === 0}>
              <Save className="w-4 h-4 mr-2" />
              {pkg ? 'Update' : 'Create'} Package
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}