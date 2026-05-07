import { useState, useEffect } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import GenderBadge from '@/components/GenderBadge';
import { 
  User, Plus, Save, ArrowRightLeft, Loader2, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useSubscription, parseSubscriptionError } from '@/contexts/SubscriptionContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Constants for categories and specializations
const CATEGORY_OPTIONS = [
  { value: 'Junior', label: 'Junior' },
  { value: 'Senior', label: 'Senior' },
  { value: 'Master', label: 'Master' },
  { value: 'Trainee', label: 'Trainee' },
  { value: 'custom', label: 'Custom' }
];

const SPECIALIZATION_OPTIONS = [
  { value: 'Haircut Specialist', label: 'Haircut Specialist' },
  { value: 'Color Expert', label: 'Color Expert' },
  { value: 'Beard Specialist', label: 'Beard Specialist' },
  { value: 'Spa Therapist', label: 'Spa Therapist' },
  { value: 'Makeup Artist', label: 'Makeup Artist' },
  { value: 'All-Rounder', label: 'All-Rounder' },
  { value: 'custom', label: 'Custom' }
];

export default function BarberManagement({ salonId, getAuthHeaders }) {
  const navigate = useNavigate();
  const { isAdmin, isBranchManager, getSalonUserHeaders } = useAuth();
  const { branches, refreshBranches } = useBranch();
  const { openPaywall, isPremium } = useSubscription();
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);

  // Helper: classify a barber as Active or Inactive
  // Inactive when: is_active=false OR last_working_date is set and < today
  const isInactive = (b) => {
    if (b.is_active === false) return true;
    const lwd = b.last_working_date;
    if (!lwd) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return lwd < todayStr;
  };
  const activeBarbers = barbers.filter((b) => !isInactive(b));
  const inactiveBarbers = barbers.filter(isInactive);

  // Staff transfer dialog state
  const [transferStaff, setTransferStaff] = useState(null);
  const [transferToBranch, setTransferToBranch] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    if (salonId) refreshBranches(salonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);

  const canTransferStaff = isAdmin() || isBranchManager();

  const openTransfer = (barber) => {
    setTransferStaff(barber);
    setTransferToBranch('');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferRemarks('');
  };

  const submitTransfer = async () => {
    if (!transferStaff || !transferToBranch) {
      toast.error('Please select a target branch');
      return;
    }
    setTransferLoading(true);
    try {
      await axios.post(
        `${API}/salons/${salonId}/staff-branch-transfers`,
        {
          staff_id: transferStaff.id,
          from_branch_id: transferStaff.branch_id || null,
          to_branch_id: transferToBranch,
          transfer_date: transferDate,
          remarks: transferRemarks || null,
        },
        { headers: getSalonUserHeaders() }
      );
      toast.success(`${transferStaff.name} transferred successfully`);
      setTransferStaff(null);
      fetchBarbers();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to transfer staff');
    } finally {
      setTransferLoading(false);
    }
  };
  
  const [newBarber, setNewBarber] = useState({
    name: '',
    experience: '',
    category: 'Junior',
    specialization: 'Haircut Specialist',
    gender_specialization: '',
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
          gender_specialization: newBarber.gender_specialization || null,
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
      const subErr = parseSubscriptionError(error);
      if (subErr) {
        setShowAddForm(false);
        openPaywall(subErr);
        return;
      }
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
          onClick={() => {
            // Pre-emptive paywall: free plan + already 1 active staff blocks add
            // (uses same active-classification as the list above)
            if (!isPremium && activeBarbers.length >= 1) {
              openPaywall({
                limit_type: 'max_staff',
                message: 'Free plan allows only 1 staff member. Upgrade to SalonHub Pro for unlimited staff.',
              });
              return;
            }
            setShowAddForm(!showAddForm);
          }}
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

            {/* Gender Specialization (for customer visibility) */}
            <div>
              <Label htmlFor="gender_specialization">Gender Specialization</Label>
              <select
                id="gender_specialization"
                value={newBarber.gender_specialization}
                onChange={(e) => setNewBarber({ ...newBarber, gender_specialization: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
              >
                <option value="">Not Set</option>
                <option value="Men">♂ Men</option>
                <option value="Women">♀ Women</option>
                <option value="Unisex">⚥ Unisex</option>
                <option value="Kids">👶 Kids</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Displayed as badge to customers during booking</p>
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

            {/* On-leave is managed from the Attendance tab (per-date), not on the staff form. */}

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

      {/* Staff List - split into Active / Inactive sections */}
      {(() => {
        const renderCard = (barber, inactive = false) => (
          <motion.div
            key={barber.id}
            whileHover={{ scale: inactive ? 1.0 : 1.02 }}
            onClick={() => navigate(`/salon/staff/${barber.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/salon/staff/${barber.id}`);
              }
            }}
            className={`bg-card border rounded-lg p-4 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold ${
              inactive
                ? 'border-border/40 opacity-70 hover:opacity-100 hover:border-border'
                : 'border-border hover:border-gold'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  {barber.name}
                  {barber.gender_specialization && (
                    <GenderBadge gender={barber.gender_specialization} size="xs" />
                  )}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {barber.designation || barber.category}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {barber.experience} years experience
                </p>
              </div>
              {inactive ? (
                <span className="text-xs bg-zinc-500/20 text-zinc-400 px-2 py-1 rounded font-medium">
                  Inactive
                </span>
              ) : barber.on_leave ? (
                <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">
                  On Leave
                </span>
              ) : null}
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
              {barber.branch_id && branches.length > 0 && (
                <p className="text-xs text-purple-500" data-testid={`barber-branch-${barber.id}`}>
                  📍 {branches.find(b => b.id === barber.branch_id)?.branch_name || 'Branch'}
                </p>
              )}
              {inactive && barber.last_working_date && (
                <p className="text-xs text-rose-400">
                  🚫 Last day: {new Date(barber.last_working_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
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

            <div className="flex gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/salon/staff/${barber.id}`);
                }}
                className={inactive ? 'flex-1' : 'flex-1 bg-gold text-black hover:bg-gold/90'}
                variant={inactive ? 'outline' : 'default'}
              >
                View Profile
              </Button>
              {!inactive && canTransferStaff && branches.length > 1 && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    openTransfer(barber);
                  }}
                  variant="outline"
                  size="sm"
                  data-testid={`transfer-staff-${barber.id}`}
                  title="Transfer to another branch"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </Button>
              )}
            </div>
          </motion.div>
        );

        return (
          <div className="space-y-6">
            {/* Active section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Active Staff
                  <span className="text-sm text-muted-foreground font-normal">
                    ({activeBarbers.length})
                  </span>
                </h3>
              </div>
              {activeBarbers.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                  <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No active staff members</p>
                  <p className="text-sm text-muted-foreground mt-2">Click "Add Staff" to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeBarbers.map((b) => renderCard(b, false))}
                </div>
              )}
            </div>

            {/* Inactive section (collapsible, default collapsed) */}
            {inactiveBarbers.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setInactiveExpanded((v) => !v)}
                  className="w-full flex items-center justify-between mb-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 border border-border rounded-lg transition-colors"
                  data-testid="toggle-inactive-staff"
                >
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                    Inactive Staff
                    <span className="text-sm text-muted-foreground font-normal">
                      ({inactiveBarbers.length})
                    </span>
                  </h3>
                  {inactiveExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {inactiveExpanded && (
                    <motion.div
                      key="inactive-list"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1 pb-1">
                        {inactiveBarbers.map((b) => renderCard(b, true))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        );
      })()}

      {/* Staff Transfer Dialog */}
      <Dialog open={!!transferStaff} onOpenChange={(o) => { if (!o) setTransferStaff(null); }}>
        <DialogContent className="max-w-md" data-testid="staff-transfer-dialog">
          <DialogHeader>
            <DialogTitle>Transfer Staff</DialogTitle>
          </DialogHeader>
          {transferStaff && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Transferring <span className="font-semibold text-foreground">{transferStaff.name}</span>
                {transferStaff.branch_id && (
                  <> from <span className="font-semibold text-foreground">
                    {branches.find(b => b.id === transferStaff.branch_id)?.branch_name || 'Current branch'}
                  </span></>
                )}
              </p>

              <div>
                <Label htmlFor="transfer-to">Target Branch *</Label>
                <select
                  id="transfer-to"
                  data-testid="transfer-to-branch-select"
                  value={transferToBranch}
                  onChange={(e) => setTransferToBranch(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="">-- Select Branch --</option>
                  {branches
                    .filter((b) => b.id !== transferStaff.branch_id && b.status === 'active')
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branch_name}{b.is_main_branch ? ' • Main' : ''}{b.branch_code ? ` (${b.branch_code})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <Label htmlFor="transfer-date">Transfer Date</Label>
                <Input
                  id="transfer-date"
                  data-testid="transfer-date-input"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="transfer-remarks">Remarks (optional)</Label>
                <Input
                  id="transfer-remarks"
                  data-testid="transfer-remarks-input"
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  placeholder="Reason for transfer"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferStaff(null)}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button
              onClick={submitTransfer}
              disabled={transferLoading || !transferToBranch}
              data-testid="confirm-transfer-btn"
              className="bg-gold text-black hover:bg-gold/90"
            >
              {transferLoading
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <ArrowRightLeft className="w-4 h-4 mr-2" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
