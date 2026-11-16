import { useState } from 'react';
import { formatRupiah, getTodayISO, MOCK_VENUES, WILAYAH_INDONESIA } from '@pariwisloka/shared';

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
      <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.12]">
              Tiket wisata instan, kendali kuota penuh.
            </h1>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-lg">
              Fastix menyatukan pembelian e-ticket QRIS untuk wisatawan dan pengaturan kuota harian bagi pengelola destinasi.
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

          <div className="lg:col-span-6">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="relative aspect-[16/9] bg-gray-200 overflow-hidden">
                <img
                  src={HERO_VENUE.gambarUrl}
                  alt={HERO_VENUE.gambarAlt}
                  width={640}
                  height={360}
                  fetchPriority="high"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-gray-900/80 text-white text-xs font-medium whitespace-nowrap">
                    {HERO_VENUE.lokasi}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white/95 text-teal-900 text-xs font-bold whitespace-nowrap">
                    Tersedia Hari Ini
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-snug">
                    {HERO_VENUE.nama}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                  <div className="pt-2">
                    <span className="block text-xs text-gray-500">Sisa Kuota Hari Ini</span>
                    <span className="text-base font-extrabold text-gray-900">
                      {HERO_QUOTA_LEFT} / {HERO_VENUE.tickets[0].dailyQuota} tiket
                    </span>
                  </div>
                  <div className="pt-2">
                    <span className="block text-xs text-gray-500">Harga Mulai</span>
                    <span className="text-base font-extrabold text-teal-800">
                      {formatRupiah(HERO_VENUE.hargaMulai)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-lg bg-white text-gray-900 p-1.5 shrink-0 flex items-center justify-center">
                    <svg
                      viewBox="0 0 80 80"
                      className="w-full h-full"
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
                  <div className="space-y-0.5">
                    <span className="block text-xs text-gray-300">Contoh E-Ticket QRIS</span>
                    <span className="block font-mono text-sm font-bold text-white">FX-8821-A9</span>
                  </div>
                </div>

                <a
                  href={`${appUrl}/destinasi/${HERO_VENUE.id}`}
                  className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white hover:bg-gray-100 text-gray-900 text-xs font-bold whitespace-nowrap transition-colors shrink-0"
                >
                  Lihat di Aplikasi
                </a>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5"
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
