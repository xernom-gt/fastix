import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
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

export default function JelajahPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getExtraUsedQuota } = useBookings();

  const [filterOpen, setFilterOpen] = useState(false);
  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '');
  const [kota, setKota] = useState(searchParams.get('kota') ?? 'all');
  const [kategori, setKategori] = useState<KategoriWisata | 'all'>(
    (searchParams.get('kategori') as KategoriWisata) ?? 'all',
  );
  const [tanggal, setTanggal] = useState(searchParams.get('tanggal') ?? getTodayISO());
  const [sortBy, setSortBy] = useState<'popularitas' | 'terdekat' | 'harga_asc'>('popularitas');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

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

  const computeRemaining = (v: Destinasi) => {
    const totalQuota = v.tickets.reduce((acc, t) => acc + t.dailyQuota, 0);
    const totalUsed = v.tickets.reduce(
      (acc, t) => acc + t.usedQuotaPaid + t.usedQuotaPending + getExtraUsedQuota(t.id, tanggal),
      0,
    );
    return Math.max(0, totalQuota - totalUsed);
  };

  const { results, usedFuzzy, suggestedTerm } = useMemo(() => {
    const base = MOCK_VENUES.filter((v) => {
      if (!v.isPublished) return false;
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
  }, [keyword, kota, kategori, tanggal, sortBy, userCoords, getExtraUsedQuota]);

  const activeFilterCount =
    (keyword.trim() ? 1 : 0) + (kota !== 'all' ? 1 : 0) + (kategori !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setKeyword('');
    setKota('all');
    setKategori('all');
    setSortBy('popularitas');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-6">
      {/* Top Toolbar: Filter (Left) & Urutkan (Right) */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setFilterOpen((o) => !o)}
          aria-expanded={filterOpen}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-colors ${
            filterOpen || activeFilterCount > 0
              ? 'bg-[#111827] text-white border-[#111827]'
              : 'bg-white text-[#111827] border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            filter_alt
          </span>
          <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
        </button>

        <div className="flex items-center gap-2">
          <label htmlFor="jelajah-sort" className="sr-only">
            Urutkan destinasi
          </label>
          <select
            id="jelajah-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-9 px-3.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-[#111827] hover:bg-gray-50 cursor-pointer"
          >
            <option value="popularitas">Urutkan: Populer</option>
            <option value="harga_asc">Urutkan: Termurah</option>
            <option value="terdekat" disabled={!userCoords}>
              Urutkan: Terdekat {userCoords ? '' : '(GPS)'}
            </option>
          </select>
        </div>
      </div>

      {/* Collapsible Filter Panel */}
      {filterOpen && (
        <div className="fx-fade-up bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label htmlFor="jelajah-q" className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Kata Kunci
              </label>
              <input
                id="jelajah-q"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Nama wisata atau kota..."
                className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-[#111827] placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="jelajah-city" className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Wilayah
              </label>
              <select
                id="jelajah-city"
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

            <div className="space-y-1">
              <label htmlFor="jelajah-kat" className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Kategori
              </label>
              <select
                id="jelajah-kat"
                value={kategori}
                onChange={(e) => setKategori(e.target.value as KategoriWisata | 'all')}
                className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-[#111827]"
              >
                <option value="all">Semua Kategori</option>
                {(Object.entries(KATEGORI_LABELS) as [KategoriWisata, string][]).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="jelajah-date" className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Tanggal Kunjungan
              </label>
              <input
                id="jelajah-date"
                type="date"
                value={tanggal}
                min={getTodayISO()}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-[#111827]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={detectLocation}
              disabled={geoStatus === 'loading'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-100 text-xs font-semibold text-[#111827]"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                my_location
              </span>
              <span>
                {geoStatus === 'loading'
                  ? 'Mendeteksi lokasi...'
                  : geoStatus === 'ok'
                    ? 'Lokasi Terdeteksi'
                    : 'Aktifkan GPS Terdekat'}
              </span>
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-bold text-[#111827] underline underline-offset-4 hover:text-black"
              >
                Reset Filter
              </button>
            )}
          </div>

          {geoStatus === 'error' && (
            <p role="alert" className="text-xs text-[#92400E] bg-[#FEF3C7] px-3 py-2 rounded-xl">
              Akses GPS tidak diizinkan. Anda tetap dapat memilih wilayah secara manual.
            </p>
          )}
        </div>
      )}

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

      {/* 4-Column Catalog Grid */}
      {results.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-[40px] text-gray-400" aria-hidden="true">
            search_off
          </span>
          <h2 className="text-base font-bold text-[#111827]">Destinasi tidak ditemukan</h2>
          <p className="text-xs text-gray-600 max-w-md mx-auto">
            Tidak ada destinasi wisata yang sesuai dengan filter yang dipilih.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-5 py-2 rounded-full bg-[#111827] text-white text-xs font-bold"
          >
            Tampilkan Semua
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {results.map((entry, idx) => (
            <VenueCard key={entry.venue.id} entry={entry} tanggal={tanggal} eager={idx < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
