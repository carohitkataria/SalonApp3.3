import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Edit2, XCircle, Calendar, Wallet, User, CheckCircle, Clock, Banknote, Smartphone, CreditCard } from 'lucide-react';
import MembershipBadge from './MembershipBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SoldMembershipManagement({ salonId, getAuthHeaders }) {
  const [soldMemberships, setSoldMemberships] = useState([]);
  const [editingMembership, setEditingMembership] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    wallet_balance: 0,
    expiry_date: '',
    is_active: true
  });
  const [showConfirmPaymentDialog, setShowConfirmPaymentDialog] = useState(false);
  const [confirmingMembership, setConfirmingMembership] = useState(null);
  const [confirmPaymentMode, setConfirmPaymentMode] = useState('cash');

  useEffect(() => {
    if (salonId) {
      fetchSoldMemberships();
    }
  }, [salonId]);

  const fetchSoldMemberships = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/sold-memberships`, {
        headers: getAuthHeaders()
      });
      setSoldMemberships(response.data.memberships || []);
    } catch (error) {
      console.error('Error fetching sold memberships:', error);
    }
  };

  const handleEdit = (membership) => {
    setEditingMembership(membership);
    setEditForm({
      wallet_balance: membership.wallet_balance,
      expiry_date: membership.expiry_date.split('T')[0],
      is_active: membership.is_active
    });
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    const confirmed = window.confirm(
      `⚠️ WARNING: Editing sold memberships affects customer wallets.\n\n` +
      `Customer: ${editingMembership.customer_name}\n` +
      `Current Balance: ₹${editingMembership.wallet_balance}\n` +
      `New Balance: ₹${editForm.wallet_balance}\n\n` +
      `Proceed with changes?`
    );

    if (!confirmed) return;

    try {
      await axios.put(
        `${API}/salons/${salonId}/customer-memberships/${editingMembership.id}`,
        editForm,
        { headers: getAuthHeaders() }
      );
      toast.success('Membership updated successfully');
      setShowEditDialog(false);
      fetchSoldMemberships();
    } catch (error) {
      toast.error('Failed to update membership');
    }
  };

  const handleCancel = async (membershipId, customerName) => {
    const reason = window.prompt(
      `⚠️ Cancel membership for ${customerName}?\n\n` +
      `This is a SOFT cancel — the record is preserved for history but the membership is deactivated.\n\n` +
      `Enter a reason (optional):`,
      ''
    );

    if (reason === null) return; // user cancelled the prompt

    try {
      await axios.post(
        `${API}/salons/${salonId}/customer-memberships/${membershipId}/cancel`,
        { reason: (reason || '').trim() },
        { headers: getAuthHeaders() }
      );
      toast.success('Membership cancelled');
      fetchSoldMemberships();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel membership');
    }
  };

  const handleOpenConfirmPayment = (membership) => {
    setConfirmingMembership(membership);
    setConfirmPaymentMode(membership.payment_mode || 'cash');
    setShowConfirmPaymentDialog(true);
  };

  const handleConfirmMembershipPayment = async () => {
    if (!confirmingMembership) return;

    try {
      await axios.post(
        `${API}/salons/${salonId}/memberships/${confirmingMembership.id}/confirm-payment`,
        { payment_mode: confirmPaymentMode },
        { headers: getAuthHeaders() }
      );
      toast.success('Membership payment confirmed! Wallet credited.');
      setShowConfirmPaymentDialog(false);
      setConfirmingMembership(null);
      fetchSoldMemberships();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to confirm payment');
    }
  };

  // Separate pending and confirmed memberships
  const pendingMemberships = soldMemberships.filter(m => m.payment_confirmed === false);
  const confirmedMemberships = soldMemberships.filter(m => m.payment_confirmed !== false);

  return (
    <div className="space-y-6">
      {/* Pending Confirmations */}
      {pendingMemberships.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Pending Payment Confirmations ({pendingMemberships.length})
          </h3>
          
          <div className="space-y-3">
            {pendingMemberships.map((membership) => (
              <div key={membership.id} className="bg-card border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold">{membership.customer_name}</span>
                      <span className="text-sm text-muted-foreground">({membership.customer_phone})</span>
                      <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded">
                        Pending
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Plan</p>
                        <p className="font-semibold">{membership.membership_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Paid Amount</p>
                        <p className="font-semibold">₹{membership.paid_amount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Credit to Add</p>
                        <p className="font-semibold text-gold">₹{membership.credit_added}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Payment Mode</p>
                        <p className="font-semibold capitalize">{membership.payment_mode}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleOpenConfirmPayment(membership)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancel(membership.id, membership.customer_name)}
                      className="text-red-500 border-red-500 hover:bg-red-500/10"
                    >
                      <XCircle className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmed Memberships */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Sold Memberships</h3>
        
        <div className="space-y-3">
          {confirmedMemberships.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No confirmed memberships yet.</p>
          ) : (
            confirmedMemberships.map((membership) => (
              <div key={membership.id} className="bg-muted/50 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-gold" />
                      <span className="font-semibold">{membership.customer_name}</span>
                      <span className="text-sm text-muted-foreground">({membership.customer_phone})</span>
                      <MembershipBadge tier={membership.tier} color={membership.color} name={membership.membership_name} size="xs" />
                      {!membership.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded">
                          Cancelled
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Plan</p>
                        <p className="font-semibold">{membership.membership_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Wallet Balance</p>
                        <p className="font-semibold text-gold">₹{membership.wallet_balance}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expiry</p>
                        <p className="font-semibold">{new Date(membership.expiry_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(membership)}
                      className="text-blue-500 border-blue-500 hover:bg-blue-500/10"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    {membership.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(membership.id, membership.customer_name)}
                        className="text-red-500 border-red-500 hover:bg-red-500/10"
                      >
                        <XCircle className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Membership</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Wallet Balance (₹)</Label>
              <Input
                type="number"
                value={editForm.wallet_balance}
                onChange={(e) => setEditForm({ ...editForm, wallet_balance: parseFloat(e.target.value) })}
              />
            </div>
            
            <div>
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={editForm.expiry_date}
                onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
              />
            </div>
            
            <Button onClick={handleUpdate} className="w-full bg-gold text-black hover:bg-gold/90">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={showConfirmPaymentDialog} onOpenChange={setShowConfirmPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Confirm Membership Payment
            </DialogTitle>
          </DialogHeader>
          
          {confirmingMembership && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm"><strong>Customer:</strong> {confirmingMembership.customer_name}</p>
                <p className="text-sm"><strong>Plan:</strong> {confirmingMembership.membership_name}</p>
                <p className="text-sm"><strong>Paid:</strong> ₹{confirmingMembership.paid_amount}</p>
                <p className="text-sm"><strong>Credit to Add:</strong> <span className="text-gold font-bold">₹{confirmingMembership.credit_added}</span></p>
              </div>

              <div>
                <Label className="mb-3 block font-semibold">Payment Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'cash', label: 'Cash', icon: Banknote },
                    { value: 'upi', label: 'UPI', icon: Smartphone },
                    { value: 'card', label: 'Card', icon: CreditCard }
                  ].map(mode => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.value}
                        onClick={() => setConfirmPaymentMode(mode.value)}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                          confirmPaymentMode === mode.value
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-border hover:border-green-500/50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${confirmPaymentMode === mode.value ? 'text-green-500' : ''}`} />
                        <span className="text-xs font-medium">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleConfirmMembershipPayment}
                  className="flex-1 bg-green-600 text-white hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm & Credit Wallet
                </Button>
                <Button variant="outline" onClick={() => setShowConfirmPaymentDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
