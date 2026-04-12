// Session Manager for Salon Login Persistence

const SESSION_KEY = 'salon_session';
const SESSION_EXPIRY_DAYS = 7;

export const saveSession = (token, salonId, role, userId, permissions = {}) => {
  const session = {
    token,
    salonId,
    role,
    userId,
    permissions,
    expiresAt: new Date().getTime() + (SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem('salon_admin_token', token);
  localStorage.setItem('salon_id', salonId);
};

export const getSession = () => {
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    
    const session = JSON.parse(sessionData);
    
    // Check if session expired
    if (session.expiresAt && new Date().getTime() > session.expiresAt) {
      clearSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error reading session:', error);
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('salon_admin_token');
  localStorage.removeItem('salon_id');
  localStorage.removeItem('salon_user_auth');
};

export const isSessionValid = () => {
  const session = getSession();
  return session !== null && session.token && session.salonId;
};
