import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  formatRupiah,
  formatTanggalID,
  type PaymentStatus,
  type RedemptionStatus,
} from '@pariwisloka/shared';
import { QrMatrixSvg } from '../components/QrMatrixSvg';
import { useAuth } from '../store/authStore';
import { useBookings } from '../store/bookingStore';

const TICKET_STATUS_META: Record<RedemptionStatus, { label: string; className: string }> = {
  VALID: { label: 'Siap Digunakan', className: 'bg-[#111827] text-white' },
  REDEEMED: { label: 'Sudah Masuk', className: 'bg-gray-200 text-gray-700' },
  EXPIRED: { label: 'Kedaluwarsa', className: 'bg-red-100 text-red-800' },
};

const TX_STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING: { label: 'Menunggu Pembayaran', className: 'bg-amber-100 text-amber-900' },
  PAID: { label: 'Lunas', className: 'bg-emerald-100 text-emerald-900' },
  EXPIRED: { label: 'Kedaluwarsa', className: 'bg-gray-200 text-gray-700' },
  CANCELLED: { label: 'Dibatalkan', className: 'bg-red-100 text-red-800' },
};

export default function TicketsPage() {
  const { ticketCode } = useParams<{ ticketCode: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { tickets, transactions } = useBookings();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RedemptionStatus>('ALL');

  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (q) {
        const hay = `${t.ticketCode} ${t.invoiceNumber} ${t.venueName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, query, statusFilter]);

  const filteredTransactions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (!q) return true;
      return `${tx.invoiceNumber} ${tx.venueName}`.toLowerCase().includes(q);
    });
  }, [transactions, query]);

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(ticketCode ? `/tiket/${ticketCode}` : '/tiket')}`}
        replace
      />
    );
  }

  const activeTicket =
    (ticketCode ? tickets.find((t) => t.ticketCode === ticketCode) : null) ??
    filteredTickets[0] ??
    null;

  const pendingTransactions = filteredTransactions.filter((t) => t.paymentStatus === 'PENDING');
  const otherTransactions = filteredTransactions.filter((t) => t.paymentStatus !== 'PENDING');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            Pesanan Saya
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Kelola pesanan yang menunggu pembayaran serta tunjukkan kode QR tiket di pintu masuk.
          </p>
        </div>
        <Link
          to="/explore"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
        >
          Pesan Tiket Baru
        </Link>
      </div>

      {/* Pending Payment Section */}
      {pendingTransactions.length > 0 && (
        <section
          aria-label="Menunggu pembayaran"
          className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <p className="text-xs font-extrabold text-gray-900">
            Menunggu Pembayaran ({pendingTransactions.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {pendingTransactions.map((tx) => (
              <Link
                key={tx.id}
                to={`/checkout/${tx.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-gray-900 truncate">{tx.venueName}</p>
                  <p className="text-[11px] text-gray-600 truncate">
                    {formatTanggalID(tx.bookingDate)} · {formatRupiah(tx.totalAmount)}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold shrink-0">
                  Bayar QRIS
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Search & Filter */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1">
          <label htmlFor="ticket-search" className="sr-only">
            Cari kode tiket atau nama wisata
          </label>
          <input
            id="ticket-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode tiket atau nama tempat wisata..."
            className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'VALID', 'REDEEMED', 'EXPIRED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border min-h-[40px] transition-colors ${
                statusFilter === st
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {st === 'ALL' ? 'Semua Tiket' : TICKET_STATUS_META[st].label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Ticket List + QR Detail */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center space-y-3">
          <h2 className="text-lg font-bold text-gray-900">Belum ada tiket yang cocok</h2>
          <p className="text-sm text-gray-600">
            Coba ubah filter status atau pesan tiket wisata terlebih dahulu di katalog.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Ticket List */}
          <div className="lg:col-span-5 space-y-3">
            {filteredTickets.map((t) => {
              const selected = activeTicket?.id === t.id;
              const badge = TICKET_STATUS_META[t.status];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/tiket/${t.ticketCode}`)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors space-y-2 ${
                    selected
                      ? 'bg-white border-gray-900 ring-1 ring-gray-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-gray-900">
                      {t.ticketCode}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{t.venueName}</p>
                  <p className="text-xs text-gray-600">
                    {t.ticketTitle} · {formatTanggalID(t.bookingDate)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active Ticket Detail */}
          {activeTicket && (
            <div className="lg:col-span-7">
              <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden">
                <div className="bg-gray-900 text-white p-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-gray-300">
                        Tiket Masuk Resmi Fastix
                      </span>
                      <h2 className="text-xl font-extrabold mt-0.5">{activeTicket.venueName}</h2>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        activeTicket.status === 'VALID'
                          ? 'bg-white text-gray-900'
                          : 'bg-white/15 text-gray-200'
                      }`}
                    >
                      {TICKET_STATUS_META[activeTicket.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">{activeTicket.venueAddress}</p>
                </div>

                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="block text-[11px] font-bold uppercase text-gray-500">
                      Tanggal Masuk
                    </span>
                    <span className="font-bold text-gray-900">
                      {formatTanggalID(activeTicket.bookingDate)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase text-gray-500">
                      Jenis Tiket
                    </span>
                    <span className="font-bold text-gray-900">{activeTicket.ticketTitle}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase text-gray-500">
                      Pemegang
                    </span>
                    <span className="font-bold text-gray-900">{activeTicket.holderName}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="block text-[11px] font-bold uppercase text-gray-500">
                      Nomor Invoice
                    </span>
                    <span className="font-semibold text-gray-800">{activeTicket.invoiceNumber}</span>
                  </div>
                </div>

                {/* Perforation */}
                <div className="relative h-6 flex items-center bg-white">
                  <div className="w-5 h-5 rounded-full bg-gray-50 border border-gray-200 -ml-2.5" />
                  <div className="flex-1 border-t-2 border-dashed border-gray-300 mx-2" />
                  <div className="w-5 h-5 rounded-full bg-gray-50 border border-gray-200 -mr-2.5" />
                </div>

                {/* QR Stub */}
                <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center gap-6">
                  <div className="p-3 bg-white rounded-2xl border border-gray-300 shrink-0">
                    <QrMatrixSvg value={activeTicket.qrPayload} size={140} />
                  </div>
                  <div className="space-y-2 text-center sm:text-left min-w-0">
                    <p className="font-mono text-base font-extrabold text-gray-900">
                      {activeTicket.ticketCode}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Tunjukkan kode QR ini ke petugas loket saat tiba di lokasi. Setiap tiket
                      hanya berlaku untuk 1 kali masuk.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Riwayat Transaksi Lainnya (Lunas / Dibatalkan / Kedaluwarsa) */}
      {otherTransactions.length > 0 && (
        <section aria-label="Riwayat transaksi" className="space-y-3 pt-2">
          <h2 className="text-base font-extrabold text-gray-900">Riwayat Transaksi</h2>
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
            {otherTransactions.map((tx) => {
              const meta = TX_STATUS_META[tx.paymentStatus];
              return (
                <div
                  key={tx.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{tx.venueName}</p>
                    <p className="text-xs text-gray-600">
                      {tx.invoiceNumber} · {formatTanggalID(tx.bookingDate)} ·{' '}
                      {formatRupiah(tx.totalAmount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.className}`}>
                      {meta.label}
                    </span>
                    <Link
                      to={`/checkout/${tx.id}`}
                      className="text-xs font-bold text-gray-700 hover:text-gray-900 underline"
                    >
                      Detail
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
