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
  Briefcase, CreditCard, FileText, X, ChevronLeft, ChevronRight,
  Check, Loader2, DollarSign, Clock, Trash2, AlertTriangle, Upload, Download, Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import StaffAttendanceTab from '@/components/StaffAttendanceTab';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create Staff User Form Component
function CreateStaffUserForm({ staffId, staffName, staffMobile, salonId, onSuccess, existingLoginIds = [] }) {
  const [formData, setFormData] = useState({
    loginId: '',
    password: '',
    confirmPassword: '',
    permissions: {
      can_edit_salon: false,
      can_access_analytics: false,
      can_access_financials: false,
      can_delete_salon: false,
      can_access_services: false,
      can_access_gallery: false,
      can_access_staff: false,
      can_view_all_staff: false
    }
  });
  const [creating, setCreating] = useState(false);

  const setPerm = (key, checked) => {
    setFormData((prev) => {
      const next = { ...prev.permissions, [key]: checked };
      if (key === 'can_access_staff' && !checked) next.can_view_all_staff = false;
      return { ...prev, permissions: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.loginId) {
      toast.error('Please enter a login ID');
      return;
    }

    // Uniqueness check before assigning (backend also enforces this).
    const entered = formData.loginId.trim().toLowerCase();
    if (existingLoginIds.some((id) => (id || '').trim().toLowerCase() === entered)) {
      toast.error(`Login ID "${formData.loginId}" is already taken. Please choose a unique Login ID.`);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
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
      const detail = error?.response?.data?.detail;
      let msg = 'Failed to create staff user';
      if (typeof detail === 'string') msg = detail;
      else if (Array.isArray(detail) && detail.length) msg = detail.map((d) => d?.msg || 'Invalid').join(', ');
      toast.error(msg);
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

          <div className="pt-2 mt-1 border-t border-border">
            <p className="text-sm font-semibold mb-1">Section access</p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="cu_can_access_services"
              checked={formData.permissions.can_access_services}
              onCheckedChange={(checked) => setPerm('can_access_services', checked)}
            />
            <Label htmlFor="cu_can_access_services" className="cursor-pointer font-normal">
              Can see Services &amp; Offerings section
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="cu_can_access_gallery"
              checked={formData.permissions.can_access_gallery}
              onCheckedChange={(checked) => setPerm('can_access_gallery', checked)}
            />
            <Label htmlFor="cu_can_access_gallery" className="cursor-pointer font-normal">
              Can see Gallery section
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="cu_can_access_staff"
              checked={formData.permissions.can_access_staff}
              onCheckedChange={(checked) => setPerm('can_access_staff', checked)}
            />
            <Label htmlFor="cu_can_access_staff" className="cursor-pointer font-normal">
              Can see Staff Management section
            </Label>
          </div>

          {formData.permissions.can_access_staff && (
            <div className="flex items-start space-x-2 ml-6 pl-3 border-l-2 border-gold/30">
              <Checkbox
                id="cu_can_view_all_staff"
                checked={formData.permissions.can_view_all_staff}
                onCheckedChange={(checked) => setPerm('can_view_all_staff', checked)}
                className="mt-0.5"
              />
              <Label htmlFor="cu_can_view_all_staff" className="cursor-pointer font-normal">
                Can see all staff details
                <span className="block text-xs text-muted-foreground">
                  If unchecked, this user sees only their own profile.
                </span>
              </Label>
            </div>
          )}
        </div>
      </div>

      <Button type="submit" disabled={creating} className="w-full bg-gold text-black hover:bg-gold/90">
        {creating ? 'Creating...' : 'Create Staff Login'}
      </Button>
    </form>
  );
}


// ============ Staff Documents Tab ============
const DOC_TYPES = [
  { value: 'aadhar_front', label: 'Aadhar (Front)' },
  { value: 'aadhar_back', label: 'Aadhar (Back)' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'photo', label: 'Photo' },
  { value: 'other', label: 'Other' },
];

function StaffDocumentsTab({ staffId, getAuthToken }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('aadhar_front');
  const [customLabel, setCustomLabel] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const r = await axios.get(`${API}/barbers/${staffId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocuments(r.data?.documents || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10 MB)');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      setUploading(true);
      try {
        const token = getAuthToken();
        const labelToUse = uploadType === 'other'
          ? (customLabel || 'Other')
          : (DOC_TYPES.find((t) => t.value === uploadType)?.label || uploadType);
        await axios.post(
          `${API}/barbers/${staffId}/documents`,
          {
            doc_type: uploadType,
            label: labelToUse,
            file_data: reader.result,
            mime_type: file.type,
            file_name: file.name,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Document uploaded');
        setCustomLabel('');
        await fetchDocs();
      } catch (err) {
        toast.error(err?.response?.data?.detail || 'Upload failed');
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Remove this document?')) return;
    try {
      const token = getAuthToken();
      await axios.delete(`${API}/barbers/${staffId}/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Document removed');
      await fetchDocs();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to remove');
    }
  };

  const handlePreview = async (docId) => {
    try {
      const token = getAuthToken();
      const r = await axios.get(`${API}/barbers/${staffId}/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPreviewDoc(r.data);
    } catch (e) {
      toast.error('Failed to load document');
    }
  };

  const handleDownload = async (docId, fileName) => {
    try {
      const token = getAuthToken();
      const r = await axios.get(`${API}/barbers/${staffId}/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const a = document.createElement('a');
      a.href = r.data.file_data;
      a.download = fileName || 'document';
      a.click();
    } catch (e) {
      toast.error('Failed to download');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-1">Upload Document</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Aadhar, PAN, Photo, etc. Stored securely for salon records (max 10 MB per file).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Document Type</Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              disabled={uploading}
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {uploadType === 'other' && (
            <div>
              <Label>Custom Label</Label>
              <Input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Voter ID"
                disabled={uploading}
              />
            </div>
          )}
          <div className="sm:col-span-1">
            <Label>File</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>
        </div>
        {uploading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Uploaded Documents</h3>
          <span className="text-sm text-muted-foreground">{documents.length} file{documents.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No documents uploaded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 p-3 border border-border rounded-md bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded bg-gold/15 text-gold flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.label || d.doc_type}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {d.file_name || 'untitled'} · {d.size_kb ? `${d.size_kb} KB` : ''}
                      {d.uploaded_at ? ` · ${new Date(d.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handlePreview(d.id)} title="Preview">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d.id, d.file_name)} title="Download">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)} title="Remove" className="text-rose-400 hover:text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewDoc?.label}</DialogTitle>
          </DialogHeader>
          {previewDoc?.mime_type?.startsWith('image/') ? (
            <img
              src={previewDoc.file_data}
              alt={previewDoc.label}
              className="max-h-[70vh] mx-auto rounded"
            />
          ) : previewDoc?.mime_type === 'application/pdf' ? (
            <iframe
              src={previewDoc.file_data}
              title={previewDoc.label}
              className="w-full h-[70vh] rounded"
            />
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Cannot preview this file type. Download to view.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const getAuthToken = () => (
    localStorage.getItem('salon_admin_token') ||
    JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token
  );

  const handleDeleteStaff = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setDeleting(true);
    try {
      const token = getAuthToken();
      const r = await axios.delete(`${API}/barbers/${staffId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const preserved = r.data?.preserved_records || {};
      const total = (preserved.financial_transactions || 0) + (preserved.salary_records || 0) + (preserved.incentive_payouts || 0);
      toast.success(
        `Staff deleted${total ? ` — ${total} financial record${total === 1 ? '' : 's'} preserved for audit` : ''}`,
        { duration: 5000 }
      );
      setShowDeleteConfirm(false);
      navigate(-1);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to delete staff');
    } finally {
      setDeleting(false);
    }
  };

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
    last_working_date: '',
    compensation: '',
    is_barber: true,
    profile_image: '',
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [permissions, setPermissions] = useState({
    can_edit_salon: false,
    can_access_analytics: false,
    can_access_financials: false,
    can_delete_salon: false,
    can_access_services: false,
    can_access_gallery: false,
    can_access_staff: false,
    can_view_all_staff: false
  });
  const [allLoginIds, setAllLoginIds] = useState([]);

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
          last_working_date: staffMember.last_working_date || '',
          compensation: staffMember.compensation || '',
          is_barber: staffMember.is_barber !== false,
          profile_image: staffMember.profile_image || '',
        });
      }

      // Fetch staff user (for access control)
      const usersResponse = await axios.get(`${API}/salon/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allUsers = usersResponse.data.users || [];
      setAllLoginIds(allUsers.map((u) => u.login_id).filter(Boolean));
      const linkedUser = allUsers.find(u => u.staff_id === staffId);
      if (linkedUser) {
        setStaffUser(linkedUser);
        setPermissions((prev) => ({ ...prev, ...(linkedUser.permissions || {}) }));
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

  const handleUploadProfileImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5 MB');
      return;
    }
    setUploadingPhoto(true);
    try {
      // Convert to base64 (matches existing pattern in BarberManagement)
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const token = localStorage.getItem('salon_admin_token') ||
                    JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token;

      // Persist immediately so it's visible without entering "Edit" mode.
      // Send ONLY the profile_image field — sending the full profileData
      // (which may contain compensation:'' etc.) triggers a 422.
      await axios.put(
        `${API}/barbers/${staffId}`,
        { profile_image: base64 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfileData(prev => ({ ...prev, profile_image: base64 }));
      setStaff(prev => prev ? { ...prev, profile_image: base64 } : prev);
      toast.success('Profile photo updated');
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      let msg = 'Failed to upload profile photo';
      if (typeof detail === 'string') msg = detail;
      else if (Array.isArray(detail) && detail.length) msg = detail.map((d) => d?.msg || 'Invalid').join(', ');
      toast.error(msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemoveProfileImage = async () => {
    setUploadingPhoto(true);
    try {
      const token = localStorage.getItem('salon_admin_token') ||
                    JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token;
      await axios.put(
        `${API}/barbers/${staffId}`,
        { profile_image: '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfileData(prev => ({ ...prev, profile_image: '' }));
      setStaff(prev => prev ? { ...prev, profile_image: '' } : prev);
      toast.success('Profile photo removed');
    } catch (error) {
      toast.error('Failed to remove photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('salon_admin_token') || 
                    JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token;

      // Sanitize payload: empty strings break Pydantic validation for numeric/optional fields.
      // - compensation is Optional[float]; '' must become null
      // - experience is int; '' must become 0
      // - empty date strings (doj/dob/last_working_date) should be sent as null to clear them
      const payload = { ...profileData };
      payload.compensation =
        payload.compensation === '' || payload.compensation === null || payload.compensation === undefined
          ? null
          : Number(payload.compensation);
      payload.experience =
        payload.experience === '' || payload.experience === null || payload.experience === undefined
          ? 0
          : Number(payload.experience) || 0;
      ['doj', 'dob', 'last_working_date'].forEach((k) => {
        if (payload[k] === '') payload[k] = null;
      });

      // Backend exposes PUT /api/barbers/{barber_id} (not scoped under salons)
      await axios.put(
        `${API}/barbers/${staffId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Profile updated successfully');
      setEditMode(false);
      fetchStaffData();
    } catch (error) {
      console.error('[Staff Profile Update] error:', error?.response?.data || error);
      const detail = error?.response?.data?.detail;
      let msg = 'Failed to update profile';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Pydantic validation errors come as a list
        msg = detail.map((d) => `${(d.loc || []).slice(-1)[0] || 'field'}: ${d.msg}`).join(', ');
      }
      toast.error(msg);
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

  // Update the per-barber price for a single service (PRD: per-barber pricing).
  const handleServicePriceSave = async (serviceId, newPrice) => {
    const priceNum = Number(newPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error('Enter a valid price');
      return;
    }
    try {
      const token = getAuthToken();
      await axios.put(
        `${API}/barbers/${staffId}/services/${serviceId}/price?price=${priceNum}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setServices(prev => prev.map(s =>
        s.id === serviceId ? { ...s, barber_price: priceNum } : s
      ));
      toast.success(`Price set to ₹${priceNum}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update price');
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

  const authHeader = () => {
    const token = localStorage.getItem('salon_admin_token') ||
                  JSON.parse(localStorage.getItem('salon_user_auth') || '{}').token;
    return { Authorization: `Bearer ${token}` };
  };

  const safeDetail = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length) return detail.map((d) => d?.msg || 'Invalid').join(', ');
    return fallback;
  };

  // Reset the linked staff user's password.
  const handleResetStaffPassword = async () => {
    if (!staffUser) return;
    const newPassword = window.prompt(`Enter a new password for "${staffUser.login_id}" (min 6 characters):`);
    if (newPassword === null) return;
    if (!newPassword || newPassword.trim().length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await axios.put(
        `${API}/salon/users/${staffUser.id}`,
        { password: newPassword.trim() },
        { headers: authHeader() }
      );
      toast.success('Password reset successfully');
    } catch (error) {
      toast.error(safeDetail(error, 'Failed to reset password'));
    }
  };

  // Revoke (deactivate) or restore (reactivate) the linked staff user's login access.
  const handleToggleStaffAccess = async () => {
    if (!staffUser) return;
    const revoking = staffUser.status === 'active';
    if (!window.confirm(`${revoking ? 'Revoke' : 'Restore'} login access for "${staffUser.name}"?`)) return;
    try {
      if (revoking) {
        await axios.delete(`${API}/salon/users/${staffUser.id}`, { headers: authHeader() });
      } else {
        await axios.put(
          `${API}/salon/users/${staffUser.id}`,
          { status: 'active' },
          { headers: authHeader() }
        );
      }
      toast.success(revoking ? 'Access revoked' : 'Access restored');
      fetchStaffData();
    } catch (error) {
      toast.error(safeDetail(error, 'Failed to update access'));
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
            {!editMode && activeTab === 'profile' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDeleteConfirmText(''); setShowDeleteConfirm(true); }}
                className="text-rose-500 border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500"
                data-testid="delete-staff-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Staff
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'attendance', label: 'Attendance', icon: Calendar },
              { id: 'services', label: 'Services', icon: Scissors },
              { id: 'documents', label: 'Documents', icon: FileText },
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

              {/* Profile Photo */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 pb-6 border-b border-border">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-muted border-2 border-border flex-shrink-0">
                  {profileData.profile_image ? (
                    <img
                      src={profileData.profile_image}
                      alt={profileData.name || 'Staff'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gold/10">
                      <User className="w-10 h-10 text-gold" />
                    </div>
                  )}
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Profile Photo</p>
                  <p className="text-xs text-muted-foreground mb-3">JPG / PNG, up to 5 MB</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingPhoto}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadProfileImage(f);
                          e.target.value = '';
                        }}
                      />
                      <span className="inline-flex items-center px-3 py-1.5 bg-gold text-black hover:bg-gold/90 rounded-md text-sm font-medium transition-colors">
                        {profileData.profile_image ? 'Change Photo' : 'Upload Photo'}
                      </span>
                    </label>
                    {profileData.profile_image && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadingPhoto}
                        onClick={handleRemoveProfileImage}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
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
                  <Label>Last Working Day</Label>
                  <Input
                    type="date"
                    value={profileData.last_working_date}
                    onChange={(e) => setProfileData({ ...profileData, last_working_date: e.target.value })}
                    disabled={!editMode}
                    min={profileData.doj || undefined}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Barber stops being visible to customers after this date.</p>
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

                {/* On-leave management has moved to the Attendance tab — set leave date-wise from there. */}
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
                              className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-gold/50 transition-all gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm truncate">{service.service_name}</h4>
                                <p className="text-[10px] text-muted-foreground">Base ₹{service.base_price}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-xs text-muted-foreground">₹</span>
                                <Input
                                  type="number"
                                  min="0"
                                  defaultValue={service.barber_price ?? service.base_price ?? 0}
                                  disabled={!service.is_available}
                                  onBlur={(e) => {
                                    const newVal = Number(e.target.value);
                                    const current = Number(service.barber_price ?? service.base_price ?? 0);
                                    if (newVal !== current) handleServicePriceSave(service.id, newVal);
                                  }}
                                  className="w-20 h-8 text-sm"
                                  data-testid={`barber-service-price-${service.id}`}
                                />
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

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <StaffDocumentsTab staffId={staffId} getAuthToken={getAuthToken} />
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
                    existingLoginIds={allLoginIds}
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
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleResetStaffPassword}
                        data-testid="reset-staff-password-btn"
                      >
                        <Shield className="w-4 h-4 mr-2" /> Reset Password
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleToggleStaffAccess}
                        data-testid="toggle-staff-access-btn"
                        className={staffUser.status === 'active'
                          ? 'text-red-500 hover:text-red-600 border-red-500/40'
                          : 'text-green-600 hover:text-green-700 border-green-500/40'}
                      >
                        {staffUser.status === 'active'
                          ? (<><X className="w-4 h-4 mr-2" /> Revoke Access</>)
                          : (<><Check className="w-4 h-4 mr-2" /> Restore Access</>)}
                      </Button>
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

                      <div className="pt-2">
                        <p className="text-sm font-semibold">Section access</p>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border border-border rounded-lg">
                        <Checkbox
                          id="ac_can_access_services"
                          checked={permissions.can_access_services}
                          onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_services: checked })}
                          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                        <Label htmlFor="ac_can_access_services" className="cursor-pointer flex-1">
                          <span className="font-medium">Can see Services &amp; Offerings section</span>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border border-border rounded-lg">
                        <Checkbox
                          id="ac_can_access_gallery"
                          checked={permissions.can_access_gallery}
                          onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_gallery: checked })}
                          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                        <Label htmlFor="ac_can_access_gallery" className="cursor-pointer flex-1">
                          <span className="font-medium">Can see Gallery section</span>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border border-border rounded-lg">
                        <Checkbox
                          id="ac_can_access_staff"
                          checked={permissions.can_access_staff}
                          onCheckedChange={(checked) => setPermissions({
                            ...permissions,
                            can_access_staff: checked,
                            can_view_all_staff: checked ? permissions.can_view_all_staff : false
                          })}
                          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                        <Label htmlFor="ac_can_access_staff" className="cursor-pointer flex-1">
                          <span className="font-medium">Can see Staff Management section</span>
                          <p className="text-xs text-muted-foreground">Sees only their own profile unless "all staff" is granted</p>
                        </Label>
                      </div>

                      {permissions.can_access_staff && (
                        <div className="flex items-center space-x-2 p-3 border border-border rounded-lg ml-6 border-l-2 border-l-gold/40">
                          <Checkbox
                            id="ac_can_view_all_staff"
                            checked={permissions.can_view_all_staff}
                            onCheckedChange={(checked) => setPermissions({ ...permissions, can_view_all_staff: checked })}
                            className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                          />
                          <Label htmlFor="ac_can_view_all_staff" className="cursor-pointer flex-1">
                            <span className="font-medium">Can see all staff details</span>
                            <p className="text-xs text-muted-foreground">If unchecked, only their own profile is visible</p>
                          </Label>
                        </div>
                      )}
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
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => { if (!open && !deleting) setShowDeleteConfirm(false); }}>
        <DialogContent className="max-w-md border-rose-500/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="w-5 h-5" />
              Delete Staff Permanently
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-foreground">
              You are about to delete <strong>{staff?.name || 'this staff member'}</strong>.
            </p>
            <div className="bg-rose-500/10 border border-rose-500/30 rounded p-3 space-y-2">
              <p className="font-semibold text-rose-400">⚠ This action is NOT reversible.</p>
              <ul className="list-disc list-inside text-xs text-rose-300/90 space-y-1">
                <li>All staff data will be permanently removed</li>
                <li>Service mappings, attendance, branch transfers, ratings, notification settings deleted</li>
                <li>Login access (if assigned) will be revoked</li>
                <li className="text-emerald-400/90">
                  Past financial records (salary payments, incentives, transactions) will be PRESERVED for audit
                </li>
              </ul>
            </div>
            <div>
              <Label htmlFor="confirm-delete">Type <code className="px-1 py-0.5 bg-muted rounded text-xs">DELETE</code> to confirm</Label>
              <Input
                id="confirm-delete"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="mt-1"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteStaff}
              disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</> : <><Trash2 className="w-4 h-4 mr-2" /> Delete Permanently</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
