import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Scissors, Plus, Edit2, Trash2, Save, X, Clock, IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ServiceManagement({ getAuthHeaders }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  
  const [newService, setNewService] = useState({
    service_name: '',
    description: '',
    default_duration: 30,
    base_price: 0
  });

  const [editData, setEditData] = useState(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/services`);
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    
    if (!newService.service_name) {
      toast.error('Please enter service name');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/services`,
        {
          ...newService,
          default_duration: parseInt(newService.default_duration) || 30,
          base_price: parseFloat(newService.base_price) || 0
        },
        { headers: getAuthHeaders() }
      );
      
      setServices([...services, response.data]);
      setNewService({ service_name: '', description: '', default_duration: 30, base_price: 0 });
      setShowAddForm(false);
      toast.success('Service added successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add service');
    }
  };

  const handleEditService = (service) => {
    setEditingService(service.id);
    setEditData({ ...service });
  };

  const handleUpdateService = async () => {
    if (!editData.service_name) {
      toast.error('Service name is required');
      return;
    }

    try {
      const response = await axios.put(
        `${API}/services/${editingService}`,
        {
          service_name: editData.service_name,
          description: editData.description,
          default_duration: parseInt(editData.default_duration) || 30,
          base_price: parseFloat(editData.base_price) || 0
        },
        { headers: getAuthHeaders() }
      );
      
      setServices(services.map(s => s.id === editingService ? response.data : s));
      setEditingService(null);
      setEditData(null);
      toast.success('Service updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update service');
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service? This will also remove it from all barbers.')) return;
    
    try {
      await axios.delete(`${API}/services/${serviceId}`, { headers: getAuthHeaders() });
      setServices(services.filter(s => s.id !== serviceId));
      toast.success('Service deleted successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete service');
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
          <Scissors className="w-5 h-5 mr-2 text-gold" />
          Service Management
        </h2>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-gold text-black hover:bg-gold/90"
          data-testid="add-service-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      {/* Add New Service Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddService}
            className="bg-card border border-border rounded-lg p-6 space-y-4"
          >
            <h3 className="font-bold text-card-foreground">Add New Service</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="service_name">Service Name *</Label>
                <Input
                  id="service_name"
                  data-testid="service-name-input"
                  value={newService.service_name}
                  onChange={(e) => setNewService({ ...newService, service_name: e.target.value })}
                  placeholder="e.g., Haircut, Facial, Hair Spa"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  data-testid="service-description-input"
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  placeholder="Brief description of the service"
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  data-testid="service-duration-input"
                  value={newService.default_duration}
                  onChange={(e) => setNewService({ ...newService, default_duration: e.target.value })}
                  placeholder="30"
                  min="5"
                />
              </div>
              <div>
                <Label htmlFor="price">Base Price (Rs.)</Label>
                <Input
                  id="price"
                  type="number"
                  data-testid="service-price-input"
                  value={newService.base_price}
                  onChange={(e) => setNewService({ ...newService, base_price: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gold text-black hover:bg-gold/90" data-testid="save-service-btn">
                <Save className="w-4 h-4 mr-2" />
                Save Service
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Services List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <motion.div
            key={service.id}
            layout
            className="bg-card border border-border rounded-lg p-4"
          >
            {editingService === service.id ? (
              // Edit Mode
              <div className="space-y-3">
                <Input
                  value={editData.service_name}
                  onChange={(e) => setEditData({ ...editData, service_name: e.target.value })}
                  placeholder="Service name"
                  className="font-bold"
                />
                <Input
                  value={editData.description || ''}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Description"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Duration (min)</Label>
                    <Input
                      type="number"
                      value={editData.default_duration}
                      onChange={(e) => setEditData({ ...editData, default_duration: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Price (Rs.)</Label>
                    <Input
                      type="number"
                      value={editData.base_price}
                      onChange={(e) => setEditData({ ...editData, base_price: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => { setEditingService(null); setEditData(null); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-gold text-black hover:bg-gold/90"
                    onClick={handleUpdateService}
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-card-foreground">{service.service_name}</h3>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleEditService(service)}
                      data-testid={`edit-service-${service.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDeleteService(service.id)}
                      data-testid={`delete-service-${service.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Clock className="w-4 h-4 mr-1" />
                    {service.default_duration} min
                  </div>
                  <div className="flex items-center font-bold text-gold">
                    <IndianRupee className="w-4 h-4 mr-1" />
                    {service.base_price}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ))}

        {services.length === 0 && (
          <div className="col-span-full text-center py-12 bg-card border border-border rounded-lg">
            <Scissors className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No services added yet</p>
            <p className="text-sm text-muted-foreground mt-2">Click "Add Service" to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
