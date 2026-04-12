import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Users, Search, ArrowLeft, Plus, Calendar, Package, Percent, IndianRupee, Save, Crown, Wallet, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MembershipManagement from './MembershipManagement';
import SellMembershipModal from './SellMembershipModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerMaster({ salonId, getAuthHeaders }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerBookings, setCustomerBookings] = useState([]);
  const [customerPackages, setCustomerPackages] = useState([]);
  const [customerMembership, setCustomerMembership] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showMembershipManagement, setShowMembershipManagement] = useState(false);
  const [services, setServices] = useState([]);
  
  const [packageForm, setPackageForm] = useState({
    package_name: '',
    services: [],
    discount_percentage: 0,
    final_amount: null,  // New: manual final amount override
    pricing_mode: 'discount', // 'discount' or 'manual'
    notes: ''
  });

  useEffect(() => {
    if (salonId) {
      fetchCustomers();
      fetchServices();
    }
  }, [salonId]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerBookings(selectedCustomer.phone);
      fetchCustomerPackages(selectedCustomer.phone);
      fetchCustomerMembership(selectedCustomer.phone);
    }
  }, [selectedCustomer]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/salons/${salonId}/customers`, {
        headers: getAuthHeaders()
      });
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerBookings = async (phone) => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/customers/${phone}/bookings`, {
        headers: getAuthHeaders()
      });
      setCustomerBookings(response.data.bookings || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const fetchCustomerPackages = async (phone) => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/customer-packages/${phone}`, {
        headers: getAuthHeaders()
      });
      setCustomerPackages(response.data.packages || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const fetchCustomerMembership = async (phone) => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/customer-membership/${phone}`);
      if (response.data.has_membership) {
        setCustomerMembership(response.data);
      } else {
        setCustomerMembership(null);
      }
    } catch (error) {
      console.error('Error fetching membership:', error);
      setCustomerMembership(null);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/services/enabled`);
      setServices(response.data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleRebook = async (booking) => {
    // Navigate to booking page with pre-filled data
    const bookingData = {
      barber_id: booking.barber_id,
      services: booking.selected_services,
      customer_name: booking.customer_name,
      phone: booking.phone
    };
    
    localStorage.setItem('rebooking_data', JSON.stringify(bookingData));
    toast.success('Booking data loaded! Redirecting to booking page...');
    setTimeout(() => {
      window.location.href = `/book/${salonId}`;
    }, 1000);
  };

  const toggleServiceSelection = (serviceId) => {
    setPackageForm(prev => {
      const services = prev.services.includes(serviceId)
        ? prev.services.filter(id => id !== serviceId)
        : [...prev.services, serviceId];
      return { ...prev, services };
    });
  };

  const calculatePackageTotal = () => {
    const selectedServices = services.filter(s => packageForm.services.includes(s.id));
    const total = selectedServices.reduce((sum, s) => sum + (s.price || s.base_price || 0), 0);
    const discount = (total * packageForm.discount_percentage) / 100;
    return {
      original: total,
      discount: discount,
      final: total - discount
    };
  };

  const handleCreatePackage = async () => {
    if (!packageForm.package_name || packageForm.services.length === 0) {
      toast.error('Please enter package name and select at least one service');
      return;
    }

    try {
      const selectedServices = services.filter(s => packageForm.services.includes(s.id));
      const totals = calculatePackageTotal();
      
      // Calculate final price based on pricing mode
      let finalPrice;
      if (packageForm.pricing_mode === 'manual' && packageForm.final_amount !== null) {
        finalPrice = packageForm.final_amount;
      } else {
        finalPrice = totals.final;
      }
      
      // Calculate discount percentage for display
      const discountPercentage = packageForm.pricing_mode === 'manual' && packageForm.final_amount !== null
        ? ((totals.original - packageForm.final_amount) / totals.original * 100)
        : packageForm.discount_percentage;
      
      const packageData = {
        salon_id: salonId,
        customer_phone: selectedCustomer.phone,
        customer_name: selectedCustomer.name,
        package_name: packageForm.package_name,
        services: selectedServices.map(s => ({
          service_id: s.id,
          service_name: s.service_name,
          original_price: s.price || s.base_price || 0,
          discounted_price: (s.price || s.base_price || 0) * (1 - discountPercentage / 100)
        })),
        total_original: totals.original,
        discount_percentage: discountPercentage,
        total_discounted: finalPrice,
        pricing_mode: packageForm.pricing_mode,
        notes: packageForm.notes
      };

      await axios.post(
        `${API}/salons/${salonId}/customer-packages`,
        packageData,
        { headers: getAuthHeaders() }
      );

      toast.success('Custom package created successfully');
      setShowPackageForm(false);
      setPackageForm({
        package_name: '',
        services: [],
        discount_percentage: 0,
        final_amount: null,
        pricing_mode: 'discount',
        notes: ''
      });
      fetchCustomerPackages(selectedCustomer.phone);
    } catch (error) {
      toast.error('Failed to create package');
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  // Show membership management view
  if (showMembershipManagement) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMembershipManagement(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>
            <h2 className="text-2xl font-bold">Membership Plans</h2>
          </div>
        </div>
        <MembershipManagement salonId={salonId} getAuthHeaders={getAuthHeaders} />
      </div>
    );
  }

  if (selectedCustomer) {
    return (
      <div className="space-y-6">
        {/* Customer Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedCustomer(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
              <p className="text-muted-foreground">{selectedCustomer.phone}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowMembershipModal(true)}
              variant="outline"
              className="border-gold text-gold hover:bg-gold/10"
            >
              <Crown className="w-4 h-4 mr-2" />
              Sell Membership
            </Button>
            <Button
              onClick={() => setShowPackageForm(!showPackageForm)}
              className="bg-gold text-black hover:bg-gold/90"
            >
              <Package className="w-4 h-4 mr-2" />
              {showPackageForm ? 'Cancel' : 'Create Custom Package'}
            </Button>
          </div>
        </div>

        {/* Sell Membership Modal */}
        <SellMembershipModal
          isOpen={showMembershipModal}
          onClose={() => setShowMembershipModal(false)}
          customer={selectedCustomer}
          salonId={salonId}
          getAuthHeaders={getAuthHeaders}
          onSuccess={() => {
            fetchCustomerMembership(selectedCustomer.phone);
            toast.success('Membership updated');
          }}
        />

        {/* Customer Membership Display */}
        {customerMembership && (
          <div className="bg-gradient-to-br from-gold/10 to-gold/5 border-2 border-gold/30 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gold/20 rounded-full">
                  <Crown className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{customerMembership.membership_name} Member</h3>
                  <p className="text-sm text-muted-foreground">
                    Expires: {new Date(customerMembership.expiry_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Wallet Balance</p>
                <p className="text-3xl font-bold text-gold">₹{customerMembership.wallet_balance}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gold/20">
              <div>
                <p className="text-xs text-muted-foreground">Purchased</p>
                <p className="text-sm font-semibold">
                  {new Date(customerMembership.purchased_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Mode</p>
                <p className="text-sm font-semibold capitalize">{customerMembership.payment_mode}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount Paid</p>
                <p className="text-sm font-semibold">₹{customerMembership.paid_amount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Custom Package Form */}
        <AnimatePresence>
          {showPackageForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-lg p-6 space-y-4"
            >
              <h3 className="font-semibold text-lg">Create Custom Package</h3>
              
              <div>
                <Label htmlFor="package_name">Package Name *</Label>
                <Input
                  id="package_name"
                  value={packageForm.package_name}
                  onChange={(e) => setPackageForm({ ...packageForm, package_name: e.target.value })}
                  placeholder="e.g., Premium Hair Care"
                />
              </div>

              <div>
                <Label className="mb-3 block">Select Services *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {services.map(service => (
                    <div
                      key={service.id}
                      className="flex items-center space-x-2 p-2 border rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleServiceSelection(service.id)}
                    >
                      <Checkbox
                        checked={packageForm.services.includes(service.id)}
                        onCheckedChange={() => toggleServiceSelection(service.id)}
                        className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{service.service_name}</p>
                        <p className="text-xs text-muted-foreground">₹{service.price || service.base_price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Mode Selector */}
              <div className="border border-border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="font-semibold">Pricing Method:</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={packageForm.pricing_mode === 'discount'}
                        onChange={() => setPackageForm({ ...packageForm, pricing_mode: 'discount', final_amount: null })}
                        className="text-gold"
                      />
                      <span className="text-sm">Discount %</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={packageForm.pricing_mode === 'manual'}
                        onChange={() => setPackageForm({ ...packageForm, pricing_mode: 'manual', discount_percentage: 0 })}
                        className="text-gold"
                      />
                      <span className="text-sm">Manual Amount</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {packageForm.pricing_mode === 'discount' ? (
                    <div>
                      <Label htmlFor="discount">Discount Percentage</Label>
                      <div className="flex items-center">
                        <Input
                          id="discount"
                          type="number"
                          min="0"
                          max="100"
                          value={packageForm.discount_percentage}
                          onChange={(e) => setPackageForm({ ...packageForm, discount_percentage: parseFloat(e.target.value) || 0 })}
                        />
                        <Percent className="w-4 h-4 ml-2 text-muted-foreground" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="final_amount">Final Amount (₹)</Label>
                      <Input
                        id="final_amount"
                        type="number"
                        min="0"
                        value={packageForm.final_amount || ''}
                        onChange={(e) => setPackageForm({ ...packageForm, final_amount: parseFloat(e.target.value) || null })}
                        placeholder="Enter custom price"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Original total: ₹{calculatePackageTotal().original.toFixed(2)}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>Package Summary</Label>
                    <div className="p-3 bg-muted rounded-lg space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Original Total:</span>
                        <span>₹{calculatePackageTotal().original.toFixed(2)}</span>
                      </div>
                      {packageForm.pricing_mode === 'discount' && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount ({packageForm.discount_percentage}%):</span>
                          <span>- ₹{calculatePackageTotal().discount.toFixed(2)}</span>
                        </div>
                      )}
                      {packageForm.pricing_mode === 'manual' && packageForm.final_amount !== null && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount:</span>
                          <span>- ₹{(calculatePackageTotal().original - packageForm.final_amount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-gold border-t pt-1">
                        <span>Final Total:</span>
                        <span>₹{
                          packageForm.pricing_mode === 'manual' && packageForm.final_amount !== null
                            ? packageForm.final_amount.toFixed(2)
                            : calculatePackageTotal().final.toFixed(2)
                        }</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={packageForm.notes}
                  onChange={(e) => setPackageForm({ ...packageForm, notes: e.target.value })}
                  placeholder="Any special notes..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowPackageForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePackage}
                  className="bg-gold text-black hover:bg-gold/90"
                  disabled={!packageForm.package_name || packageForm.services.length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Create Package
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Customer Packages */}
        {customerPackages.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4">Custom Packages</h3>
            <div className="space-y-3">
              {customerPackages.map(pkg => (
                <div key={pkg.id} className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold">{pkg.package_name}</h4>
                      <p className="text-sm text-muted-foreground">{pkg.services.length} services</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm line-through text-muted-foreground">₹{pkg.total_original}</p>
                      <p className="text-lg font-bold text-gold">₹{pkg.total_discounted}</p>
                      <p className="text-xs text-green-600">{pkg.discount_percentage}% off</p>
                    </div>
                  </div>
                  {pkg.notes && (
                    <p className="text-xs text-muted-foreground mt-2">Note: {pkg.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Previous Bookings */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Booking History ({customerBookings.length})</h3>
          <div className="space-y-3">
            {customerBookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No bookings found</p>
            ) : (
              customerBookings.map(booking => (
                <div key={booking.id} className="p-4 border rounded-lg hover:border-gold transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          booking.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                          booking.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-500' :
                          booking.status === 'cancelled' ? 'bg-red-500/20 text-red-500' :
                          'bg-blue-500/20 text-blue-500'
                        }`}>
                          {booking.status}
                        </span>
                        <span className="text-sm text-muted-foreground">Token: {booking.token_number}</span>
                      </div>
                      <p className="font-medium">{booking.barber_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(booking.created_at).toLocaleDateString()} - {booking.shift}
                      </p>
                      <p className="text-sm mt-1">
                        {booking.selected_services?.length || 0} service(s) - ₹{booking.total_amount}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRebook(booking)}
                      className="bg-gold text-black hover:bg-gold/90"
                    >
                      <Calendar className="w-4 h-4 mr-1" />
                      Rebook
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-gold" />
          <h2 className="text-2xl font-bold">Customer Master</h2>
        </div>
        <Button
          onClick={() => setShowMembershipManagement(true)}
          variant="outline"
          className="border-gold text-gold hover:bg-gold/10"
        >
          <Crown className="w-4 h-4 mr-2" />
          Manage Memberships
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or phone..."
          className="pl-10"
        />
      </div>

      {/* Customer List */}
      <div className="bg-card border border-border rounded-lg">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold mx-auto"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery ? 'No customers found matching your search' : 'No customers yet. Customers who book will appear here.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredCustomers.map((customer, index) => (
              <div
                key={index}
                onClick={() => setSelectedCustomer(customer)}
                className="p-4 hover:bg-muted cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{customer.name}</h3>
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    {customer.gender && (
                      <span className="text-xs px-2 py-0.5 bg-muted rounded mt-1 inline-block">
                        {customer.gender}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="outline">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
