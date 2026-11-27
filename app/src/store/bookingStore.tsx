import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  generateInvoiceNumber,
  generateMockSignatureHash,
  generateTicketCode,
  getTodayISO,
  MOCK_VENUES,
  type Destinasi,
  type ETicket,
  type KategoriWisata,
  type TicketProduct,
  type Transaction,
} from '@pariwisloka/shared';
import { apiGet, apiPost, getAuthToken } from '../services/apiClient';
import { useAuth } from './authStore';

interface BookingState {
  transactions: Transaction[];
  tickets: ETicket[];
}

export interface VenueQueryParams {
  q?: string;
  kota?: string;
  kategori?: string;
  tanggal?: string;
  sortBy?: string;
  lat?: number;
  lng?: number;
}

interface VenueSummaryDTO {
  id: string;
  venueCode: string;
  nama: string;
  kotaKode: string;
  lokasi: string;
  kategori: KategoriWisata;
  hargaMulai: number;
  rating: number;
  jumlahUlasan: number;
  gambarUrl: string;
  gambarAlt: string;
  koordinat?: { lat: number; lng: number };
  distanceMeters?: number;
  remainingQuota: number;
  isPublished: boolean;
}

interface BookingContextValue extends BookingState {
  venues: Destinasi[];
  venuesLoading: boolean;
  updateVenues: (next: Destinasi[]) => void;
  refreshVenues: (params?: VenueQueryParams) => Promise<void>;
  fetchVenueDetail: (venueId: string, tanggal?: string) => Promise<Destinasi | undefined>;
  getVenueById: (venueId: string) => Destinasi | undefined;
  createCheckout: (params: {
    venue: Destinasi;
    ticket: TicketProduct;
    bookingDate: string;
    quantity: number;
  }) => Promise<Transaction>;
  fetchBooking: (invoiceId: string) => Promise<Transaction | undefined>;
  simulateWebhookPaid: (transactionId: string, holderName: string) => Promise<ETicket[]>;
  refreshTickets: () => Promise<void>;
  redeemTicket: (ticketCode: string) => ETicket | null;
  cancelTransaction: (transactionId: string) => void;
  expireTransaction: (transactionId: string) => void;
  getExtraUsedQuota: (ticketId: string, bookingDate: string) => number;
}

const STORAGE_KEY = 'fastix_bookings_v1';
const VENUES_STORAGE_KEY = 'fastix_venues_v1';

export function diffDays(dateA: string, dateB: string = getTodayISO()): number {
  if (!dateA || !dateB) return 0;
  const fromMs = new Date(dateA.slice(0, 10) + 'T00:00:00Z').getTime();
  const toMs = new Date(dateB.slice(0, 10) + 'T00:00:00Z').getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return 0;
  return Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

const SEED_TICKET: ETicket = {
  id: 'tix_seed_01',
  ticketCode: 'PWL-TIX-9A8B7C6D',
  invoiceNumber: 'PWL/INV/20261113/8821',
  venueId: 'tirta-gangga',
  venueCode: 'LOKA-0142',
  venueName: 'Tirta Gangga Water Palace',
  venueAddress: 'Jl. Raya Abang Desa Adat, Karangasem, Bali 80852',
  ticketTitle: 'Tiket Masuk Domestik',
  bookingDate: getTodayISO(),
  signatureHash: 'hmac_4f8a91c2',
  qrPayload: `PWL-TIX-9A8B7C6D|tirta-gangga|${getTodayISO()}|hmac_4f8a91c2`,
  status: 'VALID',
  holderName: 'Raka Pratama',
  paidAt: new Date().toISOString(),
};

const SEED_REDEEMED_TICKET: ETicket = {
  id: 'tix_seed_02',
  ticketCode: 'PWL-TIX-1F3C8B50',
  invoiceNumber: 'PWL/INV/20261116/8799',
  venueId: 'tirta-gangga',
  venueCode: 'LOKA-0142',
  venueName: 'Tirta Gangga Water Palace',
  venueAddress: 'Jl. Raya Abang Desa Adat, Karangasem, Bali 80852',
  ticketTitle: 'Tiket Masuk Domestik',
  bookingDate: getTodayISO(),
  signatureHash: 'hmac_9a1b50e3',
  qrPayload: `PWL-TIX-1F3C8B50|tirta-gangga|${getTodayISO()}|hmac_9a1b50e3`,
  status: 'REDEEMED',
  holderName: 'Dimas Anggara',
  paidAt: new Date().toISOString(),
  redeemedAt: new Date().toISOString(),
};

const SEED_OLD_TICKET: ETicket = {
  id: 'tix_seed_03',
  ticketCode: 'PWL-TIX-7C2D9E41',
  invoiceNumber: 'PWL/INV/20261108/7712',
  venueId: 'borobudur',
  venueCode: 'LOKA-0421',
  venueName: 'Candi Borobudur Heritage',
  venueAddress: 'Jl. Badrawati, Borobudur, Magelang, Jawa Tengah 56553',
  ticketTitle: 'Tiket Masuk Reguler',
  bookingDate: '2026-11-08',
  signatureHash: 'hmac_7c2d9e41',
  qrPayload: 'PWL-TIX-7C2D9E41|borobudur|2026-11-08|hmac_7c2d9e41',
  status: 'VALID',
  holderName: 'Raka Pratama',
  paidAt: '2026-11-08T10:00:00.000Z',
};

const SEED_OLD_TX: Transaction = {
  id: 'tx_seed_03',
  invoiceNumber: 'PWL/INV/20261108/7712',
  venueId: 'borobudur',
  venueCode: 'LOKA-0421',
  venueName: 'Candi Borobudur Heritage',
  venueAddress: 'Jl. Badrawati, Borobudur, Magelang, Jawa Tengah 56553',
  bookingDate: '2026-11-08',
  items: [
    {
      ticketId: 'borobudur-reguler',
      ticketTitle: 'Tiket Masuk Reguler',
      bookingDate: '2026-11-08',
      quantity: 1,
      unitPrice: 50000,
    },
  ],
  subtotal: 50000,
  platformFee: 2500,
  totalAmount: 52500,
  paymentStatus: 'PAID',
  qrString: '00020101021226PARIWISLOKAPWL/INV/20261108/77125802ID',
  expiredAt: '2026-11-08T10:15:00.000Z',
  createdAt: '2026-11-08T10:00:00.000Z',
  paidAt: '2026-11-08T10:02:00.000Z',
};

function applyAutoRefund(loaded: BookingState): BookingState {
  const today = getTodayISO();
  let hasChanges = false;

  const tickets = loaded.tickets.map((t) => {
    if (t.status === 'VALID' && diffDays(t.bookingDate, today) >= 7) {
      hasChanges = true;
      return { ...t, status: 'REFUNDED' as const };
    }
    return t;
  });

  const transactions = loaded.transactions.map((tx) => {
    if (tx.paymentStatus === 'PAID' && diffDays(tx.bookingDate, today) >= 7) {
      const relatedTickets = tickets.filter((t) => t.invoiceNumber === tx.invoiceNumber);
      const hasRedeemed = relatedTickets.some((t) => t.status === 'REDEEMED');
      if (!hasRedeemed) {
        hasChanges = true;
        return { ...tx, paymentStatus: 'REFUNDED' as const };
      }
    }
    return tx;
  });

  const nextState: BookingState = {
    transactions,
    tickets,
  };

  if (hasChanges) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // ignore storage errors during load
    }
  }

  return nextState;
}

function loadVenues(): Destinasi[] {
  try {
    const raw = localStorage.getItem(VENUES_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Destinasi[];
  } catch {
    // fallback to seed venues
  }
  return MOCK_VENUES;
}

function loadBookings(): BookingState {
  let loaded: BookingState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      loaded = JSON.parse(raw) as BookingState;
    } else {
      loaded = {
        transactions: [SEED_OLD_TX],
        tickets: [SEED_TICKET, SEED_REDEEMED_TICKET, SEED_OLD_TICKET],
      };
    }
  } catch {
    loaded = {
      transactions: [SEED_OLD_TX],
      tickets: [SEED_TICKET, SEED_REDEEMED_TICKET, SEED_OLD_TICKET],
    };
  }

  if (!loaded.tickets.some((t) => t.id === 'tix_seed_03')) {
    loaded.tickets = [...loaded.tickets, SEED_OLD_TICKET];
  }
  if (!loaded.transactions.some((tx) => tx.id === 'tx_seed_03')) {
    loaded.transactions = [...loaded.transactions, SEED_OLD_TX];
  }

  return applyAutoRefund(loaded);
}

function mergeVenueSummary(summary: VenueSummaryDTO, existing?: Destinasi): Destinasi {
  const fallback =
    existing ?? MOCK_VENUES.find((v) => v.id === summary.id || v.venueCode === summary.venueCode);

  return {
    id: summary.id,
    venueCode: summary.venueCode,
    nama: summary.nama,
    kotaKode: summary.kotaKode,
    lokasi: summary.lokasi,
    alamat: fallback?.alamat ?? summary.lokasi,
    jamBuka: fallback?.jamBuka ?? '08:00 - 17:00',
    deskripsi: fallback?.deskripsi ?? '',
    kategori: summary.kategori,
    hargaMulai: summary.hargaMulai,
    rating: summary.rating,
    jumlahUlasan: summary.jumlahUlasan,
    gambarUrl: summary.gambarUrl || fallback?.gambarUrl || '',
    gambarAlt: summary.gambarAlt || fallback?.gambarAlt || summary.nama,
    fasilitas: fallback?.fasilitas ?? [],
    tickets: fallback?.tickets ?? [
      {
        id: `${summary.id}-default`,
        venueId: summary.id,
        title: 'Tiket Masuk Reguler',
        description: 'Tiket masuk reguler destinasi wisata',
        price: summary.hargaMulai,
        dailyQuota: summary.remainingQuota,
        usedQuotaPaid: 0,
        usedQuotaPending: 0,
      },
    ],
    koordinat: summary.koordinat ?? fallback?.koordinat ?? { lat: -7.7956, lng: 110.3695 },
    isPublished: summary.isPublished,
  };
}

const BookingContext = createContext<BookingContextValue | null>(null);

const PLATFORM_FEE_PER_TICKET = 2500;

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<BookingState>(loadBookings);
  const [venues, setVenues] = useState<Destinasi[]>(loadVenues);
  const [venuesLoading, setVenuesLoading] = useState(false);

  const persist = useCallback((next: BookingState) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const updateVenues = useCallback((next: Destinasi[]) => {
    setVenues(next);
    try {
      localStorage.setItem(VENUES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const refreshVenues = useCallback(
    async (params: VenueQueryParams = {}) => {
      setVenuesLoading(true);
      try {
        const query = new URLSearchParams();
        if (params.q?.trim()) query.set('q', params.q.trim());
        if (params.kota && params.kota !== 'all') query.set('kota', params.kota);
        if (params.kategori && params.kategori !== 'all') query.set('kategori', params.kategori);
        if (params.tanggal) query.set('tanggal', params.tanggal);
        if (params.sortBy) query.set('sortBy', params.sortBy);
        if (params.lat !== undefined && params.lng !== undefined) {
          query.set('lat', String(params.lat));
          query.set('lng', String(params.lng));
        }

        const qs = query.toString();
        const { data } = await apiGet<VenueSummaryDTO[]>(`/venues${qs ? `?${qs}` : ''}`);
        if (Array.isArray(data) && data.length > 0) {
          setVenues((prev) => {
            const merged = data.map((item) => {
              const existing = prev.find(
                (v) => v.id === item.id || v.venueCode === item.venueCode,
              );
              return mergeVenueSummary(item, existing);
            });
            try {
              localStorage.setItem(VENUES_STORAGE_KEY, JSON.stringify(merged));
            } catch {
              // ignore storage errors
            }
            return merged;
          });
        }
      } catch {
        // Fallback smoothly to cached/mock venues when API is unreachable
      } finally {
        setVenuesLoading(false);
      }
    },
    [],
  );

  const fetchVenueDetail = useCallback(
    async (venueId: string, tanggal?: string): Promise<Destinasi | undefined> => {
      const targetDate = tanggal || getTodayISO();
      try {
        const { data } = await apiGet<Destinasi>(
          `/venues/${encodeURIComponent(venueId)}?tanggal=${encodeURIComponent(targetDate)}`,
        );
        if (data) {
          setVenues((prev) => {
            const exists = prev.some((v) => v.id === data.id);
            const next = exists
              ? prev.map((v) => (v.id === data.id ? data : v))
              : [...prev, data];
            try {
              localStorage.setItem(VENUES_STORAGE_KEY, JSON.stringify(next));
            } catch {
              // ignore storage errors
            }
            return next;
          });
          return data;
        }
      } catch {
        // Fallback to local venue
      }
      return venues.find((v) => v.id === venueId);
    },
    [venues],
  );

  const refreshTickets = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const { data } = await apiGet<ETicket[]>('/tickets');
      if (Array.isArray(data)) {
        setState((prev) => {
          const next = { ...prev, tickets: data };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore storage errors
          }
          return next;
        });
      }
    } catch {
      // keep existing local tickets on network error
    }
  }, []);

  useEffect(() => {
    void refreshVenues();
  }, [refreshVenues]);

  useEffect(() => {
    if (isAuthenticated && getAuthToken()) {
      void refreshTickets();
    }
  }, [isAuthenticated, refreshTickets]);

  const getVenueById = (venueId: string) => venues.find((v) => v.id === venueId);

  const createCheckout: BookingContextValue['createCheckout'] = async ({
    venue,
    ticket,
    bookingDate,
    quantity,
  }) => {
    if (getAuthToken()) {
      const { data: tx } = await apiPost<Transaction>('/bookings', {
        venueId: venue.id,
        bookingDate,
        items: [{ ticketId: ticket.id, quantity }],
      });
      persist({
        ...state,
        transactions: [tx, ...state.transactions.filter((t) => t.id !== tx.id)],
      });
      return tx;
    }

    const now = new Date();
    const expired = new Date(now.getTime() + 15 * 60 * 1000);
    const invoiceNumber = generateInvoiceNumber(now);
    const subtotal = ticket.price * quantity;
    const platformFee = PLATFORM_FEE_PER_TICKET * quantity;
    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      invoiceNumber,
      venueId: venue.id,
      venueCode: venue.venueCode,
      venueName: venue.nama,
      venueAddress: venue.alamat,
      bookingDate,
      items: [
        {
          ticketId: ticket.id,
          ticketTitle: ticket.title,
          bookingDate,
          quantity,
          unitPrice: ticket.price,
        },
      ],
      subtotal,
      platformFee,
      totalAmount: subtotal + platformFee,
      paymentStatus: 'PENDING',
      qrString: `00020101021226PARIWISLOKA${invoiceNumber}5802ID`,
      expiredAt: expired.toISOString(),
      createdAt: now.toISOString(),
    };

    persist({
      ...state,
      transactions: [tx, ...state.transactions],
    });
    return tx;
  };

  const fetchBooking = useCallback(
    async (invoiceId: string): Promise<Transaction | undefined> => {
      if (getAuthToken()) {
        try {
          const { data: tx } = await apiGet<Transaction>(
            `/bookings/${encodeURIComponent(invoiceId)}`,
          );
          if (tx) {
            setState((prev) => {
              const exists = prev.transactions.some((t) => t.id === tx.id);
              const nextTransactions = exists
                ? prev.transactions.map((t) => (t.id === tx.id ? tx : t))
                : [tx, ...prev.transactions];
              const next = { ...prev, transactions: nextTransactions };
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
              } catch {
                // ignore storage errors
              }
              return next;
            });
            return tx;
          }
        } catch {
          // fallback to local state
        }
      }
      return state.transactions.find((t) => t.id === invoiceId || t.invoiceNumber === invoiceId);
    },
    [state.transactions],
  );

  const simulateWebhookPaid = async (
    transactionId: string,
    holderName: string,
  ): Promise<ETicket[]> => {
    if (getAuthToken()) {
      const { data: updatedTx } = await apiPost<Transaction>(
        `/bookings/${encodeURIComponent(transactionId)}/simulate-pay`,
      );
      const { data: latestTickets } = await apiGet<ETicket[]>('/tickets');
      const nextTransactions = state.transactions.map((t) =>
        t.id === updatedTx.id ? updatedTx : t,
      );
      const nextTickets = Array.isArray(latestTickets) ? latestTickets : state.tickets;
      persist({
        transactions: nextTransactions,
        tickets: nextTickets,
      });
      return nextTickets.filter((tk) => tk.invoiceNumber === updatedTx.invoiceNumber);
    }

    const target = state.transactions.find((t) => t.id === transactionId);
    if (!target) return [];
    if (target.paymentStatus === 'PAID') {
      return state.tickets.filter((tk) => tk.invoiceNumber === target.invoiceNumber);
    }

    const paidAt = new Date().toISOString();
    const issuedTickets: ETicket[] = [];

    for (const item of target.items) {
      for (let i = 0; i < item.quantity; i++) {
        const ticketCode = generateTicketCode();
        const signatureHash = generateMockSignatureHash(
          ticketCode,
          target.venueId,
          item.bookingDate,
        );
        issuedTickets.push({
          id: `tk_${Date.now()}_${i}`,
          ticketCode,
          invoiceNumber: target.invoiceNumber,
          venueId: target.venueId,
          venueCode: target.venueCode,
          venueName: target.venueName,
          venueAddress: target.venueAddress,
          ticketTitle: item.ticketTitle,
          bookingDate: item.bookingDate,
          signatureHash,
          qrPayload: `${ticketCode}|${target.venueId}|${item.bookingDate}|${signatureHash}`,
          status: 'VALID',
          holderName,
          paidAt,
        });
      }
    }

    const nextTransactions = state.transactions.map((t) =>
      t.id === transactionId ? { ...t, paymentStatus: 'PAID' as const, paidAt } : t,
    );

    persist({
      transactions: nextTransactions,
      tickets: [...issuedTickets, ...state.tickets],
    });

    return issuedTickets;
  };

  const redeemTicket = (ticketCode: string): ETicket | null => {
    const target = state.tickets.find(
      (t) => t.ticketCode.toUpperCase() === ticketCode.trim().toUpperCase(),
    );
    if (!target || target.status !== 'VALID') return null;

    const redeemedAt = new Date().toISOString();
    const updated: ETicket = { ...target, status: 'REDEEMED', redeemedAt };
    persist({
      ...state,
      tickets: state.tickets.map((t) => (t.id === target.id ? updated : t)),
    });
    return updated;
  };

  const cancelTransaction = (transactionId: string) => {
    persist({
      ...state,
      transactions: state.transactions.map((t) =>
        t.id === transactionId && t.paymentStatus === 'PENDING'
          ? { ...t, paymentStatus: 'CANCELLED' as const }
          : t,
      ),
    });
  };

  const expireTransaction = (transactionId: string) => {
    persist({
      ...state,
      transactions: state.transactions.map((t) =>
        t.id === transactionId && t.paymentStatus === 'PENDING'
          ? { ...t, paymentStatus: 'EXPIRED' as const }
          : t,
      ),
    });
  };

  const getExtraUsedQuota = (ticketId: string, bookingDate: string) => {
    const nowMs = Date.now();
    let extra = 0;
    for (const tx of state.transactions) {
      const isPaid = tx.paymentStatus === 'PAID';
      const isActivePending =
        tx.paymentStatus === 'PENDING' && new Date(tx.expiredAt).getTime() > nowMs;
      if (!isPaid && !isActivePending) continue;
      for (const item of tx.items) {
        if (item.ticketId === ticketId && item.bookingDate === bookingDate) {
          extra += item.quantity;
        }
      }
    }
    return extra;
  };

  return (
    <BookingContext.Provider
      value={{
        ...state,
        venues,
        venuesLoading,
        updateVenues,
        refreshVenues,
        fetchVenueDetail,
        getVenueById,
        createCheckout,
        fetchBooking,
        simulateWebhookPaid,
        refreshTickets,
        redeemTicket,
        cancelTransaction,
        expireTransaction,
        getExtraUsedQuota,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
};

export function useBookings(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBookings harus dipakai di dalam BookingProvider');
  return ctx;
}
