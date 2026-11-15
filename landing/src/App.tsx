import { useState } from 'react';
import { formatRupiah, getTodayISO, MOCK_VENUES, WILAYAH_INDONESIA } from '@pariwisloka/shared';

const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5174';
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:5175';

const FEATURED_HERO_VENUE = MOCK_VENUES[0];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [kota, setKota] = useState('all');
  const [tanggal, setTanggal] = useState(getTodayISO());

  // Lead Capture Form (Calon Mitra Pengelola Wisata)
  const [leadName, setLeadName] = useState('');
  const [leadVenue, setLeadVenue] = useState('');
  const [leadWhatsapp, setLeadWhatsapp] = useState('');
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (kota !== 'all') params.set('kota', kota);
    if (tanggal) params.set('tanggal', tanggal);
    window.location.href = `${APP_URL}/explore?${params.toString()}`;
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim() || !leadVenue.trim() || !leadWhatsapp.trim()) return;
    setLeadSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* 9. Navigasi Minimalis & Konsisten */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-2.5 shrink-0">
            <span className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                confirmation_number
              </span>
            </span>
            <span className="font-bold text-lg tracking-tight text-gray-900">Pariwisloka</span>
          </a>

          <nav aria-label="Navigasi landing" className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-600">
            <a href="#usp" className="hover:text-gray-900 transition-colors py-2">
              Keunggulan
            </a>
            <a href="#katalog" className="hover:text-gray-900 transition-colors py-2">
              Destinasi
            </a>
            <a href="#mitra-form" className="hover:text-gray-900 transition-colors py-2">
              Daftar Mitra
            </a>
            <a href="#faq" className="hover:text-gray-900 transition-colors py-2">
              FAQ
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href={`${APP_URL}/tiket`}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cek Tiket
            </a>
            <a
              href={`${APP_URL}/explore`}
              className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
            >
              Pesan Tiket
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {menuOpen ? 'close' : 'menu'}
            </span>
            <span>Menu</span>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-2">
            <a href="#usp" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
              Keunggulan
            </a>
            <a href="#katalog" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
              Destinasi
            </a>
            <a href="#mitra-form" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
              Daftar Mitra
            </a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
              FAQ
            </a>
            <div className="pt-2 flex flex-col gap-2">
              <a href={`${APP_URL}/tiket`} className="w-full text-center px-4 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-900">
                Cek Tiket
              </a>
              <a href={`${APP_URL}/explore`} className="w-full text-center px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold">
                Pesan Tiket
              </a>
            </div>
          </div>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* 1. Headline & Subheadline + 2. Hero Visual + 5. CTA + Search Above the Fold */}
        <section className="bg-white pt-10 pb-14 sm:pt-16 sm:pb-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-7 space-y-5">
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.12]">
                  Beli Tiket Wisata Lokal Tanpa Antre di Loket
                </h1>
                <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
                  Cek kuota harian secara langsung, bayar cepat lewat QRIS, dan masuk ke gerbang wisata
                  cukup dengan memindai E-Ticket QR dari ponsel Anda.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <a
                    href={`${APP_URL}/explore`}
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
                  >
                    Cari Destinasi Sekarang
                  </a>
                  <a
                    href="#mitra-form"
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-900 text-sm font-semibold transition-colors"
                  >
                    Daftarkan Tempat Wisata
                  </a>
                </div>
              </div>

              {/* Hero Visual (Real Venue Card Preview) */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
                  <div className="aspect-[16/10] bg-gray-200 overflow-hidden">
                    <img
                      src={FEATURED_HERO_VENUE.gambarUrl}
                      alt={FEATURED_HERO_VENUE.gambarAlt}
                      width={640}
                      height={400}
                      fetchPriority="high"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        {FEATURED_HERO_VENUE.venueCode} · {FEATURED_HERO_VENUE.lokasi}
                      </p>
                      <p className="text-sm font-extrabold text-gray-900 truncate">
                        {FEATURED_HERO_VENUE.nama}
                      </p>
                    </div>
                    <a
                      href={`${APP_URL}/destinasi/${FEATURED_HERO_VENUE.id}`}
                      className="shrink-0 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold"
                    >
                      {formatRupiah(FEATURED_HERO_VENUE.hargaMulai)}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar Above the Fold */}
            <form
              onSubmit={handleSearch}
              className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                <div className="lg:col-span-4 space-y-1.5">
                  <label htmlFor="landing-q" className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Nama Destinasi
                  </label>
                  <input
                    id="landing-q"
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Contoh: Tirta Gangga, Prambanan..."
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                <div className="lg:col-span-3 space-y-1.5">
                  <label htmlFor="landing-city" className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Kota / Wilayah
                  </label>
                  <select
                    id="landing-city"
                    value={kota}
                    onChange={(e) => setKota(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-gray-900"
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
                  <label htmlFor="landing-date" className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Tanggal Kunjungan
                  </label>
                  <input
                    id="landing-date"
                    type="date"
                    value={tanggal}
                    min={getTodayISO()}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-gray-900"
                  />
                </div>

                <div className="lg:col-span-2">
                  <button
                    type="submit"
                    className="w-full h-11 px-4 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
                  >
                    Cari Tiket
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* 3. Unique Selling Proposition (USP) & 4. Manfaat Utama */}
        <section id="usp" className="bg-gray-50 border-t border-gray-200 py-14 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                Kenapa Memesan Lewat Pariwisloka?
              </h2>
              <p className="text-sm text-gray-600 mt-1.5">
                Dirancang untuk kepastian kuota pengunjung dan kemudahan operasional di pintu masuk wisata.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: 'event_available',
                  title: 'Kuota Harian Anti-Overbooking',
                  points: [
                    'Sisa tiket per tanggal dihitung real-time.',
                    'Kuota otomatis dikunci 15 menit saat QRIS terbit.',
                  ],
                },
                {
                  icon: 'qr_code_2',
                  title: 'QRIS Instan & E-Ticket HMAC',
                  points: [
                    'Bayar lewat aplikasi bank atau e-wallet apa saja.',
                    'Kode QR PWL-TIX terenkripsi, aman dari duplikasi.',
                  ],
                },
                {
                  icon: 'wifi_off',
                  title: 'Validasi Gate Tetap Jalan Offline',
                  points: [
                    'Petugas loket tetap bisa scan tiket tanpa sinyal.',
                    'Sinkronisasi otomatis saat koneksi kembali normal.',
                  ],
                },
              ].map((item) => (
                <div key={item.title} className="p-6 rounded-2xl bg-white border border-gray-200 space-y-3">
                  <span className="w-11 h-11 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                      {item.icon}
                    </span>
                  </span>
                  <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
                  <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-4">
                    {item.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preview Katalog + Mid-page CTA */}
        <section id="katalog" className="bg-white border-t border-gray-200 py-14 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                  Destinasi Siap Kunjung
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Lihat harga tiket dan ketersediaan kuota sebelum masuk ke App Utama.
                </p>
              </div>
              <a
                href={`${APP_URL}/explore`}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
              >
                Lihat Semua di App
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {MOCK_VENUES.slice(0, 3).map((v) => (
                <article
                  key={v.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[16/10] bg-gray-200 overflow-hidden">
                    <img
                      src={v.gambarUrl}
                      alt={v.gambarAlt}
                      width={640}
                      height={400}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">
                        {v.lokasi} · {v.venueCode}
                      </p>
                      <h3 className="text-lg font-bold text-gray-900 mt-1">{v.nama}</h3>
                    </div>
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <span className="block text-[11px] text-gray-500">Mulai dari</span>
                        <span className="text-base font-extrabold text-gray-900">
                          {formatRupiah(v.hargaMulai)}
                        </span>
                      </div>
                      <a
                        href={`${APP_URL}/destinasi/${v.id}`}
                        className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors"
                      >
                        Pesan Tiket
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Kepercayaan & 7. Jaminan Keamanan Dana (Escrow & KYB) */}
        <section className="bg-gray-50 border-t border-gray-200 py-14">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-gray-200 space-y-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  verified_user
                </span>
                Jaminan Verifikasi Legalitas (KYB)
              </span>
              <h3 className="text-lg font-extrabold text-gray-900">
                Hanya Tempat Wisata Terverifikasi yang Tayang
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Setiap pengelola wisata wajib melewati pemeriksaan dokumen KTP, NPWP, NIB, dan rekening
                resmi oleh tim Pariwisloka HQ sebelum tiketnya dapat dijual ke publik.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-gray-200 space-y-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  account_balance
                </span>
                Jaminan Rekening Penampungan (Escrow H+1)
              </span>
              <h3 className="text-lg font-extrabold text-gray-900">
                Dana Pembayaran Ditahan Hingga Kunjungan Selesai
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Pembayaran QRIS tidak langsung dicairkan ke mitra, melainkan ditahan di rekening escrow
                hingga H+1 tanggal kunjungan pukul 23:59 WIB untuk melindungi hak pengunjung.
              </p>
            </div>
          </div>
        </section>

        {/* 8. Lead Capture Form (Calon Mitra Wisata) */}
        <section id="mitra-form" className="bg-white border-t border-gray-200 py-14 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Untuk Pengelola Tempat Wisata
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                Daftarkan Destinasi Wisata Anda
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Tinggalkan kontak singkat Anda. Tim kami akan menghubungi untuk proses onboarding
                verifikasi KYB dan aktivasi kode wisata `LOKA-XXXX`.
              </p>
            </div>

            <div className="lg:col-span-7 bg-gray-50 border border-gray-200 rounded-2xl p-6">
              {leadSubmitted ? (
                <div className="space-y-3 py-4">
                  <p className="text-base font-extrabold text-gray-900">
                    Data pengajuan minat mitra tercatat (simulasi).
                  </p>
                  <p className="text-sm text-gray-600">
                    Terima kasih <strong>{leadName}</strong>. Pengajuan untuk{' '}
                    <strong>{leadVenue}</strong> siap ditindaklanjuti ke nomor{' '}
                    <strong>{leadWhatsapp}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLeadSubmitted(false);
                      setLeadName('');
                      setLeadVenue('');
                      setLeadWhatsapp('');
                    }}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900"
                  >
                    Kirim Pengajuan Lain
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="lead-name" className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                      Nama Pengelola
                    </label>
                    <input
                      id="lead-name"
                      type="text"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      required
                      className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-gray-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="lead-wa" className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                      Nomor WhatsApp
                    </label>
                    <input
                      id="lead-wa"
                      type="tel"
                      value={leadWhatsapp}
                      onChange={(e) => setLeadWhatsapp(e.target.value)}
                      placeholder="081234567890"
                      required
                      className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-gray-900"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="lead-venue" className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                      Nama Tempat Wisata &amp; Kota
                    </label>
                    <input
                      id="lead-venue"
                      type="text"
                      value={leadVenue}
                      onChange={(e) => setLeadVenue(e.target.value)}
                      placeholder="Contoh: Curug Leuwi Hejo, Bogor"
                      required
                      className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 text-sm text-gray-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
                    >
                      Ajukan Kemitraan Wisata
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section id="faq" className="bg-gray-50 border-t border-gray-200 py-14">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Ketentuan &amp; Pertanyaan Umum
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Informasi detail mengenai pembayaran QRIS, batas kuota, dan kebijakan tiket masuk.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: 'Apakah saya harus login untuk melihat katalog wisata?',
                  a: 'Tidak. Pengunjung dapat menjelajahi katalog, melihat harga, dan mengecek sisa kuota harian tanpa login. Login hanya diperlukan saat memesan tiket QRIS atau melihat E-Ticket.',
                },
                {
                  q: 'Berapa lama batas waktu pembayaran QRIS?',
                  a: 'Kuota tiket dikunci selama 15 menit setelah invoice dibuat. Jika melewati batas waktu, transaksi otomatis kedaluwarsa dan kuota dilepas kembali.',
                },
                {
                  q: 'Bagaimana jika tiket sudah dibayar tapi pengunjung tidak datang?',
                  a: 'Tiket yang tidak dipindai hingga pukul 23:59 WIB pada tanggal kunjungan otomatis berstatus EXPIRED (No-Show) dan tidak dapat di-refund mandiri.',
                },
                {
                  q: 'Apakah E-Ticket tetap bisa dipindai jika sinyal di lokasi wisata lemah?',
                  a: 'Ya. Setiap QR tiket membawa tanda tangan HMAC sehingga petugas Pariwisloka Gate dapat memvalidasi keaslian tiket secara offline.',
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-gray-200 bg-white px-5 py-4"
                >
                  <summary className="flex items-center justify-between gap-4 font-bold text-sm text-gray-900 cursor-pointer list-none">
                    <span>{item.q}</span>
                    <span className="material-symbols-outlined text-[20px] text-gray-500 group-open:rotate-180 transition-transform" aria-hidden="true">
                      expand_more
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-gray-900 text-white py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Siap Merencanakan Kunjungan Wisata Anda?
            </h2>
            <p className="text-sm text-gray-300">
              Buka aplikasi utama Pariwisloka untuk melihat ketersediaan kuota hari ini.
            </p>
            <div className="pt-1">
              <a
                href={`${APP_URL}/explore`}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-gray-900 hover:bg-gray-100 text-sm font-bold transition-colors"
              >
                Buka Aplikasi Pariwisloka
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <span className="font-semibold text-gray-800">Pariwisloka · Platform E-Tiketing Wisata</span>
          <div className="flex items-center gap-4">
            <a href={`${APP_URL}/explore`} className="hover:text-gray-900">
              App Utama
            </a>
            <a href={ADMIN_URL} className="hover:text-gray-900">
              Admin HQ
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
