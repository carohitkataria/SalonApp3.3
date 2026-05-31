import React, { createContext, useContext, useCallback } from 'react';

/**
 * BookingIntentContext
 * --------------------
 * Stores an in-progress booking selection (salon, branch, services, barber,
 * date, shift, etc.) in `sessionStorage` with a 30-minute TTL so the customer
 * can sign-in mid-flow without losing their selections.
 *
 * Shape of the stored intent:
 *   {
 *     salon_id: string,
 *     branch_id?: string,
 *     services: string[],            // service IDs
 *     barber_id?: string,            // or "any"
 *     date?: string,                 // YYYY-MM-DD
 *     shift?: string,                // Morning / Noon / Evening
 *     return_to: string,             // path to navigate back to after sign-in
 *     ts: number                     // ms epoch — used for TTL expiry
 *   }
 */

const STORAGE_KEY = 'salon_booking_intent';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

const BookingIntentContext = createContext(null);

const readIntent = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.ts || Date.now() - parsed.ts > TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const BookingIntentProvider = ({ children }) => {
  const saveIntent = useCallback((intent) => {
    if (!intent || typeof intent !== 'object') return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...intent, ts: Date.now() })
      );
    } catch { /* ignore quota errors */ }
  }, []);

  const getIntent = useCallback(() => readIntent(), []);

  const clearIntent = useCallback(() => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }, []);

  return (
    <BookingIntentContext.Provider value={{ saveIntent, getIntent, clearIntent }}>
      {children}
    </BookingIntentContext.Provider>
  );
};

export const useBookingIntent = () => {
  const ctx = useContext(BookingIntentContext);
  if (!ctx) {
    // Soft-fail: still return a no-op API so consumers can mount even if the
    // provider hasn't been added yet (e.g., during stand-alone tests).
    return {
      saveIntent: () => {},
      getIntent: () => null,
      clearIntent: () => {},
    };
  }
  return ctx;
};
