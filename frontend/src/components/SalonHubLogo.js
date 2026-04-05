import React from 'react';

export default function SalonHubLogo({ size = 40, showText = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 60 60" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background Circle */}
        <circle cx="30" cy="30" r="28" fill="currentColor" className="text-gold/20" />
        <circle cx="30" cy="30" r="28" stroke="currentColor" className="text-gold" strokeWidth="2" />
        
        {/* Scissors */}
        <g transform="translate(15, 12)">
          {/* Left Blade */}
          <ellipse cx="6" cy="18" rx="5" ry="14" fill="currentColor" className="text-gold" transform="rotate(-15, 6, 18)" />
          {/* Right Blade */}
          <ellipse cx="24" cy="18" rx="5" ry="14" fill="currentColor" className="text-gold" transform="rotate(15, 24, 18)" />
          {/* Center Ring */}
          <circle cx="15" cy="20" r="6" fill="currentColor" className="text-background" />
          <circle cx="15" cy="20" r="4" stroke="currentColor" className="text-gold" strokeWidth="2" fill="none" />
          {/* Handle Holes */}
          <circle cx="6" cy="30" r="3" stroke="currentColor" className="text-gold" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
          <circle cx="24" cy="30" r="3" stroke="currentColor" className="text-gold" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
        </g>
      </svg>
      
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="text-xl font-playfair font-bold text-gold tracking-tight">
            Salon<span className="text-foreground">Hub</span>
          </span>
        </div>
      )}
    </div>
  );
}

// Simple text-only version for headers
export function SalonHubText({ className = '' }) {
  return (
    <span className={`font-playfair font-bold text-gold ${className}`}>
      Salon<span className="text-foreground">Hub</span>
    </span>
  );
}
