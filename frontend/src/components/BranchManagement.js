import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, Edit, Star, MapPin, Phone, Mail, QrCode,
  Download, Power, PowerOff, Save, X, Loader2, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useSubscription, parseSubscriptionError } from '@/contexts/SubscriptionContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const emptyForm = {
  branch_name: '',
  branch_code: '',
  address: '',
  city: '',
  latitude: '',
  longitude: '',
  phone: '',
  email: '',
  is_main_branch: false,
};

export default function BranchManagement({ salonId }) {
  const { getSalonUserHeaders, isAdmin, isBranchManager } = useAuth();
  const { branches, refreshBranches, selectedBranchId, setSelectedBranchId } = useBranch();
  const { openPaywall, isPremium } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [qrDialog, setQrDialog] = useState(null); // { qr_code, booking_url, branch_name }
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (salonId) {
      setLoading(true);
      refreshBranches(salonId).finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);

  const openCreate = () => {
    // Pre-emptive paywall: any branch creation on free plan is blocked
    if (!isPremium) {
      openPaywall({
        limit_type: 'max_branches',
        message: 'Free plan does not allow multiple branches. Upgrade to SalonHub Pro to add branches.',
      });
      return;
    }
    setEditingBranch(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (branch) => {
    setEditingBranch(branch);
    setForm({
      branch_name: branch.branch_name || '',
      branch_code: branch.branch_code || '',
      address: branch.address || '',
      city: branch.city || '',
      latitude: branch.latitude ?? '',
      longitude: branch.longitude ?? '',
      phone: branch.phone || '',
      email: branch.email || '',
      is_main_branch: !!branch.is_main_branch,
    });
    setShowDialog(true);
  };

  const submit = async () => {
    if (!form.branch_name?.trim()) {
      toast.error('Branch name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        branch_name: form.branch_name.trim(),
        branch_code: form.branch_code?.trim() || null,
        address: form.address?.trim() || null,
        city: form.city?.trim() || null,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        is_main_branch: !!form.is_main_branch,
      };

      if (editingBranch) {
        await axios.put(
          `${API}/salons/${salonId}/branches/${editingBranch.id}`,
          payload,
          { headers: getSalonUserHeaders() }
        );
        toast.success('Branch updated');
      } else {
        await axios.post(
          `${API}/salons/${salonId}/branches`,
          payload,
          { headers: getSalonUserHeaders() }
        );
        toast.success('Branch created');
      }
      setShowDialog(false);
      await refreshBranches(salonId);
    } catch (e) {
      const subErr = parseSubscriptionError(e);
      if (subErr) {
        setShowDialog(false);
        openPaywall(subErr);
        return;
      }
      toast.error(e?.response?.data?.detail || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const setAsMain = async (branch) => {
    if (branch.is_main_branch) return;
    try {
      await axios.post(
        `${API}/salons/${salonId}/branches/${branch.id}/set-main`,
        {},
        { headers: getSalonUserHeaders() }
      );
      toast.success(`${branch.branch_name} set as main branch`);
      await refreshBranches(salonId);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to set main branch');
    }
  };

  const deactivate = async (branch) => {
    if (branch.is_main_branch) {
      toast.error('Cannot deactivate the main branch. Set another branch as main first.');
      return;
    }
    if (!window.confirm(`Deactivate "${branch.branch_name}"? It will be hidden but data preserved.`)) return;
    try {
      await axios.delete(`${API}/salons/${salonId}/branches/${branch.id}`, {
        headers: getSalonUserHeaders(),
      });
      toast.success('Branch deactivated');
      // If the deactivated branch was selected, switch to main.
      if (selectedBranchId === branch.id) {
        const main = branches.find((b) => b.is_main_branch);
        if (main) setSelectedBranchId(main.id);
      }
      await refreshBranches(salonId);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to deactivate branch');
    }
  };

  const showQR = async (branch) => {
    setQrLoading(true);
    try {
      const baseUrl = window.location.origin;
      const res = await axios.get(
        `${API}/salons/${salonId}/branches/${branch.id}/qr-code`,
        { params: { base_url: baseUrl } }
      );
      setQrDialog(res.data);
    } catch (e) {
      toast.error('Failed to generate QR code');
    } finally {
      setQrLoading(false);
    }
  };

  const downloadQR = () => {
    if (!qrDialog?.qr_code) return;
    const link = document.createElement('a');
    link.href = qrDialog.qr_code;
    link.download = `branch-${qrDialog.branch_name?.replace(/\s+/g, '-').toLowerCase() || 'qr'}.png`;
    link.click();
  };

  if (!isAdmin() && !isBranchManager?.()) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="branches-no-access">
        Branch management is restricted to salon admins.
      </div>
    );
  }

  const readOnly = !isAdmin();

  return (
    <div className="space-y-6" data-testid="branch-management">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-playfair font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-gold" />
            Branches
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all locations of this salon. Each branch has its own staff, queue & QR code.
          </p>
        </div>
        <Button
          data-testid="add-branch-btn"
          onClick={openCreate}
          disabled={readOnly}
          className="bg-gold text-black hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Branch
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No branches yet. Add your first branch.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {branches.map((branch) => (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`bg-card border rounded-xl p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow ${
                  branch.is_main_branch
                    ? 'border-gold/60 ring-1 ring-gold/30'
                    : 'border-border'
                }`}
                data-testid={`branch-card-${branch.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg truncate">{branch.branch_name}</h3>
                      {branch.is_main_branch && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold bg-gold/20 text-gold border border-gold/40">
                          <Star className="w-3 h-3" /> Main
                        </span>
                      )}
                      {branch.status === 'inactive' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold bg-red-500/20 text-red-500 border border-red-500/40">
                          Inactive
                        </span>
                      )}
                    </div>
                    {branch.branch_code && (
                      <p className="text-xs text-muted-foreground mt-1">Code: {branch.branch_code}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  {branch.address && (
                    <p className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{branch.address}{branch.city ? `, ${branch.city}` : ''}</span>
                    </p>
                  )}
                  {branch.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{branch.phone}</span>
                    </p>
                  )}
                  {branch.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{branch.email}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(branch)}
                    disabled={readOnly}
                    data-testid={`edit-branch-${branch.id}`}
                  >
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => showQR(branch)}
                    data-testid={`qr-branch-${branch.id}`}
                    disabled={qrLoading}
                  >
                    <QrCode className="w-3 h-3 mr-1" /> QR
                  </Button>
                  {!branch.is_main_branch && branch.status === 'active' && !readOnly && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAsMain(branch)}
                      data-testid={`set-main-${branch.id}`}
                    >
                      <Star className="w-3 h-3 mr-1" /> Set Main
                    </Button>
                  )}
                  {!branch.is_main_branch && branch.status === 'active' && !readOnly && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:bg-red-500/10"
                      onClick={() => deactivate(branch)}
                      data-testid={`deactivate-branch-${branch.id}`}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Deactivate
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg" data-testid="branch-form-dialog">
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <Label htmlFor="branch_name">Branch Name *</Label>
              <Input
                id="branch_name"
                data-testid="branch-name-input"
                value={form.branch_name}
                onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
                placeholder="e.g. Whitefield Branch"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="branch_code">Branch Code</Label>
                <Input
                  id="branch_code"
                  data-testid="branch-code-input"
                  value={form.branch_code}
                  onChange={(e) => setForm({ ...form, branch_code: e.target.value })}
                  placeholder="BLR-WF"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Bangalore"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Full address"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91…"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={form.is_main_branch}
                onChange={(e) => setForm({ ...form, is_main_branch: e.target.checked })}
                data-testid="branch-is-main-checkbox"
              />
              <span className="text-sm">Set as Main Branch</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={saving}
              data-testid="branch-save-btn"
              className="bg-gold text-black hover:bg-gold-hover"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editingBranch ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!qrDialog} onOpenChange={(o) => !o && setQrDialog(null)}>
        <DialogContent className="max-w-md" data-testid="branch-qr-dialog">
          <DialogHeader>
            <DialogTitle>{qrDialog?.branch_name} – Booking QR</DialogTitle>
          </DialogHeader>
          {qrDialog && (
            <div className="text-center space-y-3">
              <div className="bg-white p-6 rounded-lg inline-block">
                <img
                  src={qrDialog.qr_code}
                  alt="Branch QR"
                  className="w-64 h-64 mx-auto"
                  data-testid="branch-qr-image"
                />
              </div>
              <p className="text-xs text-muted-foreground break-all px-4">{qrDialog.booking_url}</p>
              <Button
                onClick={downloadQR}
                data-testid="branch-qr-download"
                className="bg-gold text-black hover:bg-gold-hover"
              >
                <Download className="w-4 h-4 mr-2" /> Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
