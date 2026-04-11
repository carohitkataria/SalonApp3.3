import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Crown, Plus, Edit2, Trash2, Save, X, DollarSign, Calendar, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MembershipManagement({ salonId, getAuthHeaders }) {
  const [plans, setPlans] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    credit: '',
    validity_months: '',
    terms_conditions: ''
  });

  useEffect(() => {
    if (salonId) {
      fetchPlans();
    }
  }, [salonId]);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/membership-plans`);
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load membership plans');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.amount || !formData.credit || !formData.validity_months) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const payload = {
        salon_id: salonId,
        name: formData.name,
        amount: parseFloat(formData.amount),
        credit: parseFloat(formData.credit),
        validity_months: parseInt(formData.validity_months),
        terms_conditions: formData.terms_conditions || 'Standard terms and conditions apply.'
      };

      await axios.post(`${API}/salons/${salonId}/membership-plans`, payload, {
        headers: getAuthHeaders()
      });

      toast.success('Membership plan created successfully');
      resetForm();
      fetchPlans();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create plan');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      amount: '',
      credit: '',
      validity_months: '',
      terms_conditions: ''
    });
    setShowForm(false);
    setEditingPlan(null);
  };

  const calculateDiscount = () => {
    if (!formData.amount || !formData.credit) return 0;
    const amount = parseFloat(formData.amount);
    const credit = parseFloat(formData.credit);
    return ((credit - amount) / amount * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Crown className="w-6 h-6 text-gold" />
          <h2 className="text-2xl font-bold">Membership Plans</h2>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-gold text-black hover:bg-gold/90"
        >
          {showForm ? (
            <>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
            </>
          )}
        </Button>
      </div>

      {/* Create/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-lg p-6"
          >
            <h3 className="text-lg font-semibold mb-4">
              {editingPlan ? 'Edit Membership Plan' : 'Create New Membership Plan'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Membership Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Gold, Diamond, Platinum"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="validity">Validity (Months) *</Label>
                  <Input
                    id="validity"
                    type="number"
                    min="1"
                    value={formData.validity_months}
                    onChange={(e) => setFormData({ ...formData, validity_months: e.target.value })}
                    placeholder="e.g., 3, 6, 12"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="amount">Amount to Pay (₹) *</Label>
                  <div className="flex items-center">
                    <span className="text-sm mr-2">₹</span>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="e.g., 5000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="credit">Wallet Credit (₹) *</Label>
                  <div className="flex items-center">
                    <span className="text-sm mr-2">₹</span>
                    <Input
                      id="credit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.credit}
                      onChange={(e) => setFormData({ ...formData, credit: e.target.value })}
                      placeholder="e.g., 6000"
                      required
                    />
                  </div>
                  {formData.amount && formData.credit && parseFloat(formData.credit) > parseFloat(formData.amount) && (
                    <p className="text-xs text-green-600 mt-1">
                      +{calculateDiscount()}% extra value
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="tc">Terms & Conditions</Label>
                <Textarea
                  id="tc"
                  value={formData.terms_conditions}
                  onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                  placeholder="Enter terms and conditions..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Preview */}
              {formData.name && formData.amount && formData.credit && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-lg">{formData.name} Membership</h4>
                      <p className="text-sm text-muted-foreground">
                        Valid for {formData.validity_months} month(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gold">₹{formData.credit}</p>
                      <p className="text-sm text-muted-foreground">Pay ₹{formData.amount}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gold text-black hover:bg-gold/90">
                  <Save className="w-4 h-4 mr-2" />
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plans List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-card border border-border rounded-lg">
            <Crown className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No membership plans yet</p>
            <p className="text-sm text-muted-foreground mt-2">Create your first membership plan</p>
          </div>
        ) : (
          plans.map(plan => (
            <motion.div
              key={plan.id}
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-gold/10 to-gold/5 border-2 border-gold/30 rounded-xl p-6 relative overflow-hidden"
            >
              {/* Crown Icon */}
              <div className="absolute top-2 right-2">
                <Crown className="w-8 h-8 text-gold/30" />
              </div>

              <div className="mb-4">
                <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {plan.validity_months} month(s)
                </p>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Customer Pays:</span>
                  <span className="font-semibold">₹{plan.amount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Wallet Credit:</span>
                  <span className="text-xl font-bold text-gold">₹{plan.credit}</span>
                </div>
                {plan.credit > plan.amount && (
                  <div className="flex justify-between items-center pt-2 border-t border-gold/20">
                    <span className="text-sm text-green-600">Extra Value:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{((plan.credit - plan.amount) / plan.amount * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {plan.terms_conditions && (
                <div className="mb-4">
                  <details className="cursor-pointer">
                    <summary className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Terms & Conditions
                    </summary>
                    <p className="text-xs text-muted-foreground mt-2 pl-4">
                      {plan.terms_conditions}
                    </p>
                  </details>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditingPlan(plan);
                    setFormData({
                      name: plan.name,
                      amount: plan.amount,
                      credit: plan.credit,
                      validity_months: plan.validity_months,
                      terms_conditions: plan.terms_conditions || ''
                    });
                    setShowForm(true);
                  }}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => {
                    // TODO: Implement delete
                    toast.info('Delete functionality coming soon');
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
