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

const STAFFS_STORAGE_KEY = 'fastix_mitra_staffs_v1';
const OFFLINE_QUEUE_STORAGE_KEY = 'fastix_gate_offline_queue_v1';
const GATE_SESSION_STORAGE_KEY = 'fastix_gate_staff_session_v1';

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
