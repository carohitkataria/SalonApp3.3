import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  UserPlus, Edit2, Trash2, Eye, EyeOff, Users, Shield, X, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StaffAccessManagement() {
  const { getSalonUserHeaders, salonUser } = useAuth();
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    login_id: '',
    password: '',
    staff_id: '',
    permissions: {
      can_edit_salon: false,
      can_access_analytics: false,
      can_access_financials: false,
      can_delete_salon: false
    }
  });
  
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchStaffUsers();
    fetchStaffMembers();
  }, []);

  const fetchStaffUsers = async () => {
    try {
      const response = await axios.get(`${API}/salon/users`, {
        headers: getSalonUserHeaders()
      });
      setStaffUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching staff users:', error);
      toast.error('Failed to load staff users');
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const salonId = salonUser?.salonId || localStorage.getItem('salon_id');
      const response = await axios.get(`${API}/salons/${salonId}/barbers`);
      setStaffMembers(response.data || []);
    } catch (error) {
      console.error('Error fetching staff members:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePermissionChange = (permission, checked) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: checked
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const salonId = salonUser?.salonId || localStorage.getItem('salon_id');
      const payload = {
        salon_id: salonId,
        name: formData.name,
        mobile: formData.mobile,
        login_id: formData.login_id,
        password: formData.password,
        role: 'staff',
        staff_id: formData.staff_id || null,
        permissions: formData.permissions
      };

      if (editingUser) {
        await axios.put(
          `${API}/salon/users/${editingUser.id}`,
          {
            name: formData.name,
            mobile: formData.mobile,
            login_id: formData.login_id,
            password: formData.password || undefined,
            staff_id: formData.staff_id || null,
            permissions: formData.permissions
          },
          { headers: getSalonUserHeaders() }
        );
        toast.success('Staff user updated successfully');
      } else {
        await axios.post(`${API}/salon/users`, payload, {
          headers: getSalonUserHeaders()
        });
        toast.success('Staff user created successfully');
      }

      resetForm();
      fetchStaffUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save staff user');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    // Normalize permissions object — ensure all keys are present (handles legacy users)
    const perms = user.permissions || {};
    setFormData({
      name: user.name,
      mobile: user.mobile,
      login_id: user.login_id,
      password: '',
      staff_id: user.staff_id || '',
      permissions: {
        can_edit_salon: !!perms.can_edit_salon,
        can_access_analytics: !!perms.can_access_analytics,
        can_access_financials: !!perms.can_access_financials,
        can_delete_salon: !!perms.can_delete_salon
      }
    });
    setShowAddForm(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;

    try {
      await axios.delete(`${API}/salon/users/${userId}`, {
        headers: getSalonUserHeaders()
      });
      toast.success('Staff user deactivated');
      fetchStaffUsers();
    } catch (error) {
      toast.error('Failed to deactivate staff user');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      mobile: '',
      login_id: '',
      password: '',
      staff_id: '',
      permissions: {
        can_edit_salon: false,
        can_access_analytics: false,
        can_access_financials: false,
        can_delete_salon: false
      }
    });
    setEditingUser(null);
    setShowAddForm(false);
    setShowPassword(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-6 h-6 text-gold" />
          <h2 className="text-2xl font-bold">Manage Staff Access</h2>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-gold text-black hover:bg-gold/90"
        >
          {showAddForm ? (
            <>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Staff User
            </>
          )}
        </Button>
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-lg p-6"
          >
            <h3 className="text-lg font-semibold mb-4">
              {editingUser ? 'Edit Staff User' : 'Add New Staff User'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="mobile">Mobile Number *</Label>
                  <div className="flex items-center">
                    <span className="text-sm mr-2">+91</span>
                    <Input
                      id="mobile"
                      name="mobile"
                      value={formData.mobile}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData(prev => ({ ...prev, mobile: value }));
                      }}
                      placeholder="10-digit mobile"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="login_id">Login ID *</Label>
                  <Input
                    id="login_id"
                    name="login_id"
                    value={formData.login_id}
                    onChange={handleInputChange}
                    placeholder="e.g., staff001"
                    required={!editingUser}
                  />
                </div>

                <div>
                  <Label htmlFor="password">
                    Password {editingUser ? '(leave blank to keep current)' : '*'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter password"
                      required={!editingUser}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="staff_id">Link to Staff Member (Optional)</Label>
                  <select
                    id="staff_id"
                    name="staff_id"
                    value={formData.staff_id}
                    onChange={handleInputChange}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="">-- Select Staff Member --</option>
                    {staffMembers.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} - {staff.designation || staff.category}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Link this user account to a staff member profile
                  </p>
                </div>
              </div>

              {/* Permissions */}
              <div className="border-t border-border pt-4">
                <h4 className="font-semibold mb-3">Permissions</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="can_edit_salon"
                      checked={formData.permissions.can_edit_salon}
                      onCheckedChange={(checked) => handlePermissionChange('can_edit_salon', checked)}
                      className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                    />
                    <Label htmlFor="can_edit_salon" className="cursor-pointer">
                      Can edit salon profile
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="can_access_analytics"
                      checked={formData.permissions.can_access_analytics}
                      onCheckedChange={(checked) => handlePermissionChange('can_access_analytics', checked)}
                      className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                    />
                    <Label htmlFor="can_access_analytics" className="cursor-pointer">
                      Can access analytics
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="can_access_financials"
                      checked={formData.permissions.can_access_financials}
                      onCheckedChange={(checked) => handlePermissionChange('can_access_financials', checked)}
                      className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                    />
                    <Label htmlFor="can_access_financials" className="cursor-pointer">
                      Can access financials
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="can_delete_salon"
                      checked={formData.permissions.can_delete_salon}
                      onCheckedChange={(checked) => handlePermissionChange('can_delete_salon', checked)}
                      className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                    />
                    <Label htmlFor="can_delete_salon" className="cursor-pointer">
                      Can delete salon
                    </Label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  By default, staff can view/update tokens and handle walk-ins. 
                  They cannot access Settings, Analytics, Financials, or Reports unless granted above.
                  Services & Offerings is always visible — staff can view all services and choose
                  which ones they personally provide (when linked to a staff member).
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gold text-black hover:bg-gold/90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff Users List */}
      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold flex items-center">
            <Users className="w-5 h-5 mr-2 text-gold" />
            Staff Users ({staffUsers.length})
          </h3>
        </div>

        <div className="divide-y divide-border">
          {staffUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No staff users found. Click "Add Staff User" to create one.
            </div>
          ) : (
            staffUsers.map(user => (
              <div key={user.id} className="p-4 hover:bg-muted/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-semibold">{user.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-gold/20 text-gold' 
                          : 'bg-blue-500/20 text-blue-500'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Staff'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        user.status === 'active' 
                          ? 'bg-green-500/20 text-green-500' 
                          : 'bg-red-500/20 text-red-500'
                      }`}>
                        {user.status}
                      </span>
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Mobile: {user.mobile}</p>
                      <p>Login ID: {user.login_id}</p>
                      {user.staff_id && (
                        <p className="text-gold">
                          Linked to: {staffMembers.find(s => s.id === user.staff_id)?.name || 'Staff Member'}
                        </p>
                      )}
                    </div>

                    {user.role === 'staff' && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {user.permissions?.can_edit_salon && (
                          <span className="text-xs px-2 py-1 bg-muted rounded">Edit Salon</span>
                        )}
                        {user.permissions?.can_access_analytics && (
                          <span className="text-xs px-2 py-1 bg-muted rounded">Analytics</span>
                        )}
                        {user.permissions?.can_access_financials && (
                          <span className="text-xs px-2 py-1 bg-muted rounded">Financials</span>
                        )}
                        {user.permissions?.can_delete_salon && (
                          <span className="text-xs px-2 py-1 bg-muted rounded">Delete Salon</span>
                        )}
                        {!user.permissions?.can_edit_salon &&
                         !user.permissions?.can_access_analytics &&
                         !user.permissions?.can_access_financials &&
                         !user.permissions?.can_delete_salon && (
                          <span className="text-xs text-muted-foreground">Default permissions only</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(user)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {user.role !== 'admin' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(user.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
