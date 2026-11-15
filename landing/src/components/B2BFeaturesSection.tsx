import { StatusBadge } from '@pariwisloka/shared';

const B2B_HIGHLIGHTS = [
  {
    number: '01',
    title: 'Kuota Harian Anti-Overbooking',
    desc: 'Atur kuota per tanggal dan kategori tiket dengan penguncian otomatis 15 menit.',
  },
  {
    number: '02',
    title: 'Validasi Gate Offline (HMAC)',
    desc: 'Pindai QR PWL-TIX di pintu masuk tanpa bergantung pada sinyal internet.',
  },
  {
    number: '03',
    title: 'Verifikasi KYB & Escrow H+1',
    desc: 'Legalitas terverifikasi dan dana penjualan cair terjadwal H+1 pukul 23:59 WIB.',
  },
];

export function B2BFeaturesSection() {
  return (
    <section id="fitur-b2b" className="bg-white border-t border-gray-200 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left: 3 Concise B2B Highlights */}
        <div className="lg:col-span-6 space-y-8">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Pengelola &amp; Mitra</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              Kendali Operasional dari Loket ke Pencairan
            </h2>
          </div>

          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {B2B_HIGHLIGHTS.map((item) => (
              <div key={item.number} className="py-5 flex items-start gap-4">
                <span className="font-mono text-xs font-bold text-gray-400 pt-1 shrink-0">{item.number}</span>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Visual Product Snapshots (Gate + Escrow) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-2xl bg-gray-900 text-white p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Fastix Gate</span>
              <StatusBadge module="redemption" status="REDEEMED" size="sm" />
            </div>

            <div className="rounded-xl bg-white/10 border border-white/15 p-4 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-300">Tiket</span>
                <span className="text-white font-bold">PWL-TIX-8821A9C4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Kode Venue</span>
                <span className="text-white font-bold">LOKA-0142</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Validasi</span>
                <span className="text-teal-300 font-bold">HMAC Offline OK</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="block text-xs font-semibold text-gray-500">Rekening Penampungan</span>
              <span className="text-base font-extrabold text-gray-900">Settlement Escrow H+1</span>
            </div>
            <StatusBadge module="payout" status="SUCCESS" />
          </div>
        </div>
      </div>
    </section>
  );
}
