import { useState, useEffect } from 'react';
import React from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  User, Plus, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Services by Category View Component

export default function BarberManagement({ salonId, getAuthHeaders }) {
  const navigate = useNavigate();
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [newBarber, setNewBarber] = useState({
    name: '',
    experience: '',
    category: 'Junior',
    specialization: 'Haircut Specialist',
    customCategory: '',
    customSpecialization: '',
    mobile: '',
    profile_image: '',
    on_leave: false,
    is_barber: true,
    // New employee fields
    department: '',
    designation: '',
    emergency_contact: '',
    aadhar_number: '',
    doj: '',
    dob: '',
    compensation: '',
    documents: []
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
          on_leave: newBarber.on_leave || false,
          is_barber: newBarber.is_barber,
          // New employee fields
          department: newBarber.department || null,
          designation: newBarber.designation || null,
          emergency_contact: newBarber.emergency_contact || null,
          aadhar_number: newBarber.aadhar_number || null,
          doj: newBarber.doj || null,
          dob: newBarber.dob || null,
          compensation: parseFloat(newBarber.compensation) || null,
          documents: newBarber.documents || []
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
        on_leave: false,
        is_barber: true,
        department: '',
        designation: '',
        emergency_contact: '',
        aadhar_number: '',
        doj: '',
        dob: '',
        compensation: '',
        documents: []
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
          Staff Management
        </h2>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-gold text-black hover:bg-gold/90"
          data-testid="add-barber-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Add New Staff Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddBarber}
            className="bg-card border border-border rounded-lg p-6 space-y-4"
          >
            <h3 className="font-bold text-card-foreground">Add New Staff</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  data-testid="barber-name-input"
                  value={newBarber.name}
                  onChange={(e) => setNewBarber({ ...newBarber, name: e.target.value })}
                  placeholder="Staff member name"
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
              <p className="text-xs text-muted-foreground mt-1">Enter a URL for the staff's profile photo</p>
            </div>

            {/* New Employee Fields */}
            <div className="border-t border-border pt-4">
              <h4 className="font-semibold mb-3 text-foreground">Employee Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={newBarber.department}
                    onChange={(e) => setNewBarber({ ...newBarber, department: e.target.value })}
                    placeholder="e.g., Hairstyling, Spa, Reception"
                  />
                </div>
                <div>
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    value={newBarber.designation}
                    onChange={(e) => setNewBarber({ ...newBarber, designation: e.target.value })}
                    placeholder="e.g., Senior Stylist, Receptionist"
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_contact">Emergency Contact Number</Label>
                  <Input
                    id="emergency_contact"
                    value={newBarber.emergency_contact}
                    onChange={(e) => setNewBarber({ ...newBarber, emergency_contact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="10-digit mobile"
                  />
                </div>
                <div>
                  <Label htmlFor="aadhar_number">Aadhar Number</Label>
                  <Input
                    id="aadhar_number"
                    value={newBarber.aadhar_number}
                    onChange={(e) => setNewBarber({ ...newBarber, aadhar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                    placeholder="12-digit Aadhar"
                  />
                </div>
                <div>
                  <Label htmlFor="doj">Date of Joining</Label>
                  <Input
                    id="doj"
                    type="date"
                    value={newBarber.doj}
                    onChange={(e) => setNewBarber({ ...newBarber, doj: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={newBarber.dob}
                    onChange={(e) => setNewBarber({ ...newBarber, dob: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="compensation">Compensation (Monthly)</Label>
                  <div className="flex items-center">
                    <span className="text-sm mr-2">₹</span>
                    <Input
                      id="compensation"
                      type="number"
                      value={newBarber.compensation}
                      onChange={(e) => setNewBarber({ ...newBarber, compensation: e.target.value })}
                      placeholder="Enter monthly salary"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Visibility Checkbox */}
            <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg">
              <Checkbox
                id="is_barber"
                checked={newBarber.is_barber}
                onCheckedChange={(checked) => setNewBarber({ ...newBarber, is_barber: checked })}
                className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
              />
              <Label htmlFor="is_barber" className="cursor-pointer">
                <span className="font-semibold">Mark as Barber</span>
                <p className="text-xs text-muted-foreground">Only staff marked as barbers will be visible to customers for booking</p>
              </Label>
            </div>

            {/* On Leave Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="on_leave"
                checked={newBarber.on_leave}
                onCheckedChange={(checked) => setNewBarber({ ...newBarber, on_leave: checked })}
              />
              <Label htmlFor="on_leave" className="cursor-pointer">
                Staff is on leave (won't be shown to customers for booking)
              </Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gold text-black hover:bg-gold/90" data-testid="save-barber-btn">
                <Save className="w-4 h-4 mr-2" />
                Save Staff
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Staff List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {barbers.map((barber) => (
          <motion.div
            key={barber.id}
            whileHover={{ scale: 1.02 }}
            className="bg-card border border-border rounded-lg p-4 hover:border-gold transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{barber.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {barber.designation || barber.category}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {barber.experience} years experience
                </p>
              </div>
              {barber.on_leave && (
                <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">
                  On Leave
                </span>
              )}
            </div>

            <div className="space-y-2 mb-4">
              {barber.mobile && (
                <p className="text-xs text-muted-foreground">
                  📱 {barber.mobile}
                </p>
              )}
              {barber.department && (
                <p className="text-xs text-muted-foreground">
                  🏢 {barber.department}
                </p>
              )}
              <div className="flex items-center gap-2">
                {barber.is_barber ? (
                  <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded">
                    Visible to Customers
                  </span>
                ) : (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">
                    Staff Only
                  </span>
                )}
              </div>
            </div>

            <Button 
              onClick={() => navigate(`/salon/staff/${barber.id}`)}
              className="w-full bg-gold text-black hover:bg-gold/90"
            >
              View Profile
            </Button>
          </motion.div>
        ))}

        {barbers.length === 0 && (
          <div className="col-span-full text-center py-12 bg-card border border-border rounded-lg">
            <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No staff members added yet</p>
            <p className="text-sm text-muted-foreground mt-2">Click "Add Staff" to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
