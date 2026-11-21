import React, { createContext, useContext, useState } from 'react';
import {
  generateInvoiceNumber,
  generateMockSignatureHash,
  generateTicketCode,
  getTodayISO,
  MOCK_VENUES,
  type Destinasi,
  type ETicket,
  type TicketProduct,
  type Transaction,
} from '@pariwisloka/shared';

interface BookingState {
  transactions: Transaction[];
  tickets: ETicket[];
}

interface BookingContextValue extends BookingState {
  venues: Destinasi[];
  updateVenues: (next: Destinasi[]) => void;
  getVenueById: (venueId: string) => Destinasi | undefined;
  createCheckout: (params: {
    venue: Destinasi;
    ticket: TicketProduct;
    bookingDate: string;
    quantity: number;
  }) => Transaction;
  simulateWebhookPaid: (transactionId: string, holderName: string) => ETicket[];
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

const BookingContext = createContext<BookingContextValue | null>(null);

const PLATFORM_FEE_PER_TICKET = 2500;

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BookingState>(loadBookings);
  const [venues, setVenues] = useState<Destinasi[]>(loadVenues);

  const persist = (next: BookingState) => {
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const updateVenues = (next: Destinasi[]) => {
    setVenues(next);
    localStorage.setItem(VENUES_STORAGE_KEY, JSON.stringify(next));
  };

  const getVenueById = (venueId: string) => venues.find((v) => v.id === venueId);

  const createCheckout: BookingContextValue['createCheckout'] = ({
    venue,
    ticket,
    bookingDate,
    quantity,
  }) => {
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

  const simulateWebhookPaid = (transactionId: string, holderName: string): ETicket[] => {
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
        updateVenues,
        getVenueById,
        createCheckout,
        simulateWebhookPaid,
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
