import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Edit2, XCircle, Calendar, Wallet, User } from 'lucide-react';

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
    const confirmed = window.confirm(
      `⚠️ Cancel membership for ${customerName}?\n\n` +
      `This will deactivate the membership but retain wallet balance history.`
    );

    if (!confirmed) return;

    try {
      await axios.put(
        `${API}/salons/${salonId}/customer-memberships/${membershipId}`,
        { is_active: false },
        { headers: getAuthHeaders() }
      );
      toast.success('Membership cancelled');
      fetchSoldMemberships();
    } catch (error) {
      toast.error('Failed to cancel membership');
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">Sold Memberships</h3>
      
      <div className="space-y-3">
        {soldMemberships.map((membership) => (
          <div key={membership.id} className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-gold" />
                  <span className="font-semibold">{membership.customer_name}</span>
                  <span className="text-sm text-muted-foreground">({membership.customer_phone})</span>
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
        ))}
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
    </div>
  );
}
