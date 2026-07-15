import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  UserPlus, Edit2, Eye, EyeOff, Users, Shield, X, Save, Building2, KeyRound, Ban, RotateCcw, Settings2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { MODULES, summariseModule, hydrateModulesFromLegacy, deriveLegacyFromModules } from '@/components/staff/ModulePermissionsConfig';
import ModulePermissionsDrawer from '@/components/staff/ModulePermissionsDrawer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const emptyModules = () => {
  const m = {};
  MODULES.forEach(mod => {
    m[mod.key] = {};
    mod.actions.forEach(a => { m[mod.key][a.key] = false; });
  });
  return m;
};

export default function StaffAccessManagement() {
  const { getSalonUserHeaders, salonUser } = useAuth();
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Drawer state — which module's permissions drawer is open right now.
  const [drawerModuleKey, setDrawerModuleKey] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    login_id: '',
    password: '',
    role: 'staff',
    staff_id: '',
    assigned_branch_ids: [],
    modules: emptyModules(),
  });
  
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchStaffUsers();
    fetchStaffMembers();
    fetchBranches();
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

  const fetchBranches = async () => {
    try {
      const salonId = salonUser?.salonId || localStorage.getItem('salon_id');
      const res = await axios.get(`${API}/salons/${salonId}/branches`, {
        headers: getSalonUserHeaders(),
      });
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching branches:', error);
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
    // Legacy single-field toggle — retained for backward-compat but rarely
    // used since the new drawer writes into `modules` directly.
    setFormData(prev => {
      const nextMods = { ...(prev.modules || {}) };
      return { ...prev, modules: nextMods };
    });
  };

  /**
   * Called by ModulePermissionsDrawer after the admin saves changes for one
   * module. Merges the new action map into formData.modules.
   */
  const applyModuleDrawer = (moduleKey, actionMap) => {
    setFormData(prev => ({
      ...prev,
      modules: { ...(prev.modules || {}), [moduleKey]: actionMap || {} },
    }));
  };

  // Safely turn any axios error into a renderable string (FastAPI 422 returns
  // an array of objects which must never be rendered directly as a React child).
  const getErrorMessage = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail.map((d) => d?.msg || 'Invalid value').join(', ');
    }
    if (detail && typeof detail === 'object' && detail.message) return detail.message;
    return fallback;
  };

  // Revoke (deactivate) or restore (reactivate) a staff user's login access.
  const handleToggleAccess = async (user) => {
    const revoking = user.status === 'active';
    const verb = revoking ? 'revoke access for' : 'restore access for';
    if (!window.confirm(`Are you sure you want to ${verb} "${user.name}"?`)) return;
    try {
      if (revoking) {
        // DELETE deactivates (sets status inactive)
        await axios.delete(`${API}/salon/users/${user.id}`, { headers: getSalonUserHeaders() });
      } else {
        await axios.put(
          `${API}/salon/users/${user.id}`,
          { status: 'active' },
          { headers: getSalonUserHeaders() }
        );
      }
      toast.success(revoking ? 'Access revoked' : 'Access restored');
      fetchStaffUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update access'));
    }
  };

  // Reset a staff user's password to a new value.
  const handleResetPassword = async (user) => {
    const newPassword = window.prompt(`Enter a new password for "${user.name}" (min 6 characters):`);
    if (newPassword === null) return; // cancelled
    if (!newPassword || newPassword.trim().length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await axios.put(
        `${API}/salon/users/${user.id}`,
        { password: newPassword.trim() },
        { headers: getSalonUserHeaders() }
      );
      toast.success(`Password reset for ${user.name}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to reset password'));
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side uniqueness check for login_id (case-insensitive),
    const enteredId = (formData.login_id || '').trim().toLowerCase();
    const clash = staffUsers.find(
      (u) => (u.login_id || '').trim().toLowerCase() === enteredId && u.id !== editingUser?.id
    );
    if (clash) {
      toast.error(`Login ID "${formData.login_id}" is already taken. Please choose a unique Login ID.`);
      return;
    }

    setLoading(true);

    try {
      const salonId = salonUser?.salonId || localStorage.getItem('salon_id');
      // Compose the permissions payload: NEW granular modules + LEGACY flat
      // keys derived from them so old endpoints keep working seamlessly.
      const modules = formData.modules || {};
      const permissions = { ...deriveLegacyFromModules(modules), modules };
      const payload = {
        salon_id: salonId,
        name: formData.name,
        mobile: formData.mobile,
        login_id: formData.login_id,
        password: formData.password,
        role: formData.role,
        staff_id: formData.staff_id || null,
        assigned_branch_ids: formData.role === 'branch_manager' ? formData.assigned_branch_ids : [],
        permissions,
      };

      if (editingUser) {
        await axios.put(
          `${API}/salon/users/${editingUser.id}`,
          {
            name: formData.name,
            mobile: formData.mobile,
            login_id: formData.login_id,
            password: formData.password || undefined,
            role: formData.role,
            staff_id: formData.staff_id || null,
            assigned_branch_ids: formData.role === 'branch_manager' ? formData.assigned_branch_ids : [],
            permissions,
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
      toast.error(getErrorMessage(error, 'Failed to save staff user'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    // Hydrate granular modules[] from either the new field or the legacy flat
    // keys so old users open in the editor with sensible defaults.
    const hydratedModules = hydrateModulesFromLegacy(user.permissions || {});
    // Ensure every MODULE key/action exists (default false) so drawer toggles work.
    const modules = emptyModules();
    Object.keys(hydratedModules).forEach(k => {
      modules[k] = { ...(modules[k] || {}), ...hydratedModules[k] };
    });
    setFormData({
      name: user.name,
      mobile: user.mobile,
      login_id: user.login_id,
      password: '',
      role: user.role || 'staff',
      staff_id: user.staff_id || '',
      assigned_branch_ids: Array.isArray(user.assigned_branch_ids) ? user.assigned_branch_ids : [],
      modules,
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      mobile: '',
      login_id: '',
      password: '',
      role: 'staff',
      staff_id: '',
      assigned_branch_ids: [],
      modules: emptyModules(),
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

                <div className="md:col-span-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    data-testid="user-role-select"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="staff">Staff</option>
                    <option value="branch_manager">Branch Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Branch Manager: scoped to assigned branches only. Admin: full access.
                  </p>
                </div>

                {formData.role === 'branch_manager' && (
                  <div className="md:col-span-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gold" />
                      Assigned Branches *
                    </Label>
                    <div
                      className="mt-2 space-y-2 max-h-40 overflow-auto border border-input rounded-md p-2 bg-background"
                      data-testid="user-assigned-branches"
                    >
                      {branches.length === 0 && (
                        <p className="text-xs text-muted-foreground">No branches yet. Create a branch first.</p>
                      )}
                      {branches.map((b) => {
                        const checked = formData.assigned_branch_ids.includes(b.id);
                        return (
                          <label
                            key={b.id}
                            className="flex items-center gap-2 cursor-pointer text-sm"
                            data-testid={`assign-branch-${b.id}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setFormData((prev) => {
                                  const next = new Set(prev.assigned_branch_ids);
                                  if (e.target.checked) next.add(b.id);
                                  else next.delete(b.id);
                                  return { ...prev, assigned_branch_ids: Array.from(next) };
                                });
                              }}
                            />
                            <span className="truncate">
                              {b.branch_name}
                              {b.is_main_branch ? ' • Main' : ''}
                              {b.branch_code ? ` (${b.branch_code})` : ''}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {formData.assigned_branch_ids.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">Select at least one branch for this manager.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Permissions */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gold" /> Module Permissions
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Click a module to open the configuration drawer and pick exact actions.
                    </p>
                  </div>
                </div>

                {/* Per-module access cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" data-testid="module-access-grid">
                  {MODULES.map((mod) => {
                    const summary = summariseModule({ modules: formData.modules }, mod.key);
                    const isFull = summary === 'Full';
                    const isNone = summary === 'None';
                    return (
                      <button
                        type="button"
                        key={mod.key}
                        onClick={() => setDrawerModuleKey(mod.key)}
                        data-testid={`module-card-${mod.key}`}
                        className="text-left rounded-lg border border-border bg-card hover:border-gold hover:shadow-sm transition p-3 flex items-center gap-3"
                        style={{ borderLeftWidth: 4, borderLeftColor: mod.color }}
                      >
                        <div
                          className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                          style={{ background: `${mod.color}1A`, color: mod.color }}
                        >
                          <Settings2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{mod.label}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{mod.description}</div>
                        </div>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: isNone ? '#F3F4F6' : (isFull ? `${mod.color}22` : `${mod.color}14`),
                            color: isNone ? '#6B7280' : mod.color,
                            border: `1px solid ${isNone ? '#E5E7EB' : mod.color + '55'}`,
                          }}
                          data-testid={`module-summary-${mod.key}`}
                        >
                          {summary}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  By default, staff can view/update tokens and handle walk-ins.
                  Every other capability must be granted explicitly through the
                  drawers above. Granting &quot;Staff → attendance&quot; (without &quot;view all&quot;)
                  lets a staff member self check-in only.
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
              No staff users found. Click &quot;Add Staff User&quot; to create one.
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
                          : user.role === 'branch_manager'
                            ? 'bg-purple-500/20 text-purple-500'
                            : 'bg-blue-500/20 text-blue-500'
                      }`} data-testid={`user-role-badge-${user.id}`}>
                        {user.role === 'admin' ? 'Admin' : user.role === 'branch_manager' ? 'Branch Manager' : 'Staff'}
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
                      {user.role === 'branch_manager' && Array.isArray(user.assigned_branch_ids) && user.assigned_branch_ids.length > 0 && (
                        <p className="text-purple-500">
                          Branches: {user.assigned_branch_ids.map(id => branches.find(b => b.id === id)?.branch_name || 'Unknown').join(', ')}
                        </p>
                      )}
                    </div>

                    {user.role === 'staff' && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(() => {
                          const chips = MODULES.map(mod => {
                            const summary = summariseModule(user.permissions || {}, mod.key);
                            if (summary === 'None') return null;
                            return (
                              <span
                                key={mod.key}
                                className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  background: `${mod.color}14`,
                                  color: mod.color,
                                  border: `1px solid ${mod.color}55`,
                                }}
                              >
                                {mod.label.replace(' Management', '').replace(' & Offerings', '')} · {summary}
                              </span>
                            );
                          }).filter(Boolean);
                          if (chips.length === 0) {
                            return <span className="text-xs text-muted-foreground">Default permissions only</span>;
                          }
                          return chips;
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 ml-4 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(user)}
                      title="Edit user"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {user.role !== 'admin' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetPassword(user)}
                          data-testid={`reset-password-${user.id}`}
                          title="Reset password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleAccess(user)}
                          data-testid={`toggle-access-${user.id}`}
                          className={user.status === 'active' ? 'text-red-500 hover:text-red-600' : 'text-green-600 hover:text-green-700'}
                          title={user.status === 'active' ? 'Revoke access' : 'Restore access'}
                        >
                          {user.status === 'active' ? <Ban className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right-side drawer for granular module permissions */}
      <ModulePermissionsDrawer
        isOpen={!!drawerModuleKey}
        moduleKey={drawerModuleKey}
        value={drawerModuleKey ? (formData.modules?.[drawerModuleKey] || {}) : {}}
        onSave={(actionMap) => applyModuleDrawer(drawerModuleKey, actionMap)}
        onClose={() => setDrawerModuleKey(null)}
      />
    </div>
  );
}
