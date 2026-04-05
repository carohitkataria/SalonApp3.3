import { ShoppingBag, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SalonShopTab({ salonId }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-playfair font-bold text-foreground">Shop</h2>
        <p className="text-muted-foreground">Buy products from this salon</p>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <div className="w-24 h-24 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-12 h-12 text-gold" />
        </div>
        
        <h3 className="text-2xl font-playfair font-bold text-foreground mb-2">
          Coming Soon
        </h3>
        
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          We're working on bringing you an amazing shopping experience. 
          Soon you'll be able to purchase premium grooming products directly from this salon.
        </p>

        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Launching soon</span>
        </div>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="p-4 bg-background rounded-lg border border-border">
            <div className="text-2xl mb-2">🧴</div>
            <p className="text-sm font-medium text-foreground">Hair Care</p>
            <p className="text-xs text-muted-foreground">Shampoos, Oils & More</p>
          </div>
          <div className="p-4 bg-background rounded-lg border border-border">
            <div className="text-2xl mb-2">✨</div>
            <p className="text-sm font-medium text-foreground">Styling Products</p>
            <p className="text-xs text-muted-foreground">Gels, Wax & Sprays</p>
          </div>
          <div className="p-4 bg-background rounded-lg border border-border">
            <div className="text-2xl mb-2">🎁</div>
            <p className="text-sm font-medium text-foreground">Gift Sets</p>
            <p className="text-xs text-muted-foreground">Curated Collections</p>
          </div>
        </div>
      </div>
    </div>
  );
}
