import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  ArrowLeft, User, Save, Scissors, Shield, Edit2, Phone, Calendar, 
  Briefcase, CreditCard, FileText, X, Trophy, ChevronLeft, ChevronRight,
  Check, Loader2, DollarSign, Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import StaffAttendanceTab from '@/components/StaffAttendanceTab';
import StaffRewardsTab from '@/components/StaffRewardsTab';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create Staff User Form Component
function CreateStaffUserForm({ staffId, staffName, staffMobile, salonId, onSuccess }) {
  const [formData, setFormData] = useState({
    loginId: '',
    password: '',
    confirmPassword: '',
    permissions: {
      can_edit_salon: false,
      can_access_analytics: false,
      can_access_financials: false,
      can_delete_salon: false
    }
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!formData.loginId) {
      toast.error('Please enter a login ID');
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('salon_admin_token') || 
                    JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token;

      await axios.post(
        `${API}/salon/users`,
        {
          salon_id: salonId,
          name: staffName,
          mobile: staffMobile,
          login_id: formData.loginId,
          password: formData.password,
          role: 'staff',
          staff_id: staffId,
          permissions: formData.permissions
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Staff login credentials created successfully!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create staff user');
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-lg p-6">
      <h4 className="font-semibold text-foreground">Create Login Credentials</h4>
      
      <div>
        <Label htmlFor="loginId">Login ID *</Label>
        <Input
          id="loginId"
          value={formData.loginId}
          onChange={(e) => setFormData({ ...formData, loginId: e.target.value })}
          placeholder="e.g., staff123 or john_doe"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          Staff will use this ID to login
        </p>
      </div>

      <div>
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="Minimum 6 characters"
          required
        />
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm Password *</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          placeholder="Re-enter password"
          required
        />
      </div>

      <div className="space-y-3 pt-4 border-t border-border">
        <Label className="text-base">Permissions</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_edit_salon"
              checked={formData.permissions.can_edit_salon}
              onCheckedChange={(checked) => 
                setFormData({ 
                  ...formData, 
                  permissions: { ...formData.permissions, can_edit_salon: checked } 
                })
              }
            />
            <Label htmlFor="can_edit_salon" className="cursor-pointer font-normal">
              Can edit salon details
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_access_analytics"
              checked={formData.permissions.can_access_analytics}
              onCheckedChange={(checked) => 
                setFormData({ 
                  ...formData, 
                  permissions: { ...formData.permissions, can_access_analytics: checked } 
                })
              }
            />
            <Label htmlFor="can_access_analytics" className="cursor-pointer font-normal">
              Can access analytics
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_delete_salon"
              checked={formData.permissions.can_delete_salon}
              onCheckedChange={(checked) => 
                setFormData({ 
                  ...formData, 
                  permissions: { ...formData.permissions, can_delete_salon: checked } 
                })
              }
            />
            <Label htmlFor="can_delete_salon" className="cursor-pointer font-normal">
              Can delete salon (Dangerous)
            </Label>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={creating} className="w-full bg-gold text-black hover:bg-gold/90">
        {creating ? 'Creating...' : 'Create Staff Login'}
      </Button>
    </form>
  );
}

export default function StaffProfilePage() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [staffUser, setStaffUser] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const [profileData, setProfileData] = useState({
    name: '',
    mobile: '',
    experience: 0,
    category: '',
    department: '',
    designation: '',
    emergency_contact: '',
    aadhar_number: '',
    doj: '',
    dob: '',
    compensation: '',
    is_barber: true,
    on_leave: false
  });

  const [permissions, setPermissions] = useState({
    can_edit_salon: false,
    can_access_analytics: false,
    can_access_financials: false,
    can_delete_salon: false
  });

  useEffect(() => {
    fetchStaffData();
    fetchServices();
  }, [staffId]);

  const fetchStaffData = async () => {
    try {
      const salonId = localStorage.getItem('salon_id');
      const token = localStorage.getItem('salon_admin_token') || 
                    JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token;
      
      // Fetch staff details
      const staffResponse = await axios.get(`${API}/salons/${salonId}/barbers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const staffMember = staffResponse.data.find(b => b.id === staffId);
      
      if (staffMember) {
        setStaff(staffMember);
        setProfileData({
          name: staffMember.name || '',
          mobile: staffMember.mobile || '',
          experience: staffMember.experience || 0,
          category: staffMember.category || '',
          department: staffMember.department || '',
          designation: staffMember.designation || '',
          emergency_contact: staffMember.emergency_contact || '',
          aadhar_number: staffMember.aadhar_number || '',
          doj: staffMember.doj || '',
          dob: staffMember.dob || '',
          compensation: staffMember.compensation || '',
          is_barber: staffMember.is_barber !== false,
          on_leave: staffMember.on_leave || false
        });
      }

      // Fetch staff user (for access control)
      const usersResponse = await axios.get(`${API}/salon/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const linkedUser = usersResponse.data.users?.find(u => u.staff_id === staffId);
      if (linkedUser) {
        setStaffUser(linkedUser);
        setPermissions(linkedUser.permissions || permissions);
      }
    } catch (error) {
      console.error('Error fetching staff data:', error);
      toast.error('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/barbers/${staffId}/services`);
      setServices(response.data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const salonId = localStorage.getItem('salon_id');
      const token = localStorage.getItem('salon_admin_token') || 
                    JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token;

      await axios.put(
        `${API}/salons/${salonId}/barbers/${staffId}`,
        profileData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Profile updated successfully');
      setEditMode(false);
      fetchStaffData();
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleServiceToggle = async (serviceId, isAvailable) => {
    try {
      const salonId = localStorage.getItem('salon_id');
      const token = localStorage.getItem('salon_admin_token') || 
                    JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token;

      await axios.put(
        `${API}/barbers/${staffId}/services/${serviceId}/toggle?is_available=${isAvailable}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setServices(prev => prev.map(s => 
        s.id === serviceId ? { ...s, is_available: isAvailable } : s
      ));
      toast.success('Service updated');
    } catch (error) {
      toast.error('Failed to update service');
    }
  };

  const handleUpdatePermissions = async () => {
    if (!staffUser) {
      toast.error('No user account linked to this staff member');
      return;
    }

    try {
      const salonId = localStorage.getItem('salon_id');
      const token = localStorage.getItem('salon_admin_token') || 
                    JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token;

      await axios.put(
        `${API}/salon/users/${staffUser.id}`,
        { permissions },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Permissions updated successfully');
    } catch (error) {
      toast.error('Failed to update permissions');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-muted-foreground mb-4">Staff member not found</p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{staff.name}</h1>
                <p className="text-sm text-muted-foreground">{staff.designation || staff.category}</p>
              </div>
            </div>
            {editMode && activeTab === 'profile' && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile} className="bg-gold text-black hover:bg-gold/90">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'attendance', label: 'Attendance', icon: Calendar },
              { id: 'services', label: 'Services', icon: Scissors },
              { id: 'rewards', label: 'Rewards', icon: Trophy },
              { id: 'access', label: 'Access', icon: Shield }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gold text-black font-semibold'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4 pb-20">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Personal Information</h3>
                {!editMode && (
                  <Button variant="outline" onClick={() => setEditMode(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    disabled={!editMode}
                  />
                </div>

                <div>
                  <Label>Mobile Number</Label>
                  <Input
                    value={profileData.mobile}
                    onChange={(e) => setProfileData({ ...profileData, mobile: e.target.value })}
                    disabled={!editMode}
                  />
                </div>

                <div>
                  <Label>Experience (Years)</Label>
                  <Input
                    type="number"
                    value={profileData.experience}
                    onChange={(e) => setProfileData({ ...profileData, experience: parseInt(e.target.value) || 0 })}
                    disabled={!editMode}
                  />
                </div>

                <div>
                  <Label>Category</Label>
                  <Input
                    value={profileData.category}
                    onChange={(e) => setProfileData({ ...profileData, category: e.target.value })}
                    disabled={!editMode}
                  />
                </div>

                <div>
                  <Label>Department</Label>
                  <Input
                    value={profileData.department}
                    onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                    disabled={!editMode}
                    placeholder="e.g., Hairstyling, Spa"
                  />
                </div>

                <div>
                  <Label>Designation</Label>
                  <Input
                    value={profileData.designation}
                    onChange={(e) => setProfileData({ ...profileData, designation: e.target.value })}
                    disabled={!editMode}
                    placeholder="e.g., Senior Stylist"
                  />
                </div>

                <div>
                  <Label>Emergency Contact</Label>
                  <Input
                    value={profileData.emergency_contact}
                    onChange={(e) => setProfileData({ ...profileData, emergency_contact: e.target.value })}
                    disabled={!editMode}
                  />
                </div>

                <div>
                  <Label>Aadhar Number</Label>
                  <Input
                    value={profileData.aadhar_number}
                    onChange={(e) => setProfileData({ ...profileData, aadhar_number: e.target.value })}
                    disabled={!editMode}
                  />
                </div>

                <div>
                  <Label>Date of Joining</Label>
                  <Input
                    type="date"
                    value={profileData.doj}
                    onChange={(e) => setProfileData({ ...profileData, doj: e.target.value })}
                    disabled={!editMode}
                  />
                </div>

                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={profileData.dob}
                    onChange={(e) => setProfileData({ ...profileData, dob: e.target.value })}
                    disabled={!editMode}
                  />
                </div>

                <div>
                  <Label>Monthly Compensation (₹)</Label>
                  <Input
                    type="number"
                    value={profileData.compensation}
                    onChange={(e) => setProfileData({ ...profileData, compensation: e.target.value })}
                    disabled={!editMode}
                  />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_barber"
                    checked={profileData.is_barber}
                    onCheckedChange={(checked) => setProfileData({ ...profileData, is_barber: checked })}
                    disabled={!editMode}
                    className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                  />
                  <Label htmlFor="is_barber" className="cursor-pointer">
                    <span className="font-semibold">Visible as Barber to Customers</span>
                    <p className="text-xs text-muted-foreground">Uncheck if this is non-barber staff (receptionist, etc.)</p>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="on_leave"
                    checked={profileData.on_leave}
                    onCheckedChange={(checked) => setProfileData({ ...profileData, on_leave: checked })}
                    disabled={!editMode}
                  />
                  <Label htmlFor="on_leave" className="cursor-pointer">
                    Staff is on leave
                  </Label>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <StaffAttendanceTab 
            salonId={localStorage.getItem('salon_id')} 
            barberId={staffId} 
            barberName={staff?.name}
            compensation={staff?.compensation || 0}
          />
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Service Assignments</h3>
                  <p className="text-sm text-muted-foreground">
                    Enable/disable services this staff member can provide
                  </p>
                </div>
                {/* Select All / Deselect All Button */}
                {services.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const allSelected = services.every(s => s.is_available);
                      const newState = !allSelected;
                      // Toggle all services
                      for (const service of services) {
                        if (service.is_available !== newState) {
                          await handleServiceToggle(service.id, newState);
                        }
                      }
                    }}
                    className="text-xs"
                  >
                    {services.every(s => s.is_available) ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>

              {/* Group services by category */}
              <div className="space-y-4">
                {services.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No services available. Enable services in Services & Offerings section first.
                  </p>
                ) : (
                  (() => {
                    // Group services by category
                    const groupedServices = services.reduce((acc, service) => {
                      const category = service.category || 'General';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(service);
                      return acc;
                    }, {});

                    return Object.entries(groupedServices).map(([category, categoryServices]) => (
                      <div key={category} className="border border-border rounded-lg overflow-hidden">
                        {/* Category Header with Select All */}
                        <div className="flex items-center justify-between p-3 bg-muted/50">
                          <span className="font-semibold text-foreground">{category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {categoryServices.filter(s => s.is_available).length}/{categoryServices.length}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const allSelected = categoryServices.every(s => s.is_available);
                                const newState = !allSelected;
                                for (const service of categoryServices) {
                                  if (service.is_available !== newState) {
                                    await handleServiceToggle(service.id, newState);
                                  }
                                }
                              }}
                              className="text-xs h-7 px-2 text-gold hover:text-gold"
                            >
                              {categoryServices.every(s => s.is_available) ? 'Deselect All' : 'Select All'}
                            </Button>
                          </div>
                        </div>
                        {/* Services in category */}
                        <div className="p-3 space-y-2">
                          {categoryServices.map(service => (
                            <div
                              key={service.id}
                              className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-gold/50 transition-all"
                            >
                              <div className="flex-1">
                                <h4 className="font-semibold text-sm">{service.service_name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  ₹{service.barber_price || service.base_price}
                                </p>
                              </div>
                              <Checkbox
                                checked={service.is_available || false}
                                onCheckedChange={(checked) => handleServiceToggle(service.id, checked)}
                                className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Access Control Tab */}
        {activeTab === 'access' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Access Control & Permissions</h3>
              
              {!staffUser ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      ⚠️ This staff member doesn't have login access yet. Create credentials below to grant access.
                    </p>
                  </div>

                  <CreateStaffUserForm 
                    staffId={staffId} 
                    staffName={staff.name}
                    staffMobile={staff.mobile}
                    salonId={localStorage.getItem('salon_id')}
                    onSuccess={() => fetchStaffData()}
                  />
                </div>
              ) : (
                <>
                  <div className="p-4 bg-muted rounded-lg mb-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Login ID:</span>
                        <p className="font-semibold">{staffUser.login_id}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mobile:</span>
                        <p className="font-semibold">{staffUser.mobile}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Role:</span>
                        <p className="font-semibold capitalize">{staffUser.role}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          staffUser.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                        }`}>
                          {staffUser.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">Default Permissions (Always Granted):</h4>
                    <div className="space-y-2 pl-4">
                      <p className="text-sm text-muted-foreground">✓ View and update token status</p>
                      <p className="text-sm text-muted-foreground">✓ Handle walk-in customers</p>
                      <p className="text-sm text-muted-foreground">✓ View all tokens in salon</p>
                    </div>

                    <h4 className="font-semibold mt-6">Additional Permissions:</h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 p-3 border border-border rounded-lg">
                        <Checkbox
                          id="can_edit_salon"
                          checked={permissions.can_edit_salon}
                          onCheckedChange={(checked) => setPermissions({ ...permissions, can_edit_salon: checked })}
                          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                        <Label htmlFor="can_edit_salon" className="cursor-pointer flex-1">
                          <span className="font-medium">Can edit salon profile</span>
                          <p className="text-xs text-muted-foreground">Access to salon settings and profile updates</p>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border border-border rounded-lg">
                        <Checkbox
                          id="can_access_analytics"
                          checked={permissions.can_access_analytics}
                          onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_analytics: checked })}
                          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                        <Label htmlFor="can_access_analytics" className="cursor-pointer flex-1">
                          <span className="font-medium">Can access analytics</span>
                          <p className="text-xs text-muted-foreground">View analytics, reports, and statistics</p>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border border-border rounded-lg">
                        <Checkbox
                          id="can_access_financials"
                          checked={permissions.can_access_financials}
                          onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_financials: checked })}
                          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                        <Label htmlFor="can_access_financials" className="cursor-pointer flex-1">
                          <span className="font-medium">Can access financials</span>
                          <p className="text-xs text-muted-foreground">View financial reports and cash flow</p>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border border-border rounded-lg">
                        <Checkbox
                          id="can_delete_salon"
                          checked={permissions.can_delete_salon}
                          onCheckedChange={(checked) => setPermissions({ ...permissions, can_delete_salon: checked })}
                          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                        <Label htmlFor="can_delete_salon" className="cursor-pointer flex-1">
                          <span className="font-medium">Can delete salon</span>
                          <p className="text-xs text-muted-foreground text-red-500">⚠️ Dangerous permission - grants delete access</p>
                        </Label>
                      </div>
                    </div>

                    <div className="flex justify-end mt-6">
                      <Button onClick={handleUpdatePermissions} className="bg-gold text-black hover:bg-gold/90">
                        <Save className="w-4 h-4 mr-2" />
                        Save Permissions
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <StaffRewardsTab 
            salonId={localStorage.getItem('salon_id')} 
            barberId={staffId} 
            barberName={staff?.name}
          />
        )}
      </div>
    </div>
  );
}
