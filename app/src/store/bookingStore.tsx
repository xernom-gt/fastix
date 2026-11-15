import React, { createContext, useContext, useState } from 'react';
import {
  generateInvoiceNumber,
  generateMockSignatureHash,
  generateTicketCode,
  getTodayISO,
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
  createCheckout: (params: {
    venue: Destinasi;
    ticket: TicketProduct;
    bookingDate: string;
    quantity: number;
  }) => Transaction;
  simulateWebhookPaid: (transactionId: string, holderName: string) => ETicket[];
  cancelTransaction: (transactionId: string) => void;
  expireTransaction: (transactionId: string) => void;
  getExtraUsedQuota: (ticketId: string, bookingDate: string) => number;
}

const STORAGE_KEY = 'pariwisloka_bookings_v1';

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

function loadBookings(): BookingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BookingState;
  } catch {
    // ignore corrupted storage
  }
  return {
    transactions: [],
    tickets: [SEED_TICKET],
  };
}

const BookingContext = createContext<BookingContextValue | null>(null);

const PLATFORM_FEE_PER_TICKET = 2500;

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BookingState>(loadBookings);

  const persist = (next: BookingState) => {
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

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
        createCheckout,
        simulateWebhookPaid,
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
