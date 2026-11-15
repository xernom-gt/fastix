import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatTanggalID, StatusBadge, type RedemptionStatus } from '@pariwisloka/shared';
import { BookingStepper } from '../components/BookingStepper';
import { QrMatrixSvg } from '../components/QrMatrixSvg';
import { useAuth } from '../store/authStore';
import { useBookings } from '../store/bookingStore';

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

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(ticketCode ? `/tiket/${ticketCode}` : '/tiket')}`} replace />;
  }

  const activeTicket =
    (ticketCode ? tickets.find((t) => t.ticketCode === ticketCode) : null) ??
    filteredTickets[0] ??
    null;

  const pendingTransactions = transactions.filter((t) => t.paymentStatus === 'PENDING');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            Tiket &amp; Riwayat Transaksi
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Tunjukkan QR E-Ticket saat tiba di pintu gerbang destinasi wisata.
          </p>
        </div>
        <Link
          to="/explore"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold"
        >
          Pesan Tiket Baru
        </Link>
      </div>

      {/* Pending QRIS Notice */}
      {pendingTransactions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
            Menunggu Pembayaran QRIS ({pendingTransactions.length})
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            {pendingTransactions.map((tx) => (
              <Link
                key={tx.id}
                to={`/checkout/${tx.id}`}
                className="inline-flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 text-xs font-bold text-gray-900"
              >
                <span>
                  {tx.venueName} · {tx.invoiceNumber}
                </span>
                <StatusBadge module="payment" status={tx.paymentStatus} size="sm" />
              </Link>
            ))}
          </div>
        </div>
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
            placeholder="Cari kode tiket (PWL-TIX-...) atau nama wisata..."
            className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-300 text-sm text-gray-900"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'VALID', 'REDEEMED', 'EXPIRED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border min-h-[40px] ${
                statusFilter === st
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {st === 'ALL' ? 'Semua' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: List + E-Pass Preview */}
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
                    <span className="text-xs font-extrabold text-gray-900">{t.ticketCode}</span>
                    <StatusBadge module="redemption" status={t.status} size="sm" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">{t.venueName}</p>
                  <p className="text-xs text-gray-600">
                    {t.ticketTitle} · {formatTanggalID(t.bookingDate)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active E-Pass Detail */}
          {activeTicket && (
            <div className="lg:col-span-7 space-y-4">
              <BookingStepper currentStep={3} />
              <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden">
                <div className="bg-gray-900 text-white p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        Fastix E-Pass · {activeTicket.venueCode}
                      </span>
                      <h2 className="text-xl font-extrabold mt-0.5">{activeTicket.venueName}</h2>
                    </div>
                    <StatusBadge module="redemption" status={activeTicket.status} size="sm" />
                  </div>
                  <p className="text-xs text-gray-300">{activeTicket.venueAddress}</p>
                </div>

                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="block text-[11px] font-bold uppercase text-gray-500">Tanggal Masuk</span>
                    <span className="font-bold text-gray-900">{formatTanggalID(activeTicket.bookingDate)}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase text-gray-500">Jenis Tiket</span>
                    <span className="font-bold text-gray-900">{activeTicket.ticketTitle}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase text-gray-500">Pemegang</span>
                    <span className="font-bold text-gray-900">{activeTicket.holderName}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="block text-[11px] font-bold uppercase text-gray-500">Nomor Invoice</span>
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
                    <p className="text-base font-extrabold text-gray-900">{activeTicket.ticketCode}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Tunjukkan kode QR ini ke petugas Fastix Gate saat tiba di lokasi. Setiap tiket
                      hanya berlaku untuk 1 kali pemindaian.
                    </p>
                    <p className="text-[11px] font-mono text-gray-500 break-all">
                      HMAC Payload: {activeTicket.qrPayload}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
