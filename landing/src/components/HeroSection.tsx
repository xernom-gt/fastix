import { useState } from 'react';
import { formatRupiah, getTodayISO, MOCK_VENUES, StatusBadge, WILAYAH_INDONESIA } from '@pariwisloka/shared';

interface HeroSectionProps {
  appUrl: string;
}

const HERO_VENUE = MOCK_VENUES[0];
const HERO_QUOTA_LEFT =
  HERO_VENUE.tickets[0].dailyQuota -
  HERO_VENUE.tickets[0].usedQuotaPaid -
  HERO_VENUE.tickets[0].usedQuotaPending;

export function HeroSection({ appUrl }: HeroSectionProps) {
  const [keyword, setKeyword] = useState('');
  const [kota, setKota] = useState('all');
  const [tanggal, setTanggal] = useState(getTodayISO());

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (kota !== 'all') params.set('kota', kota);
    if (tanggal) params.set('tanggal', tanggal);
    window.location.href = `${appUrl}/explore?${params.toString()}`;
  };

  return (
    <section className="bg-white pt-12 pb-16 sm:pt-20 sm:pb-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Concise Hero: Brand Value + 1 Sentence + Clear CTAs */}
          <div className="lg:col-span-6 space-y-6">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.12]">
              Tiket wisata instan, kendali kuota penuh.
            </h1>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-lg">
              Fastix menyatukan pembelian e-ticket QRIS untuk wisatawan dan manajemen kuota real-time bagi pengelola destinasi.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <a
                href={`${appUrl}/explore`}
                className="min-h-[44px] inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
              >
                Cari Destinasi
              </a>
              <a
                href="#daftar-mitra"
                className="min-h-[44px] inline-flex items-center justify-center px-6 py-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-sm font-semibold transition-colors"
              >
                Daftarkan Wisata
              </a>
            </div>
          </div>

          {/* Visual-First Mockup: B2B Quota Card + B2C E-Ticket */}
          <div className="lg:col-span-6">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
              <div className="sm:col-span-7 rounded-2xl border border-gray-200 bg-gray-50 p-4 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-600">{HERO_VENUE.venueCode}</span>
                  <StatusBadge module="kyb" status="APPROVED" size="sm" />
                </div>

                <div className="aspect-[16/10] rounded-xl overflow-hidden bg-gray-200">
                  <img
                    src={HERO_VENUE.gambarUrl}
                    alt={HERO_VENUE.gambarAlt}
                    width={640}
                    height={400}
                    fetchPriority="high"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-white border border-gray-200 p-3">
                    <span className="block text-[11px] text-gray-500">Sisa Kuota</span>
                    <span className="text-base font-extrabold text-gray-900">
                      {HERO_QUOTA_LEFT}/{HERO_VENUE.tickets[0].dailyQuota}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white border border-gray-200 p-3">
                    <span className="block text-[11px] text-gray-500">Mulai Dari</span>
                    <span className="text-base font-extrabold text-teal-800">
                      {formatRupiah(HERO_VENUE.hargaMulai)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-5 rounded-2xl bg-gray-900 text-white p-4 flex flex-col justify-between gap-4 shadow-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-300">E-Ticket</span>
                  <StatusBadge module="redemption" status="VALID" size="sm" />
                </div>

                <div className="bg-white text-gray-900 rounded-xl p-3.5 space-y-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-gray-500 truncate">{HERO_VENUE.lokasi}</p>
                    <p className="text-xs font-extrabold text-gray-900 truncate">{HERO_VENUE.nama}</p>
                  </div>

                  <div className="py-2 border-y border-dashed border-gray-200 flex items-center justify-center">
                    <svg
                      viewBox="0 0 80 80"
                      className="w-20 h-20 text-gray-900"
                      role="img"
                      aria-label="Pratinjau kode QR E-Ticket Fastix"
                    >
                      <rect x="4" y="4" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="4" />
                      <rect x="10" y="10" width="10" height="10" fill="currentColor" />
                      <rect x="54" y="4" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="4" />
                      <rect x="60" y="10" width="10" height="10" fill="currentColor" />
                      <rect x="4" y="54" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="4" />
                      <rect x="10" y="60" width="10" height="10" fill="currentColor" />
                      <rect x="34" y="8" width="6" height="6" fill="currentColor" />
                      <rect x="34" y="20" width="12" height="6" fill="currentColor" />
                      <rect x="10" y="34" width="14" height="6" fill="currentColor" />
                      <rect x="32" y="34" width="16" height="16" fill="currentColor" />
                      <rect x="56" y="34" width="18" height="6" fill="currentColor" />
                      <rect x="34" y="56" width="10" height="10" fill="currentColor" />
                      <rect x="52" y="54" width="12" height="18" fill="currentColor" />
                      <rect x="68" y="62" width="8" height="12" fill="currentColor" />
                    </svg>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-gray-700">PWL-TIX-8821A9</span>
                    <span className="font-bold text-gray-900">QRIS</span>
                  </div>
                </div>

                <a
                  href={`${appUrl}/destinasi/${HERO_VENUE.id}`}
                  className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-white hover:bg-gray-100 text-gray-900 text-xs font-bold transition-colors"
                >
                  Lihat di Aplikasi
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Clean Single-Row Search Bar */}
        <form
          onSubmit={handleSearch}
          className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-4 space-y-1.5">
              <label htmlFor="landing-q" className="block text-xs font-bold text-gray-700">
                Destinasi
              </label>
              <input
                id="landing-q"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tirta Gangga, Tanah Lot..."
                className="w-full h-11 px-3.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div className="lg:col-span-3 space-y-1.5">
              <label htmlFor="landing-city" className="block text-xs font-bold text-gray-700">
                Wilayah
              </label>
              <select
                id="landing-city"
                value={kota}
                onChange={(e) => setKota(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900"
              >
                <option value="all">Semua Wilayah</option>
                {WILAYAH_INDONESIA.map((w) => (
                  <option key={w.kode} value={w.kode}>
                    {w.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3 space-y-1.5">
              <label htmlFor="landing-date" className="block text-xs font-bold text-gray-700">
                Tanggal
              </label>
              <input
                id="landing-date"
                type="date"
                value={tanggal}
                min={getTodayISO()}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900"
              />
            </div>

            <div className="lg:col-span-2">
              <button
                type="submit"
                className="w-full min-h-[44px] px-4 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
              >
                Cari Tiket
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
