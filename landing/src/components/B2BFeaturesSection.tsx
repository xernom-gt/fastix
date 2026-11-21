const B2B_HIGHLIGHTS = [
  {
    icon: 'event_available',
    title: 'Kuota Harian Anti-Overbooking',
    desc: 'Atur kuota per tanggal dan kategori tiket dengan penguncian otomatis 15 menit saat transaksi.',
  },
  {
    icon: 'qr_code_2',
    title: 'Validasi Loket Tetap Jalan Offline',
    desc: 'Petugas pintu masuk tetap dapat memindai QR tiket meski koneksi internet di lokasi sedang lemah.',
  },
  {
    icon: 'account_balance_wallet',
    title: 'Verifikasi Usaha & Pencairan H+1',
    desc: 'Legalitas mitra terverifikasi dan dana penjualan cair terjadwal H+1 pukul 23:59 WIB.',
  },
];

export function B2BFeaturesSection() {
  return (
    <section id="fitur-b2b" className="bg-white border-t border-gray-200 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              Kendali Operasional dari Loket ke Pencairan
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Dirancang untuk pengelola destinasi wisata, taman rekreasi, dan acara daerah.
            </p>
          </div>

          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {B2B_HIGHLIGHTS.map((item) => (
              <div key={item.title} className="py-5 flex items-start gap-4">
                <span className="material-symbols-outlined text-[22px] text-teal-800 pt-0.5 shrink-0" aria-hidden="true">
                  {item.icon}
                </span>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-xl bg-gray-900 text-white p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-white">Loket Masuk Fastix</span>
              <span className="px-2.5 py-1 rounded-md bg-teal-500/20 text-teal-200 text-xs font-semibold whitespace-nowrap">
                Tiket Tervalidasi
              </span>
            </div>

            <div className="rounded-lg bg-white/10 border border-white/15 p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-300">Kode Tiket</span>
                <span className="font-mono text-white font-bold">FX-8821-A9</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-300">Destinasi</span>
                <span className="text-white font-semibold text-right">Tirta Gangga Water Palace</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-300">Mode Loket</span>
                <span className="text-teal-300 font-semibold">Siap Tanpa Sinyal</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="block text-xs font-semibold text-gray-500">Rekening Penampungan</span>
              <span className="text-base font-extrabold text-gray-900">Pencairan Dana H+1 · 23:59 WIB</span>
            </div>
            <span className="px-3 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold whitespace-nowrap shrink-0">
              Tercairkan
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
