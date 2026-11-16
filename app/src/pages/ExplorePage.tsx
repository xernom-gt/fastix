import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  formatRupiah,
  getTodayISO,
  hitungJarakHaversine,
  KATEGORI_LABELS,
  MOCK_VENUES,
  searchVenuesSmart,
  WILAYAH_INDONESIA,
  type Destinasi,
  type KategoriWisata,
} from '@pariwisloka/shared';
import { VenueCard, type VenueEntry } from '../components/VenueCard';
import { useBookings } from '../store/bookingStore';

const KATEGORI_ICONS: Record<KategoriWisata | 'all', string> = {
  all: 'apps',
  candi_sejarah: 'temple_buddhist',
  pantai_bahari: 'beach_access',
  alam_geopark: 'landscape',
  desa_wisata: 'holiday_village',
  museum_edukasi: 'museum',
  theme_waterpark: 'attractions',
};

const WILAYAH_ICONS: Record<string, string> = {
  bali: 'temple_hindu',
  jogja: 'account_balance',
  bandung: 'terrain',
  jakarta: 'location_city',
  malang: 'park',
};

const WILAYAH_SHORT: Record<string, string> = {
  bali: 'BALI',
  jogja: 'DIY-JATENG',
  bandung: 'JAWA BARAT',
  jakarta: 'JABODETABEK',
  malang: 'JAWA TIMUR',
};

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getExtraUsedQuota } = useBookings();

  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '');
  const [kota, setKota] = useState(searchParams.get('kota') ?? 'all');
  const [kategori, setKategori] = useState<KategoriWisata | 'all'>(
    (searchParams.get('kategori') as KategoriWisata) ?? 'all',
  );
  const [tanggal, setTanggal] = useState(searchParams.get('tanggal') ?? getTodayISO());
  const [sortBy, setSortBy] = useState<'popularitas' | 'terdekat' | 'harga_asc'>('popularitas');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams();
    if (keyword.trim()) next.set('q', keyword.trim());
    if (kota !== 'all') next.set('kota', kota);
    if (kategori !== 'all') next.set('kategori', kategori);
    if (tanggal) next.set('tanggal', tanggal);
    setSearchParams(next, { replace: true });
  }, [keyword, kota, kategori, tanggal, setSearchParams]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortBy('terdekat');
        setGeoStatus('ok');
      },
      () => {
        setGeoStatus('error');
      },
      { timeout: 8000 },
    );
  };

  const publishedVenues = useMemo(() => MOCK_VENUES.filter((v) => v.isPublished), []);

  const computeRemaining = (v: Destinasi) => {
    const totalQuota = v.tickets.reduce((acc, t) => acc + t.dailyQuota, 0);
    const totalUsed = v.tickets.reduce(
      (acc, t) => acc + t.usedQuotaPaid + t.usedQuotaPending + getExtraUsedQuota(t.id, tanggal),
      0,
    );
    return Math.max(0, totalQuota - totalUsed);
  };

  const recommended = useMemo<VenueEntry[]>(() => {
    return [...publishedVenues]
      .sort((a, b) => b.jumlahUlasan - a.jumlahUlasan)
      .slice(0, 4)
      .map((v) => ({
        venue: v,
        distanceMeters: userCoords
          ? hitungJarakHaversine(userCoords.lat, userCoords.lng, v.koordinat.lat, v.koordinat.lng)
          : null,
        remainingQuota: computeRemaining(v),
      }));
  }, [publishedVenues, tanggal, userCoords, getExtraUsedQuota]);

  const larisManis = useMemo(() => {
    const sorted = [...publishedVenues].sort((a, b) => b.rating - a.rating);
    return {
      left: sorted[1] ?? sorted[0],
      center: sorted[0],
      right: sorted[2] ?? sorted[0],
    };
  }, [publishedVenues]);

  const { results, usedFuzzy, suggestedTerm } = useMemo(() => {
    const base = publishedVenues.filter((v) => {
      if (kota !== 'all' && v.kotaKode !== kota) return false;
      if (kategori !== 'all' && v.kategori !== kategori) return false;
      return true;
    });

    const smart = searchVenuesSmart(base, keyword);
    const list: VenueEntry[] = smart.items.map((v) => ({
      venue: v,
      distanceMeters: userCoords
        ? hitungJarakHaversine(userCoords.lat, userCoords.lng, v.koordinat.lat, v.koordinat.lng)
        : null,
      remainingQuota: computeRemaining(v),
    }));

    if (sortBy === 'harga_asc') {
      list.sort((a, b) => a.venue.hargaMulai - b.venue.hargaMulai);
    } else if (sortBy === 'terdekat' && userCoords) {
      list.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    } else if (!smart.usedFuzzy) {
      list.sort((a, b) => b.venue.jumlahUlasan - a.venue.jumlahUlasan);
    }

    return {
      results: list,
      usedFuzzy: smart.usedFuzzy,
      suggestedTerm: smart.suggestedTerm,
    };
  }, [publishedVenues, keyword, kota, kategori, tanggal, sortBy, userCoords, getExtraUsedQuota]);

  const featuredSlides = useMemo(() => publishedVenues.slice(0, 4), [publishedVenues]);
  const activeSlide = featuredSlides[bannerIndex % featuredSlides.length];
  const prevSlide = featuredSlides[(bannerIndex - 1 + featuredSlides.length) % featuredSlides.length];
  const prev2Slide = featuredSlides[(bannerIndex - 2 + featuredSlides.length) % featuredSlides.length];
  const nextSlide = featuredSlides[(bannerIndex + 1) % featuredSlides.length];
  const next2Slide = featuredSlides[(bannerIndex + 2) % featuredSlides.length];

  const hasActiveFilter = Boolean(keyword.trim()) || kota !== 'all' || kategori !== 'all';
  const visibleResults = showAll || hasActiveFilter ? results : results.slice(0, 8);

  const resetFilters = () => {
    setKeyword('');
    setKota('all');
    setKategori('all');
    setSortBy('popularitas');
  };

  const selectRegion = (kode: string) => {
    setKota(kode);
    document.getElementById('katalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-12 pt-6 sm:pt-8 pb-6">
      {/* 1. Centered Hero Showcase Banner (2-Layer Stacked Peek Deck, Fastix Monochrome Theme) */}
      {activeSlide && (
        <section aria-label="Destinasi unggulan" className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative flex items-center justify-center">
            {/* Left Outer Peek Card (Layer 2) */}
            {prev2Slide && (
              <div className="hidden lg:block w-14 h-[264px] rounded-l-xl overflow-hidden opacity-45 shrink-0 -mr-3 bg-[#111827] z-0">
                <div
                  className="fx-glide-track flex w-full h-full"
                  style={{
                    transform: `translate3d(-${((bannerIndex - 2 + featuredSlides.length) % featuredSlides.length) * 100}%, 0, 0)`,
                  }}
                >
                  {featuredSlides.map((s) => (
                    <img
                      key={`p2-${s.id}`}
                      src={s.gambarUrl}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover shrink-0"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Left Inner Peek Card (Layer 1) */}
            {prevSlide && (
              <div className="hidden md:block w-14 h-64 sm:h-[312px] rounded-l-2xl overflow-hidden opacity-80 shrink-0 -mr-3 bg-[#111827] z-10 shadow-md">
                <div
                  className="fx-glide-track flex w-full h-full"
                  style={{
                    transform: `translate3d(-${((bannerIndex - 1 + featuredSlides.length) % featuredSlides.length) * 100}%, 0, 0)`,
                  }}
                >
                  {featuredSlides.map((s) => (
                    <img
                      key={`p1-${s.id}`}
                      src={s.gambarUrl}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover shrink-0"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Main Featured Banner Wrapper (allows arrows to straddle outer edges without covering text) */}
            <div className="relative w-full max-w-5xl z-20">
              <div className="relative w-full h-64 sm:h-[360px] rounded-2xl overflow-hidden bg-[#111827] shadow-[0_14px_36px_rgba(17,24,39,0.22)]">
                <div
                  className="fx-glide-track flex w-full h-full"
                  style={{
                    transform: `translate3d(-${(bannerIndex % featuredSlides.length) * 100}%, 0, 0)`,
                  }}
                >
                  {featuredSlides.map((slide, idx) => (
                    <div key={slide.id} className="relative w-full h-full shrink-0">
                      <img
                        src={slide.gambarUrl}
                        alt={slide.gambarAlt}
                        width={960}
                        height={360}
                        fetchPriority={idx === 0 ? 'high' : 'auto'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#090D16]/95 via-[#111827]/75 to-transparent" />

                      <div className="absolute inset-0 px-5 py-5 sm:px-12 sm:py-8 flex flex-col justify-between max-w-xl text-white">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
                          <span className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20">
                            Fastix Pilihan
                          </span>
                          <span>{slide.lokasi}</span>
                        </div>

                        <div className="space-y-2">
                          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                            {slide.nama}
                          </h1>
                          <p className="text-xs sm:text-sm text-gray-200/90 line-clamp-2">
                            {slide.deskripsi}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <Link
                            to={`/destinasi/${slide.id}?tanggal=${encodeURIComponent(tanggal)}`}
                            className="px-5 py-2.5 rounded-full bg-white text-[#111827] hover:bg-gray-100 text-xs font-extrabold transition-colors"
                          >
                            Pesan Tiket • {formatRupiah(slide.hargaMulai)}
                          </Link>
                          <button
                            type="button"
                            onClick={() => document.getElementById('katalog')?.scrollIntoView({ behavior: 'smooth' })}
                            className="px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition-colors"
                          >
                            Cari Destinasi Lain
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prev / Next Controls straddling outer card border on >= sm */}
              <button
                type="button"
                aria-label="Slide sebelumnya"
                onClick={() => setBannerIndex((i) => (i - 1 + featuredSlides.length) % featuredSlides.length)}
                className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white hover:bg-gray-100 active:scale-95 text-[#111827] items-center justify-center shadow-md border border-gray-200 z-30 transition-all duration-200"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  chevron_left
                </span>
              </button>
              <button
                type="button"
                aria-label="Slide berikutnya"
                onClick={() => setBannerIndex((i) => (i + 1) % featuredSlides.length)}
                className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white hover:bg-gray-100 active:scale-95 text-[#111827] items-center justify-center shadow-md border border-gray-200 z-30 transition-all duration-200"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>

            {/* Right Inner Peek Card (Layer 1) */}
            {nextSlide && (
              <div className="hidden md:block w-14 h-64 sm:h-[312px] rounded-r-2xl overflow-hidden opacity-80 shrink-0 -ml-3 bg-[#111827] z-10 shadow-md">
                <div
                  className="fx-glide-track flex w-full h-full"
                  style={{
                    transform: `translate3d(-${((bannerIndex + 1) % featuredSlides.length) * 100}%, 0, 0)`,
                  }}
                >
                  {featuredSlides.map((s) => (
                    <img
                      key={`n1-${s.id}`}
                      src={s.gambarUrl}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover shrink-0"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Right Outer Peek Card (Layer 2) */}
            {next2Slide && (
              <div className="hidden lg:block w-14 h-[264px] rounded-r-xl overflow-hidden opacity-45 shrink-0 -ml-3 bg-[#111827] z-0">
                <div
                  className="fx-glide-track flex w-full h-full"
                  style={{
                    transform: `translate3d(-${((bannerIndex + 2) % featuredSlides.length) * 100}%, 0, 0)`,
                  }}
                >
                  {featuredSlides.map((s) => (
                    <img
                      key={`n2-${s.id}`}
                      src={s.gambarUrl}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover shrink-0"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dot Indicators & Mobile Prev/Next Controls */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              aria-label="Slide sebelumnya"
              onClick={() => setBannerIndex((i) => (i - 1 + featuredSlides.length) % featuredSlides.length)}
              className="sm:hidden w-8 h-8 rounded-full bg-white hover:bg-gray-100 active:scale-95 text-[#111827] flex items-center justify-center shadow-sm border border-gray-200 transition-all duration-200"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                chevron_left
              </span>
            </button>

            <div className="flex items-center justify-center gap-1.5">
              {featuredSlides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Pilih slide ${idx + 1}`}
                  onClick={() => setBannerIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === bannerIndex % featuredSlides.length
                      ? 'w-6 bg-[#111827]'
                      : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              aria-label="Slide berikutnya"
              onClick={() => setBannerIndex((i) => (i + 1) % featuredSlides.length)}
              className="sm:hidden w-8 h-8 rounded-full bg-white hover:bg-gray-100 active:scale-95 text-[#111827] flex items-center justify-center shadow-sm border border-gray-200 transition-all duration-200"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                chevron_right
              </span>
            </button>
          </div>
        </section>
      )}

      {/* 2. Rekomendasi Destinasi (4-Column Grid) */}
      <section aria-labelledby="heading-rekomendasi" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
        <h2 id="heading-rekomendasi" className="text-lg sm:text-xl font-extrabold text-[#111827]">
          Rekomendasi Destinasi
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {recommended.map((entry) => (
            <VenueCard key={`rec-${entry.venue.id}`} entry={entry} tanggal={tanggal} eager />
          ))}
        </div>
      </section>

      {/* 3. Laris Manis (Centered 3-Panel Showcase) */}
      {larisManis.center && (
        <section aria-labelledby="heading-laris" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="text-center space-y-1">
            <h2 id="heading-laris" className="text-lg sm:text-xl font-extrabold text-[#111827]">
              Laris Manis
            </h2>
            <p className="text-xs font-medium text-gray-600">
              Kumpulan destinasi wisata favorit di Fastix yang mungkin kamu sukai
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
            {larisManis.left && (
              <Link
                to={`/destinasi/${larisManis.left.id}?tanggal=${encodeURIComponent(tanggal)}`}
                className="hidden lg:block relative h-64 rounded-2xl overflow-hidden group"
              >
                <img
                  src={larisManis.left.gambarUrl}
                  alt={larisManis.left.gambarAlt}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                <span className="absolute bottom-3 left-3 right-3 text-xs font-bold text-white truncate">
                  {larisManis.left.nama}
                </span>
              </Link>
            )}

            <Link
              to={`/destinasi/${larisManis.center.id}?tanggal=${encodeURIComponent(tanggal)}`}
              className="lg:col-span-2 relative h-64 rounded-2xl overflow-hidden group shadow-md"
            >
              <img
                src={larisManis.center.gambarUrl}
                alt={larisManis.center.gambarAlt}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#111827]/90 text-white text-[11px] font-bold">
                Fastix Populer • ★ {larisManis.center.rating}
              </div>
              <div className="absolute bottom-4 inset-x-4 flex flex-col items-center gap-2 text-center">
                <span className="px-4 py-1.5 rounded-full bg-white/95 text-[#111827] text-xs font-extrabold shadow">
                  {larisManis.center.nama}
                </span>
              </div>
            </Link>

            {larisManis.right && (
              <Link
                to={`/destinasi/${larisManis.right.id}?tanggal=${encodeURIComponent(tanggal)}`}
                className="hidden lg:block relative h-64 rounded-2xl overflow-hidden group"
              >
                <img
                  src={larisManis.right.gambarUrl}
                  alt={larisManis.right.gambarAlt}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                <span className="absolute bottom-3 left-3 right-3 text-xs font-bold text-white truncate">
                  {larisManis.right.nama}
                </span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* 4. Kategori Wisata (Circular Icon + Outlined Pill) */}
      <section aria-labelledby="heading-kategori" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
        <h2 id="heading-kategori" className="text-lg sm:text-xl font-extrabold text-[#111827]">
          Kategori Wisata
        </h2>
        <div className="flex items-start gap-5 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setKategori('all')}
            className="flex flex-col items-center gap-2.5 shrink-0 group"
          >
            <span
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                kategori === 'all'
                  ? 'bg-[#111827] text-white'
                  : 'bg-gray-100 text-[#111827] group-hover:bg-gray-200'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                {KATEGORI_ICONS.all}
              </span>
            </span>
            <span
              className={`px-3.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                kategori === 'all'
                  ? 'bg-[#111827] text-white border-[#111827]'
                  : 'bg-white text-gray-700 border-gray-300 group-hover:border-[#111827]'
              }`}
            >
              Semua
            </span>
          </button>

          {(Object.entries(KATEGORI_LABELS) as [KategoriWisata, string][]).map(([key, label]) => {
            const active = kategori === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setKategori(key)}
                className="flex flex-col items-center gap-2.5 shrink-0 group"
              >
                <span
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                    active
                      ? 'bg-[#111827] text-white'
                      : 'bg-gray-100 text-[#111827] group-hover:bg-gray-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                    {KATEGORI_ICONS[key]}
                  </span>
                </span>
                <span
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#111827] text-white border-[#111827]'
                      : 'bg-white text-gray-700 border-gray-300 group-hover:border-[#111827]'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Destinasi Terdekat / Katalog Utama + Filter Bar */}
      <section id="katalog" aria-labelledby="heading-katalog" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 id="heading-katalog" className="text-lg sm:text-xl font-extrabold text-[#111827]">
            {hasActiveFilter ? `Hasil Pencarian (${results.length})` : 'Destinasi Terdekat'}
          </h2>

          <button
            type="button"
            onClick={detectLocation}
            disabled={geoStatus === 'loading'}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-[#111827] text-xs font-bold transition-colors self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              my_location
            </span>
            <span>
              {geoStatus === 'loading'
                ? 'Mendeteksi...'
                : geoStatus === 'ok'
                  ? 'Lokasi Terdeteksi'
                  : 'Urutkan Terdekat'}
            </span>
          </button>
        </div>

        {geoStatus === 'error' && (
          <div role="alert" className="p-3 rounded-xl bg-[#FEF3C7] text-[#92400E] text-xs font-medium">
            Akses GPS tidak diizinkan. Anda tetap dapat memilih wilayah secara manual.
          </div>
        )}

        {/* Inline Search & Filter Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-3.5">
          <div className="lg:col-span-4">
            <label htmlFor="explore-q" className="sr-only">
              Cari Wisata
            </label>
            <input
              id="explore-q"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari nama wisata atau kota..."
              className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-[#111827] placeholder:text-gray-400"
            />
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="explore-city" className="sr-only">
              Wilayah
            </label>
            <select
              id="explore-city"
              value={kota}
              onChange={(e) => setKota(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-[#111827]"
            >
              <option value="all">Semua Wilayah</option>
              {WILAYAH_INDONESIA.map((w) => (
                <option key={w.kode} value={w.kode}>
                  {w.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="explore-date" className="sr-only">
              Tanggal Kunjungan
            </label>
            <input
              id="explore-date"
              type="date"
              value={tanggal}
              min={getTodayISO()}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-[#111827]"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="explore-sort" className="sr-only">
              Urutkan
            </label>
            <select
              id="explore-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-[#111827]"
            >
              <option value="popularitas">Populer</option>
              <option value="harga_asc">Termurah</option>
              <option value="terdekat" disabled={!userCoords}>
                Terdekat {userCoords ? '' : '(GPS)'}
              </option>
            </select>
          </div>
        </div>

        {usedFuzzy && suggestedTerm && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600">
            <span>
              Menampilkan hasil terdekat untuk <strong className="text-[#111827]">"{keyword.trim()}"</strong>.
            </span>
            <button
              type="button"
              onClick={() => setKeyword(suggestedTerm)}
              className="font-bold text-[#111827] underline underline-offset-4 hover:text-black"
            >
              Maksud Anda: {suggestedTerm}?
            </button>
          </div>
        )}

        {results.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center space-y-3">
            <span className="material-symbols-outlined text-[40px] text-gray-400" aria-hidden="true">
              search_off
            </span>
            <h3 className="text-base font-bold text-[#111827]">Destinasi tidak ditemukan</h3>
            <p className="text-xs text-gray-600 max-w-md mx-auto">
              Tidak ada tempat wisata yang cocok dengan kata kunci atau filter wilayah yang dipilih.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-5 py-2 rounded-full bg-[#111827] text-white text-xs font-bold"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {visibleResults.map((entry) => (
                <VenueCard key={entry.venue.id} entry={entry} tanggal={tanggal} />
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {!hasActiveFilter && results.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  className="px-6 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[#111827] text-xs font-bold transition-colors"
                >
                  {showAll ? 'Tampilkan Lebih Sedikit' : 'Lihat Lainnya'}
                </button>
              )}
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-6 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[#111827] text-xs font-bold transition-colors"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* 6. Temukan Wisata Menarik di Kotamu! */}
      <section aria-labelledby="heading-wilayah" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
        <h2 id="heading-wilayah" className="text-lg sm:text-xl font-extrabold text-[#111827]">
          Temukan Wisata Menarik di Kotamu!
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {WILAYAH_INDONESIA.map((w) => {
            const active = kota === w.kode;
            return (
              <button
                key={w.kode}
                type="button"
                onClick={() => selectRegion(w.kode)}
                className={`group rounded-2xl p-4 flex flex-col items-center justify-between gap-5 border transition-all hover:-translate-y-0.5 ${
                  active
                    ? 'bg-gray-100 border-[#111827] ring-1 ring-[#111827]'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-full h-24 rounded-xl bg-white flex items-center justify-center text-[#111827]">
                  <span className="material-symbols-outlined text-[48px]" aria-hidden="true">
                    {WILAYAH_ICONS[w.kode] ?? 'location_on'}
                  </span>
                </div>

                <div className="w-full flex items-center justify-between gap-1.5">
                  <span className="flex-1 px-3 py-1 rounded-full bg-[#111827] text-white text-[10px] font-extrabold tracking-wide uppercase truncate">
                    {WILAYAH_SHORT[w.kode] ?? w.provinsi}
                  </span>
                  <span className="w-6 h-6 rounded-full bg-[#111827] text-white flex items-center justify-center shrink-0 group-hover:bg-black transition-colors">
                    <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                      north_east
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
