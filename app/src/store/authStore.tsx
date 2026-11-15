import React, { createContext, useContext, useState } from 'react';

export interface CustomerUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  role: 'CUSTOMER' | 'OWNER';
}

interface AuthContextValue {
  user: CustomerUser | null;
  isAuthenticated: boolean;
  loginWithPhone: (phoneNumber: string, fullName: string) => void;
  loginWithGoogle: () => void;
  logout: () => void;
}

const STORAGE_KEY = 'pariwisloka_customer_session';

function loadSession(): CustomerUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomerUser) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomerUser | null>(loadSession);

  const saveUser = (next: CustomerUser | null) => {
    setUser(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const loginWithPhone = (phoneNumber: string, fullName: string) => {
    saveUser({
      id: `usr_${phoneNumber.replace(/\D/g, '').slice(-6) || '001'}`,
      fullName: fullName.trim() || 'Wisatawan Fastix',
      phoneNumber: phoneNumber.trim(),
      role: 'CUSTOMER',
    });
  };

  const loginWithGoogle = () => {
    saveUser({
      id: 'usr_google_001',
      fullName: 'Raka Pratama',
      phoneNumber: '081234567890',
      email: 'raka.pratama@gmail.com',
      role: 'CUSTOMER',
    });
  };

  const logout = () => saveUser(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loginWithPhone,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
