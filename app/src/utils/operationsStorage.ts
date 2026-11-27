import type { KategoriWisata, TicketProduct } from '@pariwisloka/shared';

export interface StaffGateAccount {
  id: string;
  name: string;
  venueId: string;
  venueCode: string;
  venueName: string;
  pin: string;
  isActive: boolean;
}

export interface OfflineScanQueueItem {
  id: string;
  ticketCode: string;
  holderName: string;
  ticketTitle: string;
  scannedAt: string;
  synced: boolean;
}

export interface BankAccountKYB {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isVerifiedKYB: boolean;
}

export type BalanceMutationType =
  | 'PAYIN_INFLOW'
  | 'HOLDING_RELEASED'
  | 'PAYOUT_WITHDRAW'
  | 'PAYOUT_REFUND'
  | 'UNCHECKED_HOLDING'
  | 'REFUND_AUTO';

export interface BalanceMutation {
  id: string;
  venueId: string;
  type: BalanceMutationType;
  amount: number;
  grossAmount?: number;
  platformFee?: number;
  description: string;
  createdAt: string;
}

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'COMPLETED' | 'FAILED';

export interface PayoutRecord {
  id: string;
  venueId: string;
  amountRequested: number;
  bankAdminFee: number;
  netReceived: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: PayoutStatus;
  createdAt: string;
  transferredAt?: string;
}

export const DISBURSEMENT_BANK_ADMIN_FEE = 6500;
export const MIN_PAYOUT_AMOUNT = 50000;

export const AUTH_TOKEN_STORAGE_KEY = 'fastix_auth_token_v1';
const RAW_API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080/api/v1';
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

export interface MitraVenueDTO {
  id: string;
  venueCode: string;
  nama: string;
  kotaKode: string;
  lokasi?: string;
  alamat?: string;
  jamBuka?: string;
  deskripsi?: string;
  kategori?: KategoriWisata;
  hargaMulai?: number;
  rating?: number;
  jumlahUlasan?: number;
  gambarUrl?: string;
  gambarAlt?: string;
  fasilitas?: string[];
  koordinat?: {
    lat: number;
    lng: number;
  };
  isPublished: boolean;
  tickets: TicketProduct[];
}

export interface UpdateMitraVenueRequest {
  nama?: string;
  alamat?: string;
  jamBuka?: string;
  deskripsi?: string;
  fasilitas?: string[];
}

export interface CreateTicketRequest {
  venueId: string;
  title: string;
  description: string;
  price: number;
  dailyQuota: number;
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  price?: number;
  dailyQuota?: number;
  isActive?: boolean;
}

export interface MitraStaffDTO {
  id: string;
  venueId: string;
  venueCode: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStaffRequest {
  venueId: string;
  name: string;
  pin: string;
}

export interface UpdateStaffRequest {
  pin?: string;
  isActive?: boolean;
}

export interface BalanceMutationDTO {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

export interface PayoutDTO {
  id: string;
  amount: number;
  adminFee: number;
  netAmount: number;
  bankCode: string;
  bankAccountNumber: string;
  bankAccountName: string;
  status: string;
  createdAt: string;
  transferredAt?: string;
}

export interface MitraFinanceSummary {
  grossRevenue?: number;
  platformFee?: number;
  holdingPlatformBalance: number;
  pendingBalance: number;
  availableBalance: number;
  refundedCount: number;
  mutations: BalanceMutationDTO[];
  payouts: PayoutDTO[];
}

export interface CreatePayoutRequest {
  amount: number;
}

export function getFastixAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    timestamp?: string;
  };
}

export async function mitraApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getFastixAuthToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !json?.success) {
    const errorMsg = json?.error?.message || `Permintaan ke server gagal (${response.status})`;
    throw new Error(errorMsg);
  }

  return json.data as T;
}

export async function apiFetchMitraVenues(): Promise<MitraVenueDTO[]> {
  return mitraApiRequest<MitraVenueDTO[]>('/mitra/venues');
}

export async function apiUpdateMitraVenue(
  venueId: string,
  payload: UpdateMitraVenueRequest,
): Promise<MitraVenueDTO> {
  return mitraApiRequest<MitraVenueDTO>(`/mitra/venues/${encodeURIComponent(venueId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function apiCreateMitraTicket(req: CreateTicketRequest): Promise<TicketProduct> {
  return mitraApiRequest<TicketProduct>('/mitra/tickets', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function apiUpdateMitraTicket(
  ticketId: string,
  req: UpdateTicketRequest,
): Promise<TicketProduct> {
  return mitraApiRequest<TicketProduct>(`/mitra/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify(req),
  });
}

export async function apiFetchMitraStaffs(): Promise<MitraStaffDTO[]> {
  return mitraApiRequest<MitraStaffDTO[]>('/mitra/staffs');
}

export async function apiCreateMitraStaff(req: CreateStaffRequest): Promise<MitraStaffDTO> {
  return mitraApiRequest<MitraStaffDTO>('/mitra/staffs', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function apiUpdateMitraStaff(
  staffId: string,
  req: UpdateStaffRequest,
): Promise<MitraStaffDTO> {
  return mitraApiRequest<MitraStaffDTO>(`/mitra/staffs/${encodeURIComponent(staffId)}`, {
    method: 'PATCH',
    body: JSON.stringify(req),
  });
}

export async function apiFetchMitraFinance(): Promise<MitraFinanceSummary> {
  return mitraApiRequest<MitraFinanceSummary>('/mitra/finance');
}

export async function apiCreatePayout(amount: number): Promise<PayoutDTO> {
  return mitraApiRequest<PayoutDTO>('/mitra/payouts', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

const STAFFS_STORAGE_KEY = 'fastix_mitra_staffs_v1';
const OFFLINE_QUEUE_STORAGE_KEY = 'fastix_gate_offline_queue_v1';
const GATE_SESSION_STORAGE_KEY = 'fastix_gate_staff_session_v1';
const MUTATIONS_STORAGE_KEY = 'fastix_mitra_mutations_v1';
const PAYOUTS_STORAGE_KEY = 'fastix_mitra_payouts_v1';

const KYB_BANK_ACCOUNTS: Record<string, BankAccountKYB> = {
  'tirta-gangga': {
    bankName: 'Bank Mandiri',
    accountNumber: '1450018293041',
    accountHolder: 'Yayasan Pengelola Tirta Gangga',
    isVerifiedKYB: true,
  },
  'candi-prambanan': {
    bankName: 'Bank BRI',
    accountNumber: '002901004829103',
    accountHolder: 'PT Taman Wisata Prambanan',
    isVerifiedKYB: true,
  },
};

const DEFAULT_STAFFS: StaffGateAccount[] = [
  {
    id: 'stf_01',
    name: 'Nadia Kusuma',
    venueId: 'tirta-gangga',
    venueCode: 'LOKA-0142',
    venueName: 'Tirta Gangga Water Palace',
    pin: '482910',
    isActive: true,
  },
  {
    id: 'stf_02',
    name: 'Bagas Wicaksono',
    venueId: 'candi-prambanan',
    venueCode: 'LOKA-0315',
    venueName: 'Candi Prambanan Heritage',
    pin: '731920',
    isActive: true,
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadStaffAccounts(): StaffGateAccount[] {
  return readJson<StaffGateAccount[]>(STAFFS_STORAGE_KEY, DEFAULT_STAFFS);
}

export function saveStaffAccounts(staffs: StaffGateAccount[]): void {
  writeJson(STAFFS_STORAGE_KEY, staffs);
}

export function loadOfflineQueue(): OfflineScanQueueItem[] {
  return readJson<OfflineScanQueueItem[]>(OFFLINE_QUEUE_STORAGE_KEY, []);
}

export function saveOfflineQueue(queue: OfflineScanQueueItem[]): void {
  writeJson(OFFLINE_QUEUE_STORAGE_KEY, queue);
}

export function loadGateSession(): StaffGateAccount | null {
  return readJson<StaffGateAccount | null>(GATE_SESSION_STORAGE_KEY, null);
}

export function saveGateSession(staff: StaffGateAccount | null): void {
  if (staff) {
    writeJson(GATE_SESSION_STORAGE_KEY, staff);
  } else {
    localStorage.removeItem(GATE_SESSION_STORAGE_KEY);
  }
}

export function getVerifiedBankAccount(venueId: string): BankAccountKYB {
  return (
    KYB_BANK_ACCOUNTS[venueId] ?? {
      bankName: 'Bank BCA',
      accountNumber: '7720194821',
      accountHolder: 'Pengelola Destinasi Terverifikasi',
      isVerifiedKYB: true,
    }
  );
}

export function loadBalanceMutations(): BalanceMutation[] {
  return readJson<BalanceMutation[]>(MUTATIONS_STORAGE_KEY, []);
}

export function saveBalanceMutations(mutations: BalanceMutation[]): void {
  writeJson(MUTATIONS_STORAGE_KEY, mutations);
}

export function loadPayoutHistory(): PayoutRecord[] {
  return readJson<PayoutRecord[]>(PAYOUTS_STORAGE_KEY, []);
}

export function savePayoutHistory(payouts: PayoutRecord[]): void {
  writeJson(PAYOUTS_STORAGE_KEY, payouts);
}
