import React from 'react';

/**
 * SalonHub luxury wordmark + monogram.
 * Refined: a circle-inscribed "S" with a single hairline scissor-blade flourish,
 * rendered in brass on whatever surface it sits on.
 */
export default function SalonHubLogo({ size = 40, showText = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SalonHub"
      >
        {/* Outer hairline ring */}
        <circle cx="32" cy="32" r="30" stroke="currentColor" className="text-brass" strokeWidth="1.25" fill="none" />
        {/* Inner faint ring */}
        <circle cx="32" cy="32" r="26" stroke="currentColor" className="text-brass/30" strokeWidth="0.75" fill="none" />

        {/* Scissor blades — minimal, ribbon-like */}
        <path
          d="M22 18 L34 32 L22 46"
          stroke="currentColor"
          className="text-brass"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M42 18 L30 32 L42 46"
          stroke="currentColor"
          className="text-brass"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Pivot dot */}
        <circle cx="32" cy="32" r="1.8" fill="currentColor" className="text-brass" />

        {/* Handle holes */}
        <circle cx="22" cy="18" r="2.5" stroke="currentColor" className="text-brass" strokeWidth="1" fill="none" />
        <circle cx="42" cy="18" r="2.5" stroke="currentColor" className="text-brass" strokeWidth="1" fill="none" />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-fraunces text-[20px] font-semibold tracking-tight text-foreground">
            Salon<span className="text-brass italic">hub</span>
          </span>
          <span className="eyebrow mt-1 text-[8px]">Luxury · Booking · Live Queue</span>
        </div>
      )}
    </div>
  );
}

// Simple text-only version for headers
export function SalonHubText({ className = '' }) {
  return (
    <span className={`font-fraunces font-semibold text-foreground ${className}`}>
      Salon<span className="text-brass italic">hub</span>
    </span>
  );
}
