import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatRupiah, formatTanggalID, type PaymentStatus } from '@pariwisloka/shared';
import { BookingStepper } from '../components/BookingStepper';
import { QrMatrixSvg } from '../components/QrMatrixSvg';
import { useAuth } from '../store/authStore';
import { useBookings } from '../store/bookingStore';

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
    expireTransaction,
  } = useBookings();

  const tx = transactions.find((t) => t.id === invoiceId || t.invoiceNumber === invoiceId);
  const txId = tx?.id;
  const paymentStatus = tx?.paymentStatus;
  const expiredAt = tx?.expiredAt;

  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!expiredAt) return 0;
    return Math.max(0, Math.floor((new Date(expiredAt).getTime() - Date.now()) / 1000));
  });

  const fetchBookingRef = useRef(fetchBooking);
  fetchBookingRef.current = fetchBooking;
  const refreshTicketsRef = useRef(refreshTickets);
  refreshTicketsRef.current = refreshTickets;
  const expireTransactionRef = useRef(expireTransaction);
  expireTransactionRef.current = expireTransaction;

  useEffect(() => {
    if (!invoiceId || !isAuthenticated) return;
    void fetchBookingRef.current(invoiceId);
  }, [invoiceId, isAuthenticated]);

  useEffect(() => {
    if (!txId || paymentStatus !== 'PENDING' || !expiredAt) return;

    const computeRemaining = () =>
      Math.max(0, Math.floor((new Date(expiredAt).getTime() - Date.now()) / 1000));

    const initial = computeRemaining();
    setSecondsLeft(initial);
    if (initial === 0) {
      expireTransactionRef.current(txId);
      return;
    }

    const timer = window.setInterval(() => {
      const rem = computeRemaining();
      setSecondsLeft(rem);
      if (rem === 0) {
        expireTransactionRef.current(txId);
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [txId, paymentStatus, expiredAt]);

  useEffect(() => {
    if (!invoiceId || !isAuthenticated || paymentStatus !== 'PENDING') return;
    const poller = window.setInterval(() => {
      void fetchBookingRef.current(invoiceId);
    }, 3000);
    return () => window.clearInterval(poller);
  }, [invoiceId, isAuthenticated, paymentStatus]);

  useEffect(() => {
    if (paymentStatus !== 'PAID') return;
    let active = true;
    void refreshTicketsRef
      .current()
      .catch(() => {
        // ignore ticket refresh error before redirect
      })
      .finally(() => {
        if (active) {
          navigate('/tiket', { replace: true });
        }
      });
    return () => {
      active = false;
    };
  }, [paymentStatus, navigate]);

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(`/checkout/${invoiceId ?? ''}`)}`} replace />;
  }

  if (!tx) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Transaksi tidak ditemukan</h1>
        <p className="text-sm text-gray-600">Nomor invoice yang Anda buka tidak tersedia di sesi ini.</p>
        <Link
          to="/explore"
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
        >
          Kembali ke Katalog
        </Link>
      </div>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <BookingStepper currentStep={tx.paymentStatus === 'PAID' ? 3 : 2} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
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
              <div className="text-xs font-bold uppercase tracking-wider text-gray-600">
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
                className="inline-flex items-center justify-center min-h-[44px] mt-2 px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
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
            <div
              role="status"
              aria-live="polite"
              className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600" />
                </span>
                <h2 className="text-sm font-bold text-gray-900">
                  Menunggu Pembayaran Otomatis
                </h2>
              </div>
              <p className="text-xs leading-relaxed text-gray-600">
                Sistem memeriksa status pembayaran Anda setiap beberapa detik. Halaman ini akan
                otomatis berpindah ke E-Ticket setelah QRIS berhasil dibayar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
