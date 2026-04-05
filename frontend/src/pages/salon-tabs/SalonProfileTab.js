import { MapPin, Phone, Mail, Clock, Globe, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SalonProfileTab({ salon }) {
  const handleCall = () => {
    window.open(`tel:${salon.phone}`, '_self');
  };

  const handleEmail = () => {
    if (salon.email) {
      window.open(`mailto:${salon.email}`, '_self');
    }
  };

  const handleDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${salon.latitude},${salon.longitude}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-playfair font-bold text-foreground">About Us</h2>
        <p className="text-muted-foreground">Learn more about our salon</p>
      </div>

      {/* Salon Info Card */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Banner */}
        <div className="h-40 bg-gradient-to-r from-gold/30 to-gold/10 flex items-center justify-center">
          {salon.logo_url ? (
            <img 
              src={salon.logo_url}
              alt={salon.salon_name}
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gold/20 flex items-center justify-center border-4 border-white shadow-lg">
              <Scissors className="w-12 h-12 text-gold" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-6">
          <h3 className="text-2xl font-playfair font-bold text-foreground text-center mb-2">
            {salon.salon_name}
          </h3>
          {salon.gender_tag && (
            <p className="text-center text-muted-foreground mb-4">
              {salon.gender_tag} Salon
            </p>
          )}

          {salon.description && (
            <p className="text-muted-foreground text-center mb-6">
              {salon.description}
            </p>
          )}

          {/* Contact Info */}
          <div className="space-y-4">
            {/* Address */}
            <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
              <MapPin className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="text-foreground">{salon.address}</p>
                {salon.city && <p className="text-sm text-muted-foreground">{salon.city}</p>}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <Phone className="w-5 h-5 text-gold flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="text-foreground">{salon.phone}</p>
              </div>
              <Button size="sm" onClick={handleCall} className="bg-gold text-black hover:bg-gold/90">
                Call Now
              </Button>
            </div>

            {/* Email */}
            {salon.email && (
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <Mail className="w-5 h-5 text-gold flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-foreground">{salon.email}</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleEmail}>
                  Email
                </Button>
              </div>
            )}

            {/* Working Hours */}
            <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
              <Clock className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Working Hours</p>
                <p className="text-foreground">
                  {salon.working_hours || 'Monday - Sunday: 9:00 AM - 9:00 PM'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            <Button onClick={handleDirections} className="flex-1 bg-gold text-black hover:bg-gold/90">
              <MapPin className="w-4 h-4 mr-2" />
              Get Directions
            </Button>
            <Button onClick={handleCall} variant="outline" className="flex-1">
              <Phone className="w-4 h-4 mr-2" />
              Call Salon
            </Button>
          </div>
        </div>
      </div>

      {/* Map Preview */}
      {salon.latitude && salon.longitude && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h4 className="font-bold text-foreground">Location</h4>
          </div>
          <div className="h-64 bg-muted">
            <iframe
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0 }}
              src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${salon.latitude},${salon.longitude}&zoom=15`}
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
}
