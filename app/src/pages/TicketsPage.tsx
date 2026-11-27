import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  formatRupiah,
  formatTanggalID,
  type ETicket,
  type PaymentStatus,
  type RedemptionStatus,
} from '@pariwisloka/shared';
import { QrMatrixSvg } from '../components/QrMatrixSvg';
import { useAuth } from '../store/authStore';
import { useBookings } from '../store/bookingStore';

type TabKey = 'active' | 'pending' | 'history';
type HistoryStatusFilter = 'ALL' | Exclude<RedemptionStatus, 'VALID'>;

const TICKET_STATUS_META: Record<RedemptionStatus, { label: string; className: string }> = {
  VALID: { label: 'Siap Digunakan', className: 'bg-[#111827] text-white' },
  REDEEMED: { label: 'Sudah Masuk', className: 'bg-gray-200 text-gray-800' },
  REFUNDED: {
    label: 'Dana Dikembalikan',
    className: 'bg-blue-100 text-blue-900 border border-blue-200',
  },
  EXPIRED: { label: 'Kedaluwarsa', className: 'bg-red-100 text-red-900' },
};

const TX_STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING: { label: 'Menunggu Pembayaran', className: 'bg-amber-100 text-amber-900' },
  PAID: { label: 'Lunas', className: 'bg-emerald-100 text-emerald-900' },
  REFUNDED: { label: 'Dana Dikembalikan', className: 'bg-blue-100 text-blue-900' },
  EXPIRED: { label: 'Kedaluwarsa', className: 'bg-gray-200 text-gray-800' },
  CANCELLED: { label: 'Dibatalkan', className: 'bg-red-100 text-red-900' },
};

const HISTORY_FILTERS: ReadonlyArray<{ key: HistoryStatusFilter; label: string }> = [
  { key: 'ALL', label: 'Semua' },
  { key: 'REDEEMED', label: 'Sudah Masuk' },
  { key: 'REFUNDED', label: 'Dana Dikembalikan' },
  { key: 'EXPIRED', label: 'Kedaluwarsa' },
];

interface TicketDetailCardProps {
  ticket: ETicket;
  isTearing?: boolean;
  onClose?: () => void;
}

function TicketDetailCard({ ticket, isTearing = false, onClose }: TicketDetailCardProps) {
  const statusMeta = TICKET_STATUS_META[ticket.status];

  return (
    <div className="relative rounded-3xl">
      {/* Top Half: Header + Ticket Info */}
      <div
        className={`bg-white border border-b-0 border-gray-200 rounded-t-3xl overflow-hidden transition-all duration-700 ease-out motion-reduce:transform-none ${
          isTearing ? '-translate-y-4 -rotate-1' : ''
        }`}
      >
        <div className="bg-[#111827] text-white p-5 sm:p-6 space-y-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-bold text-gray-300">Tiket Masuk Resmi Fastix</span>
              <h2 className="text-lg sm:text-xl font-extrabold mt-0.5 break-words">
                {ticket.venueName}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  ticket.status === 'VALID'
                    ? 'bg-white text-[#111827]'
                    : ticket.status === 'REFUNDED'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-white/15 text-gray-100'
                }`}
              >
                {statusMeta.label}
              </span>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup detail tiket"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed break-words">{ticket.venueAddress}</p>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-600">
              Tanggal Masuk
            </span>
            <span className="font-bold text-gray-900 block mt-0.5">
              {formatTanggalID(ticket.bookingDate)}
            </span>
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-600">
              Jenis Tiket
            </span>
            <span className="font-bold text-gray-900 block mt-0.5 break-words">
              {ticket.ticketTitle}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-600">
              Pemegang
            </span>
            <span className="font-bold text-gray-900 block mt-0.5 break-words">
              {ticket.holderName}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-3 min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-600">
              Nomor Invoice
            </span>
            <span className="font-mono text-xs sm:text-sm font-semibold text-gray-800 block mt-0.5 break-all">
              {ticket.invoiceNumber}
            </span>
          </div>
        </div>
      </div>

      {/* Perforation line */}
      <div
        className={`relative h-6 flex items-center transition-colors duration-500 ${
          isTearing ? 'bg-transparent' : 'bg-white border-x border-gray-200'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-gray-50 border border-gray-200 -ml-2.5 shrink-0 transition-opacity duration-300 ${
            isTearing ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-2" />
        <div
          className={`w-5 h-5 rounded-full bg-gray-50 border border-gray-200 -mr-2.5 shrink-0 transition-opacity duration-300 ${
            isTearing ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {isTearing && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none px-2">
            <span className="px-3.5 py-1 rounded-full bg-emerald-700 text-white text-[11px] font-extrabold tracking-wide shadow-sm animate-pulse motion-reduce:animate-none">
              CHECK-IN BERHASIL · TIKET TERPAKAI
            </span>
          </div>
        )}
      </div>

      {/* QR Stub (Bottom Half) */}
      <div
        className={`p-5 sm:p-6 bg-gray-50 border border-gray-200 rounded-b-3xl flex flex-col sm:flex-row items-center gap-5 sm:gap-6 transition-all duration-700 ease-out motion-reduce:transform-none ${
          isTearing ? 'translate-y-5 rotate-1 opacity-75' : ''
        }`}
      >
        <div className="p-3.5 bg-white rounded-2xl border border-gray-200 shrink-0 relative">
          <QrMatrixSvg value={ticket.qrPayload} size={156} />
          {ticket.status === 'REFUNDED' && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center p-2 text-center">
              <span
                className="material-symbols-outlined text-[28px] text-blue-800"
                aria-hidden="true"
              >
                currency_exchange
              </span>
              <span className="text-[11px] font-extrabold text-blue-900 mt-1">REFUNDED</span>
            </div>
          )}
        </div>
        <div className="space-y-2 text-center sm:text-left min-w-0">
          <p className="font-mono text-base font-extrabold text-gray-900 tracking-wide break-all">
            {ticket.ticketCode}
          </p>
          {ticket.status === 'REFUNDED' ? (
            <div className="space-y-1">
              <p className="text-xs font-bold text-blue-900">Dana Dikembalikan Otomatis</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Tiket tidak digunakan dalam kurun waktu 7 hari sejak tanggal kunjungan (
                {formatTanggalID(ticket.bookingDate)}). Sesuai kebijakan Fastix, dana pemesanan
                telah dikembalikan ke metode pembayaran awal.
              </p>
            </div>
          ) : ticket.status === 'VALID' ? (
            <p className="text-xs text-gray-600 leading-relaxed">
              Tunjukkan kode QR ini ke petugas loket saat tiba di lokasi. Setiap tiket hanya berlaku
              untuk 1 kali masuk.
            </p>
          ) : ticket.status === 'REDEEMED' ? (
            <p className="text-xs text-gray-600 leading-relaxed">
              Tiket ini sudah dipindai di pintu masuk dan tidak dapat digunakan kembali.
            </p>
          ) : (
            <p className="text-xs text-gray-600 leading-relaxed">
              Masa berlaku tiket ini telah berakhir dan tidak dapat digunakan untuk masuk.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const { ticketCode } = useParams<{ ticketCode: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { tickets, transactions, refreshTickets } = useBookings();

  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [query, setQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryStatusFilter>('ALL');
  const [selectedTicketCode, setSelectedTicketCode] = useState<string | null>(null);
  const [selectedHistoryCode, setSelectedHistoryCode] = useState<string | null>(null);
  const [isTearing, setIsTearing] = useState(false);
  const [tornTicket, setTornTicket] = useState<ETicket | null>(null);
  const autoSyncedCodeRef = useRef<string | null>(null);
  const prevStatusRef = useRef<{ code: string; status: RedemptionStatus } | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      void refreshTickets();
    }
  }, [isAuthenticated, refreshTickets]);

  useEffect(() => {
    if (!ticketCode) {
      autoSyncedCodeRef.current = null;
      return;
    }
    if (autoSyncedCodeRef.current === ticketCode) return;

    const matched = tickets.find((t) => t.ticketCode === ticketCode);
    if (!matched) return;

    autoSyncedCodeRef.current = ticketCode;
    if (matched.status === 'VALID') {
      setActiveTab('active');
      setSelectedTicketCode(matched.ticketCode);
    } else {
      setActiveTab('history');
      setSelectedHistoryCode(matched.ticketCode);
    }
  }, [ticketCode, tickets]);

  const validTickets = useMemo(() => tickets.filter((t) => t.status === 'VALID'), [tickets]);
  const hasValidTicket = validTickets.length > 0;

  useEffect(() => {
    if (!isAuthenticated || !hasValidTicket) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshTickets();
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, hasValidTicket, refreshTickets]);

  const selectedValidTicket = useMemo(
    () =>
      (selectedTicketCode ? validTickets.find((t) => t.ticketCode === selectedTicketCode) : null) ??
      (ticketCode ? validTickets.find((t) => t.ticketCode === ticketCode) : null) ??
      null,
    [selectedTicketCode, ticketCode, validTickets]
  );

  const desktopActiveTicket = tornTicket ?? selectedValidTicket ?? validTickets[0] ?? null;
  const mobileModalTicket = tornTicket ?? selectedValidTicket;

  useEffect(() => {
    if (activeTab !== 'active') {
      prevStatusRef.current = null;
      return;
    }
    if (isTearing || tornTicket) return;

    const prev = prevStatusRef.current;
    if (prev && prev.status === 'VALID') {
      const updatedPrev = tickets.find((t) => t.ticketCode === prev.code);
      if (updatedPrev && updatedPrev.status === 'REDEEMED') {
        prevStatusRef.current = { code: updatedPrev.ticketCode, status: 'REDEEMED' };
        setTornTicket(updatedPrev);
        setIsTearing(true);
        return;
      }
    }

    const currentViewed = selectedValidTicket ?? validTickets[0] ?? null;
    prevStatusRef.current = currentViewed
      ? { code: currentViewed.ticketCode, status: currentViewed.status }
      : null;
  }, [activeTab, tickets, selectedValidTicket, validTickets, isTearing, tornTicket]);

  useEffect(() => {
    if (!isTearing) return;
    const timer = window.setTimeout(() => {
      setIsTearing(false);
      setTornTicket(null);
      setSelectedTicketCode(null);
      if (ticketCode) {
        navigate('/tiket', { replace: true });
      }
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [isTearing, ticketCode, navigate]);

  const handleCloseActiveModal = useCallback(() => {
    setIsTearing(false);
    setTornTicket(null);
    setSelectedTicketCode(null);
    if (ticketCode) {
      navigate('/tiket', { replace: true });
    }
  }, [ticketCode, navigate]);

  useEffect(() => {
    if (activeTab !== 'active' || !mobileModalTicket) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseActiveModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, mobileModalTicket, handleCloseActiveModal]);

  const historyTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (t.status === 'VALID') return false;
      if (historyFilter !== 'ALL' && t.status !== historyFilter) return false;
      if (q) {
        const hay = `${t.ticketCode} ${t.invoiceNumber} ${t.venueName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, query, historyFilter]);

  const pendingTransactions = useMemo(
    () => transactions.filter((t) => t.paymentStatus === 'PENDING'),
    [transactions]
  );

  const otherTransactions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (tx.paymentStatus === 'PENDING') return false;
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

  const handleSelectActiveTicket = (code: string) => {
    setSelectedTicketCode(code);
    navigate(`/tiket/${code}`);
  };

  const selectedHistoryTicket =
    (selectedHistoryCode ? historyTickets.find((t) => t.ticketCode === selectedHistoryCode) : null) ??
    (ticketCode ? historyTickets.find((t) => t.ticketCode === ticketCode) : null) ??
    null;

  const handleSelectHistoryTicket = (code: string) => {
    setSelectedHistoryCode(code);
    navigate(`/tiket/${code}`);
  };

  const handleCloseHistoryDetail = () => {
    setSelectedHistoryCode(null);
    if (ticketCode) {
      navigate('/tiket', { replace: true });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            Pesanan Saya
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Tunjukkan kode QR tiket aktif di pintu masuk atau pantau status pembayaran Anda.
          </p>
        </div>
        <Link
          to="/explore"
          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl bg-[#111827] hover:bg-[#090D16] text-white text-sm font-bold transition-colors shrink-0"
        >
          Pesan Tiket Baru
        </Link>
      </div>

      {/* Segmented Tab Bar */}
      <div
        role="tablist"
        aria-label="Kategori pesanan dan tiket"
        className="grid grid-cols-3 sm:inline-flex gap-1 p-1 bg-gray-100 border border-gray-200 rounded-2xl w-full sm:w-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'active'}
          onClick={() => setActiveTab('active')}
          className={`min-h-[44px] px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 min-w-0 ${
            activeTab === 'active'
              ? 'bg-[#111827] text-white'
              : 'text-gray-700 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <span className="truncate">Tiket Aktif</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[11px] font-extrabold leading-none shrink-0 ${
              activeTab === 'active' ? 'bg-white text-[#111827]' : 'bg-gray-200 text-gray-800'
            }`}
          >
            {validTickets.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          className={`min-h-[44px] px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 min-w-0 ${
            activeTab === 'pending'
              ? 'bg-[#111827] text-white'
              : 'text-gray-700 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <span className="truncate">Menunggu Bayar</span>
          {pendingTransactions.length > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[11px] font-extrabold leading-none shrink-0 ${
                activeTab === 'pending'
                  ? 'bg-amber-300 text-gray-900'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {pendingTransactions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          className={`min-h-[44px] px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 min-w-0 ${
            activeTab === 'history'
              ? 'bg-[#111827] text-white'
              : 'text-gray-700 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <span className="truncate">Riwayat</span>
        </button>
      </div>

      {/* Tab 1: Tiket Aktif */}
      {activeTab === 'active' && (
        <section aria-label="Tiket aktif">
          {validTickets.length === 0 && !tornTicket ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 mx-auto flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[24px] text-gray-700"
                  aria-hidden="true"
                >
                  confirmation_number
                </span>
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-gray-900">Belum ada tiket aktif</h2>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Tiket yang siap digunakan di pintu masuk akan tampil di sini setelah pembayaran
                  berhasil.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <Link
                  to="/explore"
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-[#090D16] text-white text-sm font-bold transition-colors"
                >
                  Jelajahi Destinasi
                </Link>
                {pendingTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('pending')}
                    className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 text-sm font-bold transition-colors"
                  >
                    Lihat Menunggu Bayar ({pendingTransactions.length})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Desktop: Right column QR Detail Card (hidden on mobile < lg) */}
                {desktopActiveTicket && (
                  <div className="hidden lg:block lg:col-span-7 lg:order-last min-w-0">
                    <TicketDetailCard ticket={desktopActiveTicket} isTearing={isTearing} />
                  </div>
                )}

                {/* Ticket List: clean list on mobile, left column on desktop */}
                <div className="lg:col-span-5 lg:order-first space-y-3 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-600 lg:hidden">
                    Daftar Tiket Aktif ({validTickets.length})
                  </p>
                  {validTickets.map((t) => {
                    const selected = desktopActiveTicket?.id === t.id;
                    const badge = TICKET_STATUS_META[t.status];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectActiveTicket(t.ticketCode)}
                        className={`w-full min-h-[44px] text-left p-4 rounded-2xl border transition-colors space-y-2 ${
                          selected
                            ? 'bg-white border-gray-200 lg:border-[#111827] lg:ring-1 lg:ring-[#111827] hover:bg-gray-50 lg:hover:bg-white'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-extrabold text-gray-900 truncate">
                            {t.ticketCode}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-gray-900 truncate">{t.venueName}</p>
                        <p className="text-xs text-gray-600 truncate">
                          {t.ticketTitle} · {formatTanggalID(t.bookingDate)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Modal Overlay (< lg) */}
              {mobileModalTicket && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Detail E-Ticket"
                  onClick={handleCloseActiveModal}
                  className="lg:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden px-1 py-6"
                  >
                    <TicketDetailCard
                      ticket={mobileModalTicket}
                      isTearing={isTearing}
                      onClose={handleCloseActiveModal}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Tab 2: Menunggu Bayar */}
      {activeTab === 'pending' && (
        <section aria-label="Menunggu pembayaran" className="space-y-4">
          {pendingTransactions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 mx-auto flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[24px] text-gray-700"
                  aria-hidden="true"
                >
                  receipt_long
                </span>
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-gray-900">
                  Tidak ada pesanan menunggu bayar
                </h2>
                <p className="text-sm text-gray-600">
                  Semua transaksi QRIS Anda sudah selesai atau belum ada pesanan baru.
                </p>
              </div>
              <Link
                to="/explore"
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-[#090D16] text-white text-sm font-bold transition-colors"
              >
                Cari Wisata
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingTransactions.map((tx) => (
                <Link
                  key={tx.id}
                  to={`/checkout/${tx.id}`}
                  className="min-h-[44px] bg-white border border-gray-200 hover:border-gray-400 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-extrabold text-gray-900 truncate">{tx.venueName}</p>
                    <p className="font-mono text-xs text-gray-600 truncate">{tx.invoiceNumber}</p>
                    <p className="text-xs text-gray-700 font-medium">
                      {formatTanggalID(tx.bookingDate)} ·{' '}
                      <span className="font-extrabold text-gray-900">
                        {formatRupiah(tx.totalAmount)}
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl bg-amber-100 text-amber-900 text-xs font-bold shrink-0">
                    Bayar
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      arrow_forward
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Riwayat */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Search & Filter for History Tickets */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 min-w-0">
              <label htmlFor="ticket-history-search" className="sr-only">
                Cari kode tiket, invoice, atau nama wisata
              </label>
              <input
                id="ticket-history-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kode tiket, invoice, atau nama wisata..."
                className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:border-[#111827] focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {HISTORY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setHistoryFilter(f.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border min-h-[44px] transition-colors ${
                    historyFilter === f.key
                      ? 'bg-[#111827] text-white border-[#111827]'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selected History Ticket Detail */}
          {selectedHistoryTicket && (
            <section aria-label="Detail tiket riwayat">
              <TicketDetailCard
                ticket={selectedHistoryTicket}
                onClose={handleCloseHistoryDetail}
              />
            </section>
          )}

          {/* History Tickets List */}
          <section aria-label="Daftar tiket riwayat" className="space-y-3">
            <h2 className="text-base font-extrabold text-gray-900">Tiket Sebelumnya</h2>
            {historyTickets.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-2">
                <p className="text-sm font-bold text-gray-900">Tidak ada tiket riwayat yang cocok</p>
                <p className="text-xs text-gray-600">
                  Tiket yang sudah masuk, dikembalikan dananya, atau kedaluwarsa akan tampil di
                  sini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {historyTickets.map((t) => {
                  const selected = selectedHistoryTicket?.id === t.id;
                  const badge = TICKET_STATUS_META[t.status];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectHistoryTicket(t.ticketCode)}
                      className={`w-full min-h-[44px] text-left p-4 rounded-2xl border transition-colors space-y-2 ${
                        selected
                          ? 'bg-white border-[#111827] ring-1 ring-[#111827]'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-extrabold text-gray-900 truncate">
                          {t.ticketCode}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 truncate">{t.venueName}</p>
                      <p className="text-xs text-gray-600 truncate">
                        {t.ticketTitle} · {formatTanggalID(t.bookingDate)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Riwayat Transaksi */}
          <section aria-label="Riwayat transaksi" className="space-y-3">
            <h2 className="text-base font-extrabold text-gray-900">Riwayat Transaksi</h2>
            {otherTransactions.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                <p className="text-sm font-bold text-gray-900">Belum ada riwayat transaksi</p>
              </div>
            ) : (
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
                        <p className="text-xs text-gray-600 break-words">
                          {tx.invoiceNumber} · {formatTanggalID(tx.bookingDate)} ·{' '}
                          {formatRupiah(tx.totalAmount)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                        <Link
                          to={`/checkout/${tx.id}`}
                          className="inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl text-xs font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-100 underline transition-colors"
                        >
                          Detail
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
