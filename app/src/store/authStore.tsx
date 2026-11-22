import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  apiGet,
  apiPatch,
  apiPost,
  ApiClientError,
  getAuthToken,
  setAuthToken,
} from '../services/apiClient';

export interface CustomerUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  role: 'CUSTOMER' | 'OWNER';
  ownedVenueIds?: string[];
}

interface BackendUserProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  role: string;
  ownedVenueIds?: string[];
}

interface AuthTokenResponse {
  accessToken: string;
  user: BackendUserProfile;
}

export interface RegisterOtpInfo {
  email: string;
  expiresInSeconds: number;
}

interface AuthContextValue {
  user: CustomerUser | null;
  isAuthenticated: boolean;
  loginWithCredentials: (email: string, password: string) => Promise<CustomerUser>;
  loginWithGoogle: (idToken: string) => Promise<CustomerUser>;
  requestRegistration: (data: {
    fullName: string;
    phoneNumber: string;
    email: string;
    password: string;
  }) => Promise<RegisterOtpInfo>;
  verifyRegistrationOtp: (email: string, otpCode: string) => Promise<CustomerUser>;
  updateProfile: (data: { fullName: string }) => Promise<CustomerUser | undefined>;
  upgradeToOwner: (venueIds?: string[]) => void;
  logout: () => void;
}

const STORAGE_KEY = 'fastix_customer_session_v1';

function mapBackendUser(profile: BackendUserProfile): CustomerUser {
  const isOwner = profile.role === 'MITRA' || profile.role === 'OWNER';
  return {
    id: profile.id,
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
    email: profile.email,
    role: isOwner ? 'OWNER' : 'CUSTOMER',
    ownedVenueIds: isOwner ? profile.ownedVenueIds ?? [] : undefined,
  };
}

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
    try {
      if (next) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    let cancelled = false;
    apiGet<BackendUserProfile>('/auth/me')
      .then(({ data }) => {
        if (!cancelled && data) {
          saveUser(mapBackendUser(data));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) {
          setAuthToken(null);
          saveUser(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithCredentials = async (email: string, password: string): Promise<CustomerUser> => {
    const { data } = await apiPost<AuthTokenResponse>('/auth/login', {
      email: email.trim(),
      password,
    });
    setAuthToken(data.accessToken);
    const mapped = mapBackendUser(data.user);
    saveUser(mapped);
    return mapped;
  };

  const loginWithGoogle = async (idToken: string): Promise<CustomerUser> => {
    const { data } = await apiPost<AuthTokenResponse>('/auth/google', { idToken });
    setAuthToken(data.accessToken);
    const mapped = mapBackendUser(data.user);
    saveUser(mapped);
    return mapped;
  };

  const requestRegistration = async (data: {
    fullName: string;
    phoneNumber: string;
    email: string;
    password: string;
  }): Promise<RegisterOtpInfo> => {
    const { data: res } = await apiPost<RegisterOtpInfo>('/auth/register', {
      fullName: data.fullName.trim(),
      phoneNumber: data.phoneNumber.trim(),
      email: data.email.trim(),
      password: data.password,
    });
    return res;
  };

  const verifyRegistrationOtp = async (email: string, otpCode: string): Promise<CustomerUser> => {
    const { data } = await apiPost<AuthTokenResponse>('/auth/register/verify-otp', {
      email: email.trim(),
      otpCode: otpCode.trim(),
    });
    setAuthToken(data.accessToken);
    const mapped = mapBackendUser(data.user);
    saveUser(mapped);
    return mapped;
  };

  const updateProfile = async (data: { fullName: string }): Promise<CustomerUser | undefined> => {
    if (!user) return undefined;
    const trimmed = data.fullName.trim();
    if (!trimmed) {
      throw new Error('Nama lengkap tidak boleh kosong.');
    }

    if (getAuthToken()) {
      const { data: updatedProfile } = await apiPatch<BackendUserProfile>('/auth/profile', {
        fullName: trimmed,
      });
      const mapped = mapBackendUser(updatedProfile);
      saveUser(mapped);
      return mapped;
    }

    const nextUser: CustomerUser = { ...user, fullName: trimmed };
    saveUser(nextUser);
    return nextUser;
  };

  const upgradeToOwner = (venueIds: string[] = ['tirta-gangga']) => {
    if (!user) return;
    saveUser({
      ...user,
      role: 'OWNER',
      ownedVenueIds: user.ownedVenueIds?.length ? user.ownedVenueIds : venueIds,
    });
  };

  const logout = () => {
    setAuthToken(null);
    saveUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loginWithCredentials,
        loginWithGoogle,
        requestRegistration,
        verifyRegistrationOtp,
        updateProfile,
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
