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

export type PayoutStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

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
}

export const DISBURSEMENT_BANK_ADMIN_FEE = 6500;
export const MIN_PAYOUT_AMOUNT = 50000;

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

const DEFAULT_MUTATIONS: BalanceMutation[] = [
  {
    id: 'mut_seed_01',
    venueId: 'tirta-gangga',
    type: 'HOLDING_RELEASED',
    amount: 2450000,
    grossAmount: 2625000,
    platformFee: 175000,
    description: 'Rilis escrow H+1 tiket check-in 15 Nov (70 tiket redeemed)',
    createdAt: '2026-11-16T23:59:00+07:00',
  },
  {
    id: 'mut_seed_02',
    venueId: 'tirta-gangga',
    type: 'PAYOUT_WITHDRAW',
    amount: -1000000,
    description: 'Penarikan dana ke Bank Mandiri ****3041',
    createdAt: '2026-11-16T14:20:00+07:00',
  },
  {
    id: 'mut_seed_03',
    venueId: 'tirta-gangga',
    type: 'PAYIN_INFLOW',
    amount: 945000,
    grossAmount: 1020000,
    platformFee: 75000,
    description: 'Tiket berhasil check-in di gate (masa tahan H+1)',
    createdAt: '2026-11-17T07:45:00+07:00',
  },
  {
    id: 'mut_seed_04',
    venueId: 'candi-prambanan',
    type: 'HOLDING_RELEASED',
    amount: 3800000,
    grossAmount: 4000000,
    platformFee: 200000,
    description: 'Rilis escrow H+1 tiket check-in 15 Nov (80 tiket redeemed)',
    createdAt: '2026-11-16T23:59:00+07:00',
  },
  {
    id: 'mut_seed_05',
    venueId: 'tirta-gangga',
    type: 'REFUND_AUTO',
    amount: 0,
    grossAmount: 37500,
    platformFee: 0,
    description: 'Tiket PWL-TIX-7D2E9F10 - Tiket Kadaluarsa & Di-refund Otomatis',
    createdAt: '2026-11-15T00:01:00+07:00',
  },
];

const DEFAULT_PAYOUTS: PayoutRecord[] = [
  {
    id: 'pay_seed_01',
    venueId: 'tirta-gangga',
    amountRequested: 1000000,
    bankAdminFee: DISBURSEMENT_BANK_ADMIN_FEE,
    netReceived: 1000000 - DISBURSEMENT_BANK_ADMIN_FEE,
    bankName: 'Bank Mandiri',
    accountNumber: '1450018293041',
    accountHolder: 'Yayasan Pengelola Tirta Gangga',
    status: 'COMPLETED',
    createdAt: '2026-11-16T14:20:00+07:00',
  },
];

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
  const list = readJson<BalanceMutation[]>(MUTATIONS_STORAGE_KEY, DEFAULT_MUTATIONS);
  if (!list.some((m) => m.type === 'REFUND_AUTO')) {
    const refundSeed: BalanceMutation = {
      id: 'mut_seed_05',
      venueId: 'tirta-gangga',
      type: 'REFUND_AUTO',
      amount: 0,
      grossAmount: 37500,
      platformFee: 0,
      description: 'Tiket PWL-TIX-7D2E9F10 - Tiket Kadaluarsa & Di-refund Otomatis',
      createdAt: '2026-11-15T00:01:00+07:00',
    };
    return [...list, refundSeed];
  }
  return list;
}

export function saveBalanceMutations(mutations: BalanceMutation[]): void {
  writeJson(MUTATIONS_STORAGE_KEY, mutations);
}

export function loadPayoutHistory(): PayoutRecord[] {
  return readJson<PayoutRecord[]>(PAYOUTS_STORAGE_KEY, DEFAULT_PAYOUTS);
}

export function savePayoutHistory(payouts: PayoutRecord[]): void {
  writeJson(PAYOUTS_STORAGE_KEY, payouts);
}
