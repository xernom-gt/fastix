import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatRupiah, formatTanggalID, type PaymentStatus } from '@pariwisloka/shared';
import { BookingStepper } from '../components/BookingStepper';
import { QrMatrixSvg } from '../components/QrMatrixSvg';
import { useAuth } from '../store/authStore';
import { useBookings } from '../store/bookingStore';

interface MidtransSnapCallbacks {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    snap?: {
      pay: (snapToken: string, callbacks?: MidtransSnapCallbacks) => void;
    };
  }
}

const MIDTRANS_ENV =
  (import.meta.env.VITE_MIDTRANS_ENV as string | undefined)?.trim() || 'sandbox';
const MIDTRANS_CLIENT_KEY =
  (import.meta.env.VITE_MIDTRANS_CLIENT_KEY as string | undefined)?.trim() ||
  (MIDTRANS_ENV === 'production' ? '' : 'SB-Mid-client-sE4oCCcuGuVAqdxbn7x76s2D');
const MIDTRANS_SNAP_URL =
  MIDTRANS_ENV === 'production'
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, { text: string; className: string }> = {
  PENDING: {
    text: 'Menunggu Pembayaran QRIS',
    className: 'bg-amber-100 text-amber-900',
  },
  PAID: {
    text: 'Pembayaran Lunas',
    className: 'bg-emerald-100 text-emerald-900',
  },
  REFUNDED: {
    text: 'Dana Dikembalikan',
    className: 'bg-blue-100 text-blue-900',
  },
  EXPIRED: {
    text: 'Waktu Habis',
    className: 'bg-gray-200 text-gray-700',
  },
  CANCELLED: {
    text: 'Dibatalkan',
    className: 'bg-red-100 text-red-800',
  },
};

export default function CheckoutPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const {
    transactions,
    fetchBooking,
    refreshTickets,
    simulateWebhookPaid,
    cancelTransaction,
    expireTransaction,
  } = useBookings();

  const tx = transactions.find((t) => t.id === invoiceId || t.invoiceNumber === invoiceId);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!tx) return 0;
    return Math.max(0, Math.floor((new Date(tx.expiredAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!MIDTRANS_CLIENT_KEY && !tx?.snapToken) return;
    const scriptId = 'fastix-midtrans-snap';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (MIDTRANS_CLIENT_KEY && !existing.getAttribute('data-client-key')) {
        existing.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = MIDTRANS_SNAP_URL;
    if (MIDTRANS_CLIENT_KEY) {
      script.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY);
    }
    script.async = true;
    document.body.appendChild(script);
  }, [tx?.snapToken]);

  useEffect(() => {
    if (!invoiceId || !isAuthenticated) return;
    void fetchBooking(invoiceId);
  }, [invoiceId, isAuthenticated, fetchBooking]);

  useEffect(() => {
    if (!tx || tx.paymentStatus !== 'PENDING') return;
    const timer = window.setInterval(() => {
      const rem = Math.max(0, Math.floor((new Date(tx.expiredAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem === 0) {
        expireTransaction(tx.id);
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [tx, expireTransaction]);

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(`/checkout/${invoiceId ?? ''}`)}`} replace />;
  }

  if (!tx) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Transaksi tidak ditemukan</h1>
        <p className="text-sm text-gray-600">Nomor invoice yang Anda buka tidak tersedia di sesi ini.</p>
        <Link to="/explore" className="inline-block px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold">
          Kembali ke Katalog
        </Link>
      </div>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const syncStatusAfterSnap = async () => {
    setIsPaying(true);
    try {
      const updated = await fetchBooking(tx.id);
      if (updated?.paymentStatus === 'PAID') {
        await refreshTickets();
        navigate('/tiket');
      }
    } finally {
      setIsPaying(false);
    }
  };

  const handleMidtransPay = () => {
    if (!tx.snapToken) return;
    setPayError('');

    if (window.snap?.pay) {
      window.snap.pay(tx.snapToken, {
        onSuccess: () => {
          void syncStatusAfterSnap();
        },
        onPending: () => {
          void syncStatusAfterSnap();
        },
        onError: () => {
          setPayError('Pembayaran gagal atau ditolak. Silakan coba lagi.');
          void fetchBooking(tx.id);
        },
        onClose: () => {
          void syncStatusAfterSnap();
        },
      });
      return;
    }

    if (tx.snapRedirectUrl) {
      window.open(tx.snapRedirectUrl, '_blank', 'noopener,noreferrer');
      void fetchBooking(tx.id);
      return;
    }

    setPayError('Popup pembayaran Midtrans sedang dimuat. Silakan coba beberapa saat lagi.');
  };

  const handleOpenMidtransTab = () => {
    if (!tx.snapRedirectUrl) return;
    setPayError('');
    window.open(tx.snapRedirectUrl, '_blank', 'noopener,noreferrer');
    void fetchBooking(tx.id);
  };

  const handleSimulatePaid = async () => {
    setPayError('');
    setIsPaying(true);
    try {
      const issued = await simulateWebhookPaid(tx.id, user.fullName);
      if (issued.length > 0) {
        navigate(`/tiket/${issued[0].ticketCode}`);
      } else {
        navigate('/tiket');
      }
    } catch (err: unknown) {
      setPayError(
        err instanceof Error ? err.message : 'Gagal memproses pembayaran. Silakan coba lagi.',
      );
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <BookingStepper currentStep={tx.paymentStatus === 'PAID' ? 3 : 2} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Invoice Pembayaran QRIS
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">{tx.invoiceNumber}</h1>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-bold ${PAYMENT_STATUS_LABEL[tx.paymentStatus].className}`}
        >
          {PAYMENT_STATUS_LABEL[tx.paymentStatus].text}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* QRIS Box */}
        <div className="md:col-span-6 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
          {tx.paymentStatus === 'PENDING' ? (
            <>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Batas Waktu Pembayaran
              </div>
              <div className="text-3xl font-extrabold tabular-nums text-gray-900">
                {mm}:{ss}
              </div>
              <div className="p-4 rounded-2xl border border-gray-200 bg-white">
                <QrMatrixSvg value={tx.qrString} size={180} />
              </div>
              <p className="text-xs text-gray-600">
                Pindai kode QRIS di atas melalui aplikasi bank atau dompet digital Anda untuk
                menyelesaikan pembayaran.
              </p>
              <p className="text-xs font-medium text-gray-500">
                Mendukung pembayaran langsung via Midtrans Snap &amp; Simulator QRIS Sandbox
              </p>
            </>
          ) : (
            <div className="py-10 space-y-3">
              <span className="material-symbols-outlined text-[48px] text-gray-700" aria-hidden="true">
                {tx.paymentStatus === 'PAID' ? 'check_circle' : 'cancel'}
              </span>
              <h2 className="text-lg font-bold text-gray-900">
                {tx.paymentStatus === 'PAID'
                  ? 'Pembayaran Lunas'
                  : tx.paymentStatus === 'CANCELLED'
                    ? 'Pesanan Dibatalkan'
                    : 'Waktu Pembayaran Habis'}
              </h2>
              <p className="text-xs text-gray-600">
                {tx.paymentStatus === 'PAID'
                  ? 'E-Ticket QR telah diterbitkan dan tersimpan di menu Tiket Saya.'
                  : 'Kuota tiket telah dilepaskan kembali ke sistem.'}
              </p>
              <Link
                to={tx.paymentStatus === 'PAID' ? '/tiket' : `/destinasi/${tx.venueId}`}
                className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold"
              >
                {tx.paymentStatus === 'PAID' ? 'Lihat E-Ticket Saya' : 'Pesan Ulang'}
              </Link>
            </div>
          )}
        </div>

        {/* Summary & Mock Webhook Controls */}
        <div className="md:col-span-6 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-extrabold text-gray-900">Ringkasan Pesanan</h2>
            <div className="text-sm space-y-1">
              <p className="font-bold text-gray-900">{tx.venueName}</p>
              <p className="text-xs text-gray-600">
                Tanggal Kunjungan: {formatTanggalID(tx.bookingDate)}
              </p>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
              {tx.items.map((item) => (
                <div key={item.ticketId} className="flex justify-between text-gray-700">
                  <span>
                    {item.ticketTitle} ({item.quantity}x)
                  </span>
                  <span className="font-semibold">{formatRupiah(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between text-gray-600">
                <span>Biaya Layanan Platform</span>
                <span>{formatRupiah(tx.platformFee)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total Tagihan</span>
                <span>{formatRupiah(tx.totalAmount)}</span>
              </div>
            </div>
          </div>

          {tx.paymentStatus === 'PENDING' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-bold text-gray-700">
                Konfirmasi Pembayaran
              </p>
              {payError && (
                <p role="alert" className="text-xs font-semibold text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                  {payError}
                </p>
              )}
              {tx.snapToken ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={isPaying}
                    onClick={handleMidtransPay}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-gray-900 hover:bg-black disabled:opacity-60 text-white text-sm font-bold transition-colors"
                  >
                    {isPaying ? 'Memeriksa Status...' : 'Bayar dengan Midtrans (Popup Snap)'}
                  </button>
                  {tx.snapRedirectUrl && (
                    <button
                      type="button"
                      disabled={isPaying}
                      onClick={handleOpenMidtransTab}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-gray-900 hover:bg-gray-50 disabled:opacity-60 text-gray-900 text-xs font-bold transition-colors"
                    >
                      Buka Halaman Pembayaran Midtrans (Tab Baru)
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tx.snapRedirectUrl && (
                    <button
                      type="button"
                      disabled={isPaying}
                      onClick={handleOpenMidtransTab}
                      className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-gray-900 hover:bg-black disabled:opacity-60 text-white text-sm font-bold transition-colors"
                    >
                      Buka Halaman Pembayaran Midtrans (Tab Baru)
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPaying}
                    onClick={handleSimulatePaid}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-gray-900 hover:bg-black disabled:opacity-60 text-white text-sm font-bold transition-colors"
                  >
                    {isPaying ? 'Memproses Pembayaran...' : 'Bayar Sekarang'}
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={isPaying}
                onClick={() => cancelTransaction(tx.id)}
                className="w-full py-2.5 px-4 rounded-xl border border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-xs font-bold transition-colors"
              >
                Batalkan Pesanan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
