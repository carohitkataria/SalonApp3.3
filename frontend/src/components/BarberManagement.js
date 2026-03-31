import { useState, useEffect } from 'react';
import React from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  User, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp,
  Scissors, IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Services by Category View Component
function ServicesByCategoryView({ services, onServiceToggle, onPriceChange }) {
  const [expandedCategories, setExpandedCategories] = useState({});

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const category = service.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {});

  // Expand all categories by default
  useEffect(() => {
    const initialExpanded = {};
    Object.keys(servicesByCategory).forEach(cat => {
      initialExpanded[cat] = true;
    });
    setExpandedCategories(initialExpanded);
  }, []);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSelectAll = (category, checked) => {
    const categoryServices = servicesByCategory[category];
    categoryServices.forEach(service => {
      onServiceToggle(service.id, checked);
    });
  };

  const isAllSelected = (category) => {
    const categoryServices = servicesByCategory[category];
    if (categoryServices.length === 0) return false;
    return categoryServices.every(s => s.is_available);
  };

  return (
    <div className="space-y-2">
      {Object.keys(servicesByCategory).sort().map(category => (
        <div key={category} className="border border-border rounded-lg">
          {/* Category Header */}
          <div 
            className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
            onClick={() => toggleCategory(category)}
          >
            <div className="flex items-center space-x-3">
              <button className="text-gold">
                {expandedCategories[category] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <h5 className="font-bold text-foreground">{category}</h5>
              <span className="text-xs text-muted-foreground">
                ({servicesByCategory[category].filter(s => s.is_available).length}/{servicesByCategory[category].length} selected)
              </span>
            </div>
            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isAllSelected(category)}
                onCheckedChange={(checked) => handleSelectAll(category, checked)}
                className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
              />
              <span className="text-xs text-muted-foreground">Select All</span>
            </div>
          </div>

          {/* Category Services */}
          {expandedCategories[category] && (
            <div className="p-2 space-y-2">
              {servicesByCategory[category].map(service => (
                <div 
                  key={service.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    service.is_available 
                      ? 'bg-gold/5 border-gold/30' 
                      : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <Checkbox
                      id={`service-${service.id}`}
                      checked={service.is_available}
                      onCheckedChange={(checked) => onServiceToggle(service.id, checked)}
                      data-testid={`service-checkbox-${service.id}`}
                      className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                    />
                    <div className="flex-1">
                      <label 
                        htmlFor={`service-${service.id}`}
                        className={`font-medium cursor-pointer ${
                          service.is_available ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {service.service_name}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Base: ₹{service.base_price}
                        {service.price_type === 'onwards' && <span className="ml-1 text-gold">onwards</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <IndianRupee className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={service.barber_price}
                      onChange={(e) => onPriceChange(service.id, e.target.value)}
                      className="w-24 text-right"
                      disabled={!service.is_available}
                      data-testid={`service-price-${service.id}`}
                      placeholder="Price"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Category options
const CATEGORY_OPTIONS = [
  { value: 'Junior', label: 'Junior' },
  { value: 'Stylist', label: 'Stylist' },
  { value: 'Senior', label: 'Senior' },
  { value: 'Master', label: 'Master' },
  { value: 'custom', label: 'Custom' }
];

// Specialization options
const SPECIALIZATION_OPTIONS = [
  { value: 'Haircut Specialist', label: 'Haircut Specialist' },
  { value: 'Beard Styling Expert', label: 'Beard Styling Expert' },
  { value: 'Fade Specialist', label: 'Fade Specialist' },
  { value: 'Kids Haircut Specialist', label: 'Kids Haircut Specialist' },
  { value: 'Bridal/Groom Styling', label: 'Bridal/Groom Styling' },
  { value: 'Hair Coloring Expert', label: 'Hair Coloring Expert' },
  { value: 'Keratin/Smoothening Specialist', label: 'Keratin/Smoothening Specialist' },
  { value: 'Quick Service (Fast barber)', label: 'Quick Service (Fast barber)' },
  { value: 'custom', label: 'Custom' }
];

export default function BarberManagement({ salonId, getAuthHeaders }) {
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBarber, setEditingBarber] = useState(null);
  const [expandedBarber, setExpandedBarber] = useState(null);
  
  const [newBarber, setNewBarber] = useState({
    name: '',
    experience: '',
    category: 'Junior',
    specialization: 'Haircut Specialist',
    customCategory: '',
    customSpecialization: '',
    mobile: '',
    profile_image: '',
    on_leave: false
  });

  useEffect(() => {
    if (salonId) {
      fetchBarbers();
      fetchServices();
    }
  }, [salonId]);

  const fetchBarbers = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/barbers`);
      setBarbers(response.data);
    } catch (error) {
      console.error('Error fetching barbers:', error);
      toast.error('Failed to load barbers');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/services`);
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleAddBarber = async (e) => {
    e.preventDefault();
    
    if (!newBarber.name || !newBarber.mobile) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      // Determine final category and specialization (use custom if selected)
      const finalCategory = newBarber.category === 'custom' ? newBarber.customCategory : newBarber.category;
      const finalSpecialization = newBarber.specialization === 'custom' ? newBarber.customSpecialization : newBarber.specialization;

      const response = await axios.post(
        `${API}/salons/${salonId}/barbers`,
        {
          name: newBarber.name,
          mobile: newBarber.mobile,
          salon_id: salonId,
          experience: parseInt(newBarber.experience) || 0,
          category: finalCategory,
          specialization: finalSpecialization,
          profile_image: newBarber.profile_image || null,
          on_leave: newBarber.on_leave || false
        },
        { headers: getAuthHeaders() }
      );
      
      setBarbers([...barbers, response.data]);
      setNewBarber({ 
        name: '', 
        experience: '', 
        category: 'Junior', 
        specialization: 'Haircut Specialist',
        customCategory: '',
        customSpecialization: '',
        mobile: '',
        profile_image: '',
        on_leave: false
      });
      setShowAddForm(false);
      toast.success('Barber added successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add barber');
    }
  };

  const handleUpdateBarber = async (barberId, updates) => {
    try {
      const response = await axios.put(
        `${API}/barbers/${barberId}`,
        updates,
        { headers: getAuthHeaders() }
      );
      
      setBarbers(barbers.map(b => b.id === barberId ? response.data : b));
      setEditingBarber(null);
      toast.success('Barber updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update barber');
    }
  };

  const handleDeleteBarber = async (barberId) => {
    if (!window.confirm('Are you sure you want to delete this barber?')) return;
    
    try {
      await axios.delete(`${API}/barbers/${barberId}`, { headers: getAuthHeaders() });
      setBarbers(barbers.filter(b => b.id !== barberId));
      toast.success('Barber deleted successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete barber');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center">
          <User className="w-5 h-5 mr-2 text-gold" />
          Barber Management
        </h2>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-gold text-black hover:bg-gold/90"
          data-testid="add-barber-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Barber
        </Button>
      </div>

      {/* Add New Barber Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddBarber}
            className="bg-card border border-border rounded-lg p-6 space-y-4"
          >
            <h3 className="font-bold text-card-foreground">Add New Barber</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  data-testid="barber-name-input"
                  value={newBarber.name}
                  onChange={(e) => setNewBarber({ ...newBarber, name: e.target.value })}
                  placeholder="Barber name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="mobile">Mobile *</Label>
                <Input
                  id="mobile"
                  data-testid="barber-mobile-input"
                  value={newBarber.mobile}
                  onChange={(e) => setNewBarber({ ...newBarber, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="10-digit mobile"
                  required
                />
              </div>
              <div>
                <Label htmlFor="experience">Experience (years)</Label>
                <Input
                  id="experience"
                  type="number"
                  data-testid="barber-experience-input"
                  value={newBarber.experience}
                  onChange={(e) => setNewBarber({ ...newBarber, experience: e.target.value })}
                  placeholder="Years of experience"
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="category">Category *</Label>
                <select
                  id="category"
                  data-testid="barber-category-select"
                  value={newBarber.category}
                  onChange={(e) => setNewBarber({ ...newBarber, category: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                  required
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {newBarber.category === 'custom' && (
                  <Input
                    className="mt-2"
                    placeholder="Enter custom category"
                    value={newBarber.customCategory}
                    onChange={(e) => setNewBarber({ ...newBarber, customCategory: e.target.value })}
                    required
                  />
                )}
              </div>
            </div>

            {/* Specialization Field */}
            <div>
              <Label htmlFor="specialization">Specialization</Label>
              <select
                id="specialization"
                value={newBarber.specialization}
                onChange={(e) => setNewBarber({ ...newBarber, specialization: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
              >
                {SPECIALIZATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {newBarber.specialization === 'custom' && (
                <Input
                  className="mt-2"
                  placeholder="Enter custom specialization"
                  value={newBarber.customSpecialization}
                  onChange={(e) => setNewBarber({ ...newBarber, customSpecialization: e.target.value })}
                />
              )}
            </div>

            {/* Profile Image URL */}
            <div>
              <Label htmlFor="profile_image">Profile Image URL (optional)</Label>
              <Input
                id="profile_image"
                value={newBarber.profile_image}
                onChange={(e) => setNewBarber({ ...newBarber, profile_image: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-xs text-muted-foreground mt-1">Enter a URL for the barber's profile photo</p>
            </div>

            {/* On Leave Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="on_leave"
                checked={newBarber.on_leave}
                onCheckedChange={(checked) => setNewBarber({ ...newBarber, on_leave: checked })}
              />
              <Label htmlFor="on_leave" className="cursor-pointer">
                Barber is on leave (won't be shown to customers for booking)
              </Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gold text-black hover:bg-gold/90" data-testid="save-barber-btn">
                <Save className="w-4 h-4 mr-2" />
                Save Barber
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Barbers List */}
      <div className="space-y-4">
        {barbers.map((barber) => (
          <BarberCard
            key={barber.id}
            barber={barber}
            services={services}
            isExpanded={expandedBarber === barber.id}
            isEditing={editingBarber === barber.id}
            onToggleExpand={() => setExpandedBarber(expandedBarber === barber.id ? null : barber.id)}
            onEdit={() => setEditingBarber(barber.id)}
            onCancelEdit={() => setEditingBarber(null)}
            onUpdate={(updates) => handleUpdateBarber(barber.id, updates)}
            onDelete={() => handleDeleteBarber(barber.id)}
            getAuthHeaders={getAuthHeaders}
          />
        ))}

        {barbers.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No barbers added yet</p>
            <p className="text-sm text-muted-foreground mt-2">Click "Add Barber" to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BarberCard({ 
  barber, 
  services, 
  isExpanded, 
  isEditing,
  onToggleExpand, 
  onEdit,
  onCancelEdit,
  onUpdate, 
  onDelete,
  getAuthHeaders 
}) {
  const [editData, setEditData] = useState({ ...barber });
  const [customCategory, setCustomCategory] = useState('');
  const [customSpecialization, setCustomSpecialization] = useState('');
  const [barberServices, setBarberServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [savingServices, setSavingServices] = useState(false);

  useEffect(() => {
    if (isExpanded && barber.id) {
      fetchBarberServices();
    }
  }, [isExpanded, barber.id]);

  const fetchBarberServices = async () => {
    setLoadingServices(true);
    try {
      const response = await axios.get(`${API}/barbers/${barber.id}/services`);
      setBarberServices(response.data);
    } catch (error) {
      console.error('Error fetching barber services:', error);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleServiceToggle = (serviceId, checked) => {
    setBarberServices(prevServices => 
      prevServices.map(s => 
        s.id === serviceId ? { ...s, is_available: checked } : s
      )
    );
  };

  const handlePriceChange = (serviceId, price) => {
    setBarberServices(barberServices.map(s => 
      s.id === serviceId ? { ...s, barber_price: parseFloat(price) || 0 } : s
    ));
  };

  const handleSaveServices = async () => {
    setSavingServices(true);
    try {
      const serviceAssignments = barberServices.map(s => ({
        service_id: s.id,
        price: s.barber_price,
        is_available: s.is_available
      }));

      await axios.put(
        `${API}/barbers/${barber.id}/services`,
        serviceAssignments,
        { headers: getAuthHeaders() }
      );
      
      toast.success('Services updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update services');
    } finally {
      setSavingServices(false);
    }
  };

  const getCategoryBadge = (category) => {
    const styles = {
      master: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      star: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      normal: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    };
    return styles[category] || styles.normal;
  };

  return (
    <motion.div 
      layout
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      {/* Barber Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center overflow-hidden">
            {barber.profile_image ? (
              <img 
                src={barber.profile_image} 
                alt={barber.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-gold" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-card-foreground flex items-center gap-2">
              {barber.name}
              {barber.on_leave && (
                <span className="text-xs bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded border border-orange-500/30">
                  On Leave
                </span>
              )}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>{barber.experience} years exp</span>
              <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${getCategoryBadge(barber.category)}`}>
                {barber.category}
              </span>
              {barber.specialization && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  {barber.specialization}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isExpanded && (
            <>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                data-testid={`edit-barber-${barber.id}`}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-red-500 hover:text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                data-testid={`delete-barber-${barber.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="p-4 space-y-6">
              {/* Edit Barber Details */}
              {isEditing ? (
                <div className="space-y-4">
                  <h4 className="font-bold text-card-foreground">Edit Barber Details</h4>
                  
                  {/* Barber Image Upload */}
                  <div>
                    <Label>Barber Photo</Label>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error('Image must be less than 2MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEditData({ ...editData, profile_image: reader.result });
                            toast.success('Image uploaded');
                          };
                          reader.onerror = () => toast.error('Failed to upload image');
                          reader.readAsDataURL(file);
                        }}
                      />
                      <Input
                        placeholder="Or enter image URL"
                        value={editData.profile_image || ''}
                        onChange={(e) => setEditData({ ...editData, profile_image: e.target.value })}
                      />
                      {editData.profile_image && (
                        <div className="relative inline-block">
                          <img 
                            src={editData.profile_image} 
                            alt="Barber" 
                            className="w-24 h-24 object-cover rounded-full border border-border"
                          />
                          <button
                            type="button"
                            onClick={() => setEditData({ ...editData, profile_image: '' })}
                            className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Mobile</Label>
                      <Input
                        value={editData.mobile}
                        onChange={(e) => setEditData({ ...editData, mobile: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Experience (years)</Label>
                      <Input
                        type="number"
                        value={editData.experience}
                        onChange={(e) => setEditData({ ...editData, experience: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <select
                        value={CATEGORY_OPTIONS.find(opt => opt.value === editData.category) ? editData.category : 'custom'}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setCustomCategory(editData.category);
                          }
                          setEditData({ ...editData, category: e.target.value });
                        }}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                      >
                        {CATEGORY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {(!CATEGORY_OPTIONS.find(opt => opt.value === editData.category) || editData.category === 'custom') && (
                        <Input
                          className="mt-2"
                          placeholder="Enter custom category"
                          value={editData.category === 'custom' ? customCategory : editData.category}
                          onChange={(e) => {
                            setCustomCategory(e.target.value);
                            setEditData({ ...editData, category: e.target.value });
                          }}
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Specialization Field */}
                  <div>
                    <Label>Specialization</Label>
                    <select
                      value={SPECIALIZATION_OPTIONS.find(opt => opt.value === editData.specialization) ? editData.specialization : 'custom'}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setCustomSpecialization(editData.specialization || '');
                        }
                        setEditData({ ...editData, specialization: e.target.value });
                      }}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                    >
                      {SPECIALIZATION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {(!SPECIALIZATION_OPTIONS.find(opt => opt.value === editData.specialization) || editData.specialization === 'custom') && (
                      <Input
                        className="mt-2"
                        placeholder="Enter custom specialization"
                        value={editData.specialization === 'custom' ? customSpecialization : (editData.specialization || '')}
                        onChange={(e) => {
                          setCustomSpecialization(e.target.value);
                          setEditData({ ...editData, specialization: e.target.value });
                        }}
                      />
                    )}
                  </div>

                  {/* On Leave Checkbox */}
                  <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                    <Checkbox
                      id="edit_on_leave"
                      checked={editData.on_leave || false}
                      onCheckedChange={(checked) => setEditData({ ...editData, on_leave: checked })}
                    />
                    <Label htmlFor="edit_on_leave" className="cursor-pointer">
                      Barber is on leave (won't be shown to customers for booking)
                    </Label>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={onCancelEdit}>Cancel</Button>
                    <Button 
                      className="bg-gold text-black hover:bg-gold/90"
                      onClick={() => {
                        const finalCategory = editData.category === 'custom' ? customCategory : editData.category;
                        const finalSpecialization = editData.specialization === 'custom' ? customSpecialization : editData.specialization;
                        onUpdate({
                          ...editData,
                          category: finalCategory,
                          specialization: finalSpecialization
                        });
                      }}
                    >
                      <Save className="w-4 h-4 mr-2" /> Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" onClick={onEdit}>
                    <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-red-500"
                    onClick={onDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Barber
                  </Button>
                </div>
              )}

              {/* Services Assignment */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-card-foreground flex items-center">
                    <Scissors className="w-4 h-4 mr-2 text-gold" />
                    Assign Services & Pricing
                  </h4>
                  <Button 
                    size="sm" 
                    className="bg-gold text-black hover:bg-gold/90"
                    onClick={handleSaveServices}
                    disabled={savingServices}
                    data-testid={`save-services-${barber.id}`}
                  >
                    {savingServices ? 'Saving...' : 'Save Services'}
                  </Button>
                </div>

                {loadingServices ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gold mx-auto"></div>
                  </div>
                ) : (
                  <ServicesByCategoryView 
                    services={barberServices}
                    onServiceToggle={handleServiceToggle}
                    onPriceChange={handlePriceChange}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
