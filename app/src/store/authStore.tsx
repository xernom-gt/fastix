import React, { createContext, useContext, useState } from 'react';

export interface CustomerUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  role: 'CUSTOMER' | 'OWNER';
  ownedVenueIds?: string[];
}

interface AuthContextValue {
  user: CustomerUser | null;
  isAuthenticated: boolean;
  loginWithPhone: (phoneNumber: string, fullName: string) => void;
  loginWithGoogle: (email?: string) => CustomerUser;
  loginAsDemoOwner: () => void;
  upgradeToOwner: (venueIds?: string[]) => void;
  logout: () => void;
}

const REGISTERED_OWNER_GOOGLE_ACCOUNTS: Record<
  string,
  { id: string; fullName: string; phoneNumber: string; email: string; ownedVenueIds: string[] }
> = {
  'bagus@tirtagangga.id': {
    id: 'usr_owner_tirta',
    fullName: 'Anak Agung Bagus',
    phoneNumber: '081238889900',
    email: 'bagus@tirtagangga.id',
    ownedVenueIds: ['tirta-gangga'],
  },
};

const STORAGE_KEY = 'fastix_customer_session_v1';

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

  const loginWithGoogle = (email?: string): CustomerUser => {
    const normalizedEmail = email?.trim().toLowerCase() ?? '';
    const ownerProfile = REGISTERED_OWNER_GOOGLE_ACCOUNTS[normalizedEmail];

    const nextUser: CustomerUser = ownerProfile
      ? {
          ...ownerProfile,
          role: 'OWNER',
        }
      : {
          id: 'usr_google_001',
          fullName: 'Raka Pratama',
          phoneNumber: '081234567890',
          email: normalizedEmail || 'raka.pratama@gmail.com',
          role: 'CUSTOMER',
        };

    saveUser(nextUser);
    return nextUser;
  };

  const loginAsDemoOwner = () => {
    saveUser({
      id: 'usr_owner_tirta',
      fullName: 'Anak Agung Bagus',
      phoneNumber: '081238889900',
      role: 'OWNER',
      ownedVenueIds: ['tirta-gangga'],
    });
  };

  const upgradeToOwner = (venueIds: string[] = ['tirta-gangga']) => {
    if (!user) return;
    saveUser({
      ...user,
      role: 'OWNER',
      ownedVenueIds: user.ownedVenueIds?.length ? user.ownedVenueIds : venueIds,
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
        loginAsDemoOwner,
        upgradeToOwner,
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
