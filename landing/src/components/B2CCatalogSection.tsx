import { formatRupiah, MOCK_VENUES } from '@pariwisloka/shared';

interface B2CCatalogSectionProps {
  appUrl: string;
}

const TOURIST_FLOW = [
  { icon: 'qr_code_scanner', label: 'Bayar QRIS (Kunci kuota 15 menit)' },
  { icon: 'verified', label: 'E-Ticket HMAC terbit otomatis' },
  { icon: 'door_open', label: 'Pindai di loket tanpa antre' },
];

export function B2CCatalogSection({ appUrl }: B2CCatalogSectionProps) {
  const featuredVenues = MOCK_VENUES.slice(0, 3);

  return (
    <section id="katalog-b2c" className="bg-gray-50 border-t border-gray-200 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Wisatawan</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              3 Destinasi Siap Kunjung
            </h2>
          </div>
          <a
            href={`${appUrl}/explore`}
            className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-900 text-sm font-bold transition-colors shrink-0"
          >
            Lihat Semua di App
          </a>
        </div>

        {/* 3 Best Destination Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredVenues.map((venue) => {
            const sisaKuota = venue.tickets.reduce(
              (acc, t) => acc + Math.max(0, t.dailyQuota - t.usedQuotaPaid - t.usedQuotaPending),
              0,
            );

            return (
              <article
                key={venue.id}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col hover:border-gray-400 transition-colors"
              >
                <div className="aspect-[16/10] bg-gray-200 overflow-hidden">
                  <img
                    src={venue.gambarUrl}
                    alt={venue.gambarAlt}
                    width={540}
                    height={338}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{venue.lokasi}</span>
                      <span className="font-semibold text-teal-800">{sisaKuota} kuota</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 leading-snug">{venue.nama}</h3>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-[11px] text-gray-500">Mulai dari</span>
                      <span className="text-base font-extrabold text-gray-900">
                        {formatRupiah(venue.hargaMulai)}
                      </span>
                    </div>
                    <a
                      href={`${appUrl}/destinasi/${venue.id}`}
                      className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors"
                    >
                      Beli Tiket
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Minimal 3-Point Flow */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-gray-200">
          {TOURIST_FLOW.map((step) => (
            <div key={step.label} className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
              <span className="material-symbols-outlined text-[20px] text-teal-800" aria-hidden="true">
                {step.icon}
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
