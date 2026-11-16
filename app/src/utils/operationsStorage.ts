import { getTodayISO, MOCK_VENUES, type Destinasi, type ETicket } from '@pariwisloka/shared';

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

const VENUES_STORAGE_KEY = 'fastix_mitra_venues_v1';
const STAFFS_STORAGE_KEY = 'fastix_mitra_staffs_v1';
const GATE_TICKETS_STORAGE_KEY = 'fastix_gate_tickets_v1';
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
    venueCode: 'LOKA-0218',
    venueName: 'Candi Prambanan Heritage',
    pin: '731920',
    isActive: true,
  },
];

function createDefaultGateTickets(): ETicket[] {
  const today = getTodayISO();
  const paidAt = new Date().toISOString();

  return [
    {
      id: 'tix_gate_01',
      ticketCode: 'PWL-TIX-9A8B7C6D',
      invoiceNumber: 'PWL/INV/20261116/8821',
      venueId: 'tirta-gangga',
      venueCode: 'LOKA-0142',
      venueName: 'Tirta Gangga Water Palace',
      venueAddress: 'Jl. Raya Abang Desa Adat, Karangasem, Bali 80852',
      ticketTitle: 'Tiket Masuk Domestik',
      bookingDate: today,
      signatureHash: 'hmac_4f8a91c2',
      qrPayload: `PWL-TIX-9A8B7C6D|tirta-gangga|${today}|hmac_4f8a91c2`,
      status: 'VALID',
      holderName: 'Raka Pratama',
      paidAt,
    },
    {
      id: 'tix_gate_02',
      ticketCode: 'PWL-TIX-4D7E2A19',
      invoiceNumber: 'PWL/INV/20261116/8824',
      venueId: 'tirta-gangga',
      venueCode: 'LOKA-0142',
      venueName: 'Tirta Gangga Water Palace',
      venueAddress: 'Jl. Raya Abang Desa Adat, Karangasem, Bali 80852',
      ticketTitle: 'Paket Taman Air & Koi Feed',
      bookingDate: today,
      signatureHash: 'hmac_7c2e19a4',
      qrPayload: `PWL-TIX-4D7E2A19|tirta-gangga|${today}|hmac_7c2e19a4`,
      status: 'VALID',
      holderName: 'Siti Nurhaliza',
      paidAt,
    },
    {
      id: 'tix_gate_03',
      ticketCode: 'PWL-TIX-1F3C8B50',
      invoiceNumber: 'PWL/INV/20261116/8799',
      venueId: 'tirta-gangga',
      venueCode: 'LOKA-0142',
      venueName: 'Tirta Gangga Water Palace',
      venueAddress: 'Jl. Raya Abang Desa Adat, Karangasem, Bali 80852',
      ticketTitle: 'Tiket Masuk Domestik',
      bookingDate: today,
      signatureHash: 'hmac_9a1b50e3',
      qrPayload: `PWL-TIX-1F3C8B50|tirta-gangga|${today}|hmac_9a1b50e3`,
      status: 'REDEEMED',
      holderName: 'Dimas Anggara',
      paidAt,
      redeemedAt: paidAt,
    },
    {
      id: 'tix_gate_04',
      ticketCode: 'PWL-TIX-6B2E9D11',
      invoiceNumber: 'PWL/INV/20261116/8902',
      venueId: 'candi-prambanan',
      venueCode: 'LOKA-0218',
      venueName: 'Candi Prambanan Heritage',
      venueAddress: 'Jl. Raya Solo - Yogyakarta No.16, Sleman, DIY 55571',
      ticketTitle: 'Tiket Masuk Reguler',
      bookingDate: today,
      signatureHash: 'hmac_3d8f11b2',
      qrPayload: `PWL-TIX-6B2E9D11|candi-prambanan|${today}|hmac_3d8f11b2`,
      status: 'VALID',
      holderName: 'Dewi Lestari',
      paidAt,
    },
  ];
}

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

export function loadMitraVenues(): Destinasi[] {
  return readJson<Destinasi[]>(VENUES_STORAGE_KEY, MOCK_VENUES);
}

export function saveMitraVenues(venues: Destinasi[]): void {
  writeJson(VENUES_STORAGE_KEY, venues);
}

export function loadStaffAccounts(): StaffGateAccount[] {
  return readJson<StaffGateAccount[]>(STAFFS_STORAGE_KEY, DEFAULT_STAFFS);
}

export function saveStaffAccounts(staffs: StaffGateAccount[]): void {
  writeJson(STAFFS_STORAGE_KEY, staffs);
}

export function loadGateTickets(): ETicket[] {
  return readJson<ETicket[]>(GATE_TICKETS_STORAGE_KEY, createDefaultGateTickets());
}

export function saveGateTickets(tickets: ETicket[]): void {
  writeJson(GATE_TICKETS_STORAGE_KEY, tickets);
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
