import React from 'react';
import { Button } from '@/components/ui/button';

/**
 * Emergent-managed Google OAuth login button.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
 * THIS BREAKS THE AUTH.
 *
 * Usage:
 *   <GoogleLoginButton audience="customer" />
 *
 * Audience must be one of: 'customer' | 'salon' | 'platform' | 'supplier'.
 * After the user signs in with Google, Emergent redirects back to
 *   `${window.location.origin}/auth/callback?aud=${audience}`
 * with `#session_id=...` appended. The AuthCallback page then exchanges that
 * session_id for a JWT via POST `/api/auth/google`.
 */
export default function GoogleLoginButton({
  audience,
  label = 'Continue with Google',
  className = '',
}) {
  const handleClick = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
    // THIS BREAKS THE AUTH.
    const redirectUrl = `${window.location.origin}/auth/callback?aud=${audience}`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      data-testid={`google-login-${audience}-btn`}
      className={`w-full h-11 rounded-full border-border bg-background hover:bg-muted text-foreground flex items-center justify-center gap-2 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.5 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.7 0 19.5-7.8 19.5-19.5 0-1.2-.1-2.4-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.5 29.1 4.5 24 4.5 16.3 4.5 9.7 8.6 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-5c-1.9 1.3-4.3 2-6.9 2-5.3 0-9.7-3-11.3-7l-6.5 5C9.4 39.4 16.1 43.5 24 43.5z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.5-2.5 4.6-4.7 6l6 5c4-3.7 6.5-9 6.5-15 0-1.2-.1-2.4-.4-3.5z"/>
      </svg>
      <span className="text-sm font-medium">{label}</span>
    </Button>
  );
}
