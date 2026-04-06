import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Scissors, Clock, Search, Check, Calendar, ShoppingCart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonServicesTab({ salonId }) {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedServices, setSelectedServices] = useState([]);

  useEffect(() => {
    fetchServices();
  }, [salonId]);

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
    const serviceIds = selectedServices.join(',');
    navigate(`/book/${salonId}?services=${serviceIds}`);
  };

  // Get unique categories
  const categories = ['all', ...new Set(services.map(s => s.category || 'General'))];

  // Filter services
  const filteredServices = services.filter(service => {
    const matchesSearch = service.service_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || (service.category || 'General') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedServices = filteredServices.reduce((acc, service) => {
    const category = service.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-playfair font-bold text-foreground">Our Services</h2>
          <p className="text-muted-foreground">Select services to book an appointment</p>
        </div>
        
        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedCategory === category
                ? 'bg-gold text-black'
                : 'bg-card border border-border text-foreground hover:border-gold'
            }`}
          >
            {category === 'all' ? 'All Services' : category}
          </button>
        ))}
      </div>

      {/* Services List */}
      {Object.keys(groupedServices).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedServices).map(([category, categoryServices]) => (
            <div key={category}>
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center">
                <Scissors className="w-5 h-5 mr-2 text-gold" />
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryServices.map((service) => {
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <motion.div
                      key={service.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => toggleService(service.id)}
                      className={`relative bg-card rounded-xl p-4 border-2 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-gold bg-gold/5 shadow-md' 
                          : 'border-border hover:border-gold/50'
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-3 right-3 w-6 h-6 bg-gold rounded-full flex items-center justify-center"
                        >
                          <Check className="w-4 h-4 text-black" />
                        </motion.div>
                      )}
                      
                      <div className="flex justify-between items-start mb-2 pr-8">
                        <h4 className="font-bold text-foreground">{service.service_name}</h4>
                        <span className="text-gold font-bold">₹{service.base_price}</span>
                      </div>
                      {service.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{service.description}</p>
                      )}
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {service.default_duration || 30} mins
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Scissors className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchQuery ? 'No services match your search' : 'No services available'}
          </p>
        </div>
      )}

      {/* Sticky Book Now Bar */}
      <AnimatePresence>
        {selectedServices.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-30"
          >
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold/10 rounded-full">
                  <ShoppingCart className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{selectedServices.length} service(s) selected</p>
                  <p className="text-sm text-muted-foreground">Total: <span className="text-gold font-bold">₹{getTotalAmount()}</span></p>
                </div>
              </div>
              <Button 
                onClick={handleBookNow}
                className="bg-gold text-black hover:bg-gold/90 px-6"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Book Now
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
