import React, { createContext, useContext, useState } from 'react';

export interface CustomerUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  role: 'CUSTOMER' | 'OWNER';
  ownedVenueIds?: string[];
}

export interface RegisteredUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'OWNER';
  ownedVenueIds?: string[];
  createdAt: string;
}

interface AuthContextValue {
  user: CustomerUser | null;
  isAuthenticated: boolean;
  loginWithPhone: (phoneNumber: string, fullName: string) => void;
  loginWithCredentials: (email: string, password: string) => CustomerUser;
  registerCustomer: (data: {
    fullName: string;
    phoneNumber: string;
    email: string;
    password: string;
  }) => CustomerUser;
  updateProfile: (data: { fullName: string }) => CustomerUser | undefined;
  loginWithGoogle: (email?: string) => CustomerUser;
  loginAsDemoOwner: () => void;
  upgradeToOwner: (venueIds?: string[]) => void;
  logout: () => void;
}

const REGISTERED_USERS_KEY = 'fastix_registered_users_v1';

const DEFAULT_REGISTERED_USERS: RegisteredUser[] = [
  {
    id: 'usr_reg_001',
    fullName: 'Raka Pratama',
    phoneNumber: '081234567890',
    email: 'raka.pratama@gmail.com',
    password: 'password123',
    role: 'CUSTOMER',
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'usr_owner_tirta',
    fullName: 'Anak Agung Bagus',
    phoneNumber: '081238889900',
    email: 'bagus@tirtagangga.id',
    password: 'password123',
    role: 'OWNER',
    ownedVenueIds: ['tirta-gangga'],
    createdAt: '2026-11-01T00:00:00.000Z',
  },
];

function loadRegisteredUsers(): RegisteredUser[] {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RegisteredUser[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_REGISTERED_USERS;
}

function saveRegisteredUsers(users: RegisteredUser[]) {
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore storage write errors
  }
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

  const loginWithCredentials = (email: string, password: string): CustomerUser => {
    const users = loadRegisteredUsers();
    const normalizedEmail = email.trim().toLowerCase();

    const matched = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === password,
    );

    if (!matched) {
      const emailExists = users.some((u) => u.email.toLowerCase() === normalizedEmail);
      if (emailExists) {
        throw new Error('Kata sandi salah. Silakan periksa kembali.');
      }
      throw new Error('Akun tidak ditemukan. Silakan periksa alamat email atau daftar akun baru.');
    }

    const customerUser: CustomerUser = {
      id: matched.id,
      fullName: matched.fullName,
      phoneNumber: matched.phoneNumber,
      email: matched.email,
      role: matched.role,
      ownedVenueIds: matched.ownedVenueIds,
    };

    saveUser(customerUser);
    return customerUser;
  };

  const registerCustomer = (data: {
    fullName: string;
    phoneNumber: string;
    email: string;
    password: string;
  }): CustomerUser => {
    const users = loadRegisteredUsers();
    const normalizedEmail = data.email.trim().toLowerCase();

    const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      throw new Error('Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.');
    }

    const newUser: RegisteredUser = {
      id: `usr_${Date.now()}`,
      fullName: data.fullName.trim(),
      phoneNumber: data.phoneNumber.trim(),
      email: normalizedEmail,
      password: data.password,
      role: 'CUSTOMER',
      createdAt: new Date().toISOString(),
    };

    saveRegisteredUsers([...users, newUser]);

    const customerUser: CustomerUser = {
      id: newUser.id,
      fullName: newUser.fullName,
      phoneNumber: newUser.phoneNumber,
      email: newUser.email,
      role: newUser.role,
    };

    saveUser(customerUser);
    return customerUser;
  };

  const updateProfile = (data: { fullName: string }): CustomerUser | undefined => {
    if (!user) return undefined;
    const trimmed = data.fullName.trim();
    if (!trimmed) {
      throw new Error('Nama lengkap tidak boleh kosong.');
    }

    const nextUser: CustomerUser = {
      ...user,
      fullName: trimmed,
    };

    saveUser(nextUser);

    if (user.email) {
      const users = loadRegisteredUsers();
      const updatedList = users.map((u) =>
        u.email.toLowerCase() === user.email?.toLowerCase() ? { ...u, fullName: trimmed } : u,
      );
      saveRegisteredUsers(updatedList);
    }

    return nextUser;
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
        loginWithCredentials,
        registerCustomer,
        updateProfile,
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
