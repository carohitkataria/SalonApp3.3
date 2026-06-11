import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { MapPin, Edit2, Save, X, QrCode, Download, Copy, Trash2, Navigation } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const FRONTEND_URL = window.location.origin;

export default function MyProfile({ salon, onUpdate, getAuthHeaders, onDeleteSalon }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(salon || {});
  const [saving, setSaving] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const qrRef = useRef(null);

  // QR Code URL - direct to booking page with defaults
  const bookingUrl = salon ? `${FRONTEND_URL}/book/${salon.id}?source=qr&for=self&when=today` : '';

  useEffect(() => {
    if (salon) {
      setEditData(salon);
    }
  }, [salon]);

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 512, 512);
      
      const link = document.createElement('a');
      link.download = `${salon.salon_name.replace(/\s+/g, '_')}_QR.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('QR Code downloaded!');
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast.success('Booking link copied!');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await axios.put(
        `${API}/salons/${salon.id}`,
        editData,
        { headers: getAuthHeaders() }
      );
      
      toast.success('Profile updated successfully');
      setIsEditing(false);
      if (onUpdate) {
        onUpdate(response.data);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData(salon);
    setIsEditing(false);
  };

  const handleDeleteSalon = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    setDeleting(true);
    try {
      await axios.delete(`${API}/salons/${salon.id}`, { headers: getAuthHeaders() });
      toast.success('Salon profile deleted successfully');
      setShowDeleteConfirm(false);
      if (onDeleteSalon) {
        onDeleteSalon();
      }
    } catch (error) {
      console.error('Error deleting salon:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete salon profile');
    } finally {
      setDeleting(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    toast.info('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setEditData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        toast.success('Location updated!');
      },
      (error) => {
        toast.error('Failed to get location. Please enter manually.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const getTaxRateLabel = (rate) => {
    if (rate === 0) return '0% (No GST)';
    if (rate === 2.5) return '5% (2.5% CGST + 2.5% SGST)';
    if (rate === 9) return '18% (9% CGST + 9% SGST)';
    return `${rate * 2}%`;
  };

  if (!salon) {
    return (
      <div className="bg-card border border-border rounded-lg p-8">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-card-foreground flex items-center">
          <MapPin className="w-5 h-5 mr-2 text-gold" />
          My Profile
        </h3>
        <div className="flex space-x-2">
          {!isEditing && (
            <Button
              onClick={() => setShowQRModal(true)}
              variant="outline"
              size="sm"
              className="border-gold text-gold hover:bg-gold/10"
            >
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
            </Button>
          )}
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <>
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                disabled={saving}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-gold text-black hover:bg-gold/90"
                size="sm"
                disabled={saving}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-card-foreground">Booking QR Code</h3>
              <button onClick={() => setShowQRModal(false)} className="p-2 hover:bg-muted rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-center mb-4">
              <p className="text-muted-foreground text-sm mb-4">
                Scan this QR code to book an appointment directly
              </p>
              <div ref={qrRef} className="bg-white p-6 rounded-xl inline-block mb-4">
                <QRCodeSVG 
                  value={bookingUrl} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="font-bold text-foreground">{salon.salon_name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Defaults: Self booking • Today • First available slot
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button
                onClick={handleDownloadQR}
                className="flex-1 bg-gold text-black hover:bg-gold/90"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}

      {isEditing ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="salon_name">Salon Name *</Label>
              <Input
                id="salon_name"
                value={editData.salon_name || ''}
                onChange={(e) => setEditData({ ...editData, salon_name: e.target.value })}
                placeholder="Enter salon name"
              />
            </div>
            <div>
              <Label htmlFor="owner_name">Owner Name *</Label>
              <Input
                id="owner_name"
                value={editData.owner_name || ''}
                onChange={(e) => setEditData({ ...editData, owner_name: e.target.value })}
                placeholder="Enter owner name"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                placeholder="Enter phone number"
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">Phone cannot be changed</p>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editData.email || ''}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="logo">Salon Logo</Label>
              <div className="space-y-2">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      toast.error('Logo must be less than 2MB');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setEditData({ ...editData, logo_url: reader.result });
                      toast.success('Logo uploaded');
                    };
                    reader.onerror = () => toast.error('Failed to upload logo');
                    reader.readAsDataURL(file);
                  }}
                />
                <Input
                  placeholder="Or enter logo URL"
                  value={editData.logo_url || ''}
                  onChange={(e) => setEditData({ ...editData, logo_url: e.target.value })}
                />
                {editData.logo_url && (
                  <div className="relative inline-block">
                    <img 
                      src={editData.logo_url} 
                      alt="Salon logo" 
                      className="w-32 h-32 object-contain border border-border rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setEditData({ ...editData, logo_url: '' })}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="gallery">Salon Photo &amp; Video Gallery</Label>
              <div className="space-y-2">
                <Input
                  id="gallery"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;
                    const PHOTO_MAX = 5 * 1024 * 1024;   // 5 MB
                    const VIDEO_MAX = 25 * 1024 * 1024;  // 25 MB
                    const accepted = [];
                    files.forEach(file => {
                      const isVideo = (file.type || '').startsWith('video/');
                      const limit = isVideo ? VIDEO_MAX : PHOTO_MAX;
                      const limitLabel = isVideo ? '25MB (video)' : '5MB (photo)';
                      if (file.size > limit) {
                        toast.error(`${file.name} is too large (max ${limitLabel})`);
                        return;
                      }
                      accepted.push(file);
                    });
                    if (accepted.length === 0) return;
                    let completed = 0;
                    accepted.forEach(file => {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setEditData(prev => ({
                          ...prev,
                          photo_gallery: [...(prev.photo_gallery || []), reader.result]
                        }));
                        completed++;
                        if (completed === accepted.length) {
                          toast.success(`${accepted.length} file(s) uploaded`);
                        }
                      };
                      reader.onerror = () => toast.error(`Failed to upload ${file.name}`);
                      reader.readAsDataURL(file);
                    });
                    try { e.target.value = ''; } catch (err) { /* ignore */ }
                  }}
                />
                <Input
                  placeholder="Or enter image/video URLs (comma-separated)"
                  onChange={(e) => {
                    const urls = e.target.value.split(',').map(url => url.trim()).filter(Boolean);
                    if (urls.length > 0) {
                      setEditData({ ...editData, photo_gallery: urls });
                    }
                  }}
                />
                {editData.photo_gallery && editData.photo_gallery.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {editData.photo_gallery.map((url, index) => {
                      const isVideo = typeof url === 'string' && (url.startsWith('data:video') || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url));
                      return (
                        <div key={`${url}-${index}`} className="relative group">
                          {isVideo ? (
                            <video
                              src={url}
                              className="w-full h-24 object-cover border border-border rounded-lg bg-black"
                              controls
                              muted
                            />
                          ) : (
                            <img
                              src={url}
                              alt={`Gallery ${index + 1}`}
                              className="w-full h-24 object-cover border border-border rounded-lg"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditData({
                                ...editData,
                                photo_gallery: editData.photo_gallery.filter((_, i) => i !== index)
                              });
                            }}
                            className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Photos up to 5MB each • Videos up to 25MB each</p>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={editData.address || ''}
                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                placeholder="Enter salon address"
              />
            </div>
            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={editData.city || ''}
                onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                placeholder="Enter city name"
              />
            </div>
            <div>
              <Label>Location</Label>
              <Button
                type="button"
                onClick={handleUseCurrentLocation}
                variant="outline"
                size="sm"
                className="w-full border-gold/30 hover:bg-gold/10"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Use My Current Location
              </Button>
            </div>
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={editData.latitude || ''}
                onChange={(e) => setEditData({ ...editData, latitude: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 12.9716"
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={editData.longitude || ''}
                onChange={(e) => setEditData({ ...editData, longitude: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 77.5946"
              />
            </div>
            <div>
              <Label htmlFor="upi_id">UPI ID</Label>
              <Input
                id="upi_id"
                value={editData.upi_id || ''}
                onChange={(e) => setEditData({ ...editData, upi_id: e.target.value })}
                placeholder="yourname@upi"
              />
            </div>
            <div>
              <Label htmlFor="payment_timing">Payment Timing</Label>
              <select
                id="payment_timing"
                value={editData.payment_timing || 'after'}
                onChange={(e) => setEditData({ ...editData, payment_timing: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
              >
                <option value="before">Before Service</option>
                <option value="after">After Service</option>
              </select>
            </div>
          </div>

          {/* GST Section */}
          <div className="border-t border-border pt-6">
            <h4 className="font-bold text-card-foreground mb-4">GST Information</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_gst_registered"
                  checked={editData.is_gst_registered || false}
                  onCheckedChange={(checked) => setEditData({ ...editData, is_gst_registered: checked })}
                />
                <label
                  htmlFor="is_gst_registered"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Is GST Registered?
                </label>
              </div>

              {editData.is_gst_registered && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                  <div>
                    <Label htmlFor="gstin">GSTIN *</Label>
                    <Input
                      id="gstin"
                      value={editData.gstin || ''}
                      onChange={(e) => setEditData({ ...editData, gstin: e.target.value.toUpperCase() })}
                      placeholder="Enter GST number (e.g., 29ABCDE1234F1Z5)"
                      maxLength={15}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tax_rate">GST Rate *</Label>
                    <select
                      id="tax_rate"
                      value={editData.tax_rate || 2.5}
                      onChange={(e) => setEditData({ ...editData, tax_rate: parseFloat(e.target.value) })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                    >
                      <option value="0">0% (No GST)</option>
                      <option value="2.5">5% (2.5% CGST + 2.5% SGST)</option>
                      <option value="9">18% (9% CGST + 9% SGST)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Settings Section */}
          <div className="border-t border-border pt-6">
            <h4 className="font-bold text-card-foreground mb-4">Invoice Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
                <Input
                  id="invoice_prefix"
                  value={editData.invoice_prefix || 'INV'}
                  onChange={(e) => setEditData({ ...editData, invoice_prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g., MG37, INV, BILL"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Prefix for invoice numbers (e.g., MG37)
                </p>
              </div>
              <div>
                <Label htmlFor="invoice_start_number">Starting Invoice Number</Label>
                <Input
                  id="invoice_start_number"
                  type="number"
                  value={editData.invoice_start_number || 1}
                  onChange={(e) => setEditData({ ...editData, invoice_start_number: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  min="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Invoice numbering starts from this number
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  <strong>Preview:</strong> {editData.invoice_prefix || 'INV'}{String(editData.current_invoice_number || editData.invoice_start_number || 1).padStart(4, '0')}
                  <br />
                  <span className="text-xs">Next invoice will be numbered as shown above</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {salon.logo_url && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-2">Salon Logo</p>
              <img 
                src={salon.logo_url} 
                alt="Salon logo" 
                className="w-32 h-32 object-contain border border-border rounded-lg"
              />
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground mb-1">Salon Name</p>
            <p className="text-foreground font-bold">{salon.salon_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Owner</p>
            <p className="text-foreground font-bold">{salon.owner_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Phone</p>
            <p className="text-foreground font-bold">{salon.phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Email</p>
            <p className="text-foreground font-bold">{salon.email || 'N/A'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground mb-1">Address</p>
            <p className="text-foreground font-bold">{salon.address}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">City</p>
            <p className="text-foreground font-bold">{salon.city || 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Location</p>
            <p className="text-foreground font-bold">
              {salon.latitude && salon.longitude 
                ? `${salon.latitude.toFixed(4)}, ${salon.longitude.toFixed(4)}`
                : 'Not set'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">UPI ID</p>
            <p className="text-foreground font-bold">{salon.upi_id || 'Not configured'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Payment Timing</p>
            <p className="text-foreground font-bold capitalize">{salon.payment_timing}</p>
          </div>
          
          {/* GST Information (View Mode) */}
          <div className="md:col-span-2 border-t border-border pt-6">
            <h4 className="font-bold text-card-foreground mb-4">GST Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">GST Registered</p>
                <p className="text-foreground font-bold">
                  {salon.is_gst_registered ? (
                    <span className="text-green-500">Yes</span>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </p>
              </div>
              {salon.is_gst_registered && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">GSTIN</p>
                    <p className="text-foreground font-bold">{salon.gstin || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">GST Rate</p>
                    <p className="text-foreground font-bold">{getTaxRateLabel(salon.tax_rate)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Invoice Settings (View Mode) */}
          <div className="md:col-span-2 border-t border-border pt-6">
            <h4 className="font-bold text-card-foreground mb-4">Invoice Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Invoice Prefix</p>
                <p className="text-foreground font-bold">{salon.invoice_prefix || 'INV'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Starting Number</p>
                <p className="text-foreground font-bold">{salon.invoice_start_number || 1}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Invoice Number</p>
                <p className="text-foreground font-bold">
                  {salon.invoice_prefix || 'INV'}{String(salon.current_invoice_number || salon.invoice_start_number || 1).padStart(4, '0')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Profile Section */}
      <div className="mt-8 border-t border-red-500/20 pt-6">
        <h4 className="font-bold text-red-500 mb-2">Danger Zone</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Deleting your salon profile will permanently remove all data including barbers, services, bookings, and ratings. This action cannot be undone.
        </p>
        <Button
          onClick={() => setShowDeleteConfirm(true)}
          variant="outline"
          className="border-red-500 text-red-500 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Salon Profile
        </Button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-500">Delete Salon Profile</h3>
              <button onClick={() => setShowDeleteConfirm(false)} className="p-2 hover:bg-muted rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-foreground mb-2">
                This will permanently delete <strong>{salon.salon_name}</strong> and all associated data:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>All barber profiles</li>
                <li>All service configurations</li>
                <li>All booking/token history</li>
                <li>All customer ratings & reviews</li>
              </ul>
            </div>

            <div className="mb-4">
              <Label className="text-sm text-foreground">Type <strong>DELETE</strong> to confirm:</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="mt-1"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteSalon}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
