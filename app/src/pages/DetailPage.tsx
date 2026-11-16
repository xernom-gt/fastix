import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatRupiah, getTodayISO } from '@pariwisloka/shared';
import { BookingStepper } from '../components/BookingStepper';
import { useAuth } from '../store/authStore';
import { useBookings } from '../store/bookingStore';

const PLATFORM_FEE_PER_TICKET = 2500;

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { createCheckout, getExtraUsedQuota, getVenueById } = useBookings();

  const venue = id ? getVenueById(id) : undefined;

  const [bookingDate, setBookingDate] = useState(searchParams.get('tanggal') ?? getTodayISO());
  const [selectedTicketId, setSelectedTicketId] = useState(venue?.tickets[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  if (!venue) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Destinasi tidak ditemukan</h1>
        <p className="text-sm text-gray-600">
          Destinasi yang Anda cari tidak tersedia atau belum dipublikasikan.
        </p>
        <Link
          to="/explore"
          className="inline-block px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold"
        >
          Kembali ke Katalog
        </Link>
      </div>
    );
  }

  const activeTicket = venue.tickets.find((t) => t.id === selectedTicketId) ?? venue.tickets[0];
  const usedQuota =
    activeTicket.usedQuotaPaid +
    activeTicket.usedQuotaPending +
    getExtraUsedQuota(activeTicket.id, bookingDate);
  const remainingQuota = Math.max(0, activeTicket.dailyQuota - usedQuota);

  const subtotal = activeTicket.price * quantity;
  const platformFee = PLATFORM_FEE_PER_TICKET * quantity;
  const totalAmount = subtotal + platformFee;

  const handleCheckout = () => {
    setErrorMsg('');
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/destinasi/${venue.id}?tanggal=${bookingDate}`)}`);
      return;
    }
    if (quantity < 1 || quantity > remainingQuota) {
      setErrorMsg('Kuota tiket untuk tanggal yang dipilih tidak mencukupi.');
      return;
    }
    const tx = createCheckout({
      venue,
      ticket: activeTicket,
      bookingDate,
      quantity,
    });
    navigate(`/checkout/${tx.id}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          <span>Kembali ke Katalog</span>
        </Link>
        <div className="w-full sm:w-auto">
          <BookingStepper currentStep={1} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Venue Details */}
        <div className="lg:col-span-7 space-y-6">
          <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-gray-200 border border-gray-200">
            <img
              src={venue.gambarUrl}
              alt={venue.gambarAlt}
              width={960}
              height={540}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs font-bold text-gray-800">
                {venue.venueCode}
              </span>
              <span className="text-sm font-bold text-gray-900">
                ★ {venue.rating} ({venue.jumlahUlasan} ulasan)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{venue.nama}</h1>

            <div className="space-y-1.5 text-sm text-gray-600">
              <p className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-gray-800 shrink-0" aria-hidden="true">
                  location_on
                </span>
                <span>{venue.alamat}</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-gray-800 shrink-0" aria-hidden="true">
                  schedule
                </span>
                <span>Jam Operasional: {venue.jamBuka}</span>
              </p>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed pt-2 border-t border-gray-100">
              {venue.deskripsi}
            </p>

            <div className="pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Fasilitas Lokasi
              </h2>
              <div className="flex flex-wrap gap-2">
                {venue.fasilitas.map((f) => (
                  <span
                    key={f}
                    className="px-3 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Single-Venue Booking Console */}
        <aside className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 space-y-5 lg:sticky lg:top-24">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Pesan Tiket Masuk</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              1 invoice berlaku untuk 1 destinasi dan 1 tanggal kunjungan.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="booking-date" className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Tanggal Kunjungan
            </label>
            <input
              id="booking-date"
              type="date"
              value={bookingDate}
              min={getTodayISO()}
              onChange={(e) => {
                setBookingDate(e.target.value);
                setQuantity(1);
              }}
              className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-300 text-sm text-gray-900"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Pilih Jenis Tiket
            </span>
            <div className="space-y-2">
              {venue.tickets.map((t) => {
                const used = t.usedQuotaPaid + t.usedQuotaPending + getExtraUsedQuota(t.id, bookingDate);
                const sisa = Math.max(0, t.dailyQuota - used);
                const selected = t.id === activeTicket.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTicketId(t.id);
                      setQuantity(1);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                      selected
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{t.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{t.description}</p>
                      </div>
                      <span className="text-sm font-extrabold text-gray-900 shrink-0">
                        {formatRupiah(t.price)}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-gray-500 mt-2">
                      Sisa kuota: {sisa} dari {t.dailyQuota} tiket
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <span className="block text-sm font-bold text-gray-900">Jumlah Tiket</span>
              <span className="text-xs text-gray-500">Maksimal {remainingQuota} tersedia</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Kurangi jumlah tiket"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-11 h-11 rounded-xl border border-gray-300 font-bold text-lg text-gray-900 disabled:opacity-40"
              >
                -
              </button>
              <span className="w-6 text-center text-sm font-extrabold">{quantity}</span>
              <button
                type="button"
                aria-label="Tambah jumlah tiket"
                onClick={() => setQuantity((q) => Math.min(remainingQuota, q + 1))}
                disabled={quantity >= remainingQuota}
                className="w-11 h-11 rounded-xl border border-gray-300 font-bold text-lg text-gray-900 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>
                {activeTicket.title} ({quantity}x)
              </span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Biaya Layanan Platform</span>
              <span>{formatRupiah(platformFee)}</span>
            </div>
            <div className="flex justify-between font-extrabold text-gray-900 pt-2 border-t border-gray-200 text-base">
              <span>Total Bayar QRIS</span>
              <span>{formatRupiah(totalAmount)}</span>
            </div>
          </div>

          {errorMsg && (
            <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
              {errorMsg}
            </div>
          )}

          {!isAuthenticated && (
            <p className="text-xs text-gray-600 bg-gray-100 p-3 rounded-xl border border-gray-200">
              Anda sedang menjelajah sebagai <strong>Guest</strong>. Untuk membeli tiket QRIS, Anda perlu
              login terlebih dahulu.
            </p>
          )}

          <button
            type="button"
            disabled={remainingQuota === 0}
            onClick={handleCheckout}
            className="w-full py-3.5 px-4 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors disabled:opacity-40"
          >
            {remainingQuota === 0
              ? 'Kuota Tanggal Ini Habis'
              : isAuthenticated
                ? 'Pesan & Bayar via QRIS'
                : 'Masuk untuk Pesan Tiket'}
          </button>

          {/* Ketentuan ringkas dalam Accordion */}
          <details className="border-t border-gray-100 pt-3 text-xs text-gray-600">
            <summary className="font-bold text-gray-800 cursor-pointer select-none py-1">
              Ketentuan Pembelian &amp; Kebijakan Tiket
            </summary>
            <ul className="mt-2 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>1 transaksi hanya berlaku untuk 1 destinasi dan 1 tanggal kunjungan.</li>
              <li>Batas waktu pembayaran QRIS adalah 15 menit sejak invoice dibuat.</li>
              <li>Tiket yang sudah lunas dan lewat tanggal kunjungan (No-Show) otomatis hangus.</li>
            </ul>
          </details>
        </aside>
      </div>
    </div>
  );
}
