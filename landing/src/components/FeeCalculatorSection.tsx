import { useState } from 'react';
import { formatRupiah } from '@pariwisloka/shared';

const FEE_RATE = 0.025;

export function FeeCalculatorSection() {
  const [ticketPrice, setTicketPrice] = useState(50000);
  const [ticketQty, setTicketQty] = useState(500);

  const isFreeEvent = ticketPrice === 0;
  const grossRevenue = ticketPrice * ticketQty;
  const platformFee = isFreeEvent ? 0 : Math.round(grossRevenue * FEE_RATE);
  const netPayout = grossRevenue - platformFee;

  return (
    <section id="harga-b2b" className="bg-gray-50 border-t border-gray-200 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left: Crisp Pricing Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              Gratis untuk acara bebas biaya, 2,5% untuk tiket berbayar.
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Tanpa biaya langganan bulanan. Potongan hanya berlaku saat tiket terjual.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white border border-gray-200 p-4">
              <span className="block text-xs text-gray-500">Tiket Rp 0</span>
              <span className="text-xl font-extrabold text-teal-800">Gratis</span>
            </div>
            <div className="rounded-xl bg-white border border-gray-900 p-4">
              <span className="block text-xs text-gray-500">Tiket Berbayar</span>
              <span className="text-xl font-extrabold text-gray-900">2,5%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="#daftar-mitra"
              className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
            >
              Ajukan Kemitraan
            </a>
            <a
              href="mailto:mitra@fastix.id?subject=Konsultasi%20Skema%20White-Label%20Fastix"
              className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-900 text-sm font-semibold transition-colors"
            >
              Hubungi Sales
            </a>
          </div>
        </div>

        {/* Right: Interactive Calculator */}
        <div className="lg:col-span-7 rounded-xl bg-white border border-gray-300 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label htmlFor="calc-price" className="block text-xs font-bold text-gray-700">
                Harga Tiket (Rp)
              </label>
              <input
                id="calc-price"
                type="number"
                min={0}
                max={10000000}
                step={5000}
                value={ticketPrice}
                onChange={(e) => setTicketPrice(Math.max(0, Number(e.target.value) || 0))}
                className="w-full h-11 px-3.5 rounded-lg bg-gray-50 border border-gray-300 text-sm font-bold text-gray-900"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[0, 25000, 50000, 150000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTicketPrice(preset)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                      ticketPrice === preset
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {preset === 0 ? 'Gratis' : formatRupiah(preset)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="calc-qty" className="block text-xs font-bold text-gray-700">
                Jumlah Tiket Terjual
              </label>
              <input
                id="calc-qty"
                type="number"
                min={1}
                max={100000}
                step={50}
                value={ticketQty}
                onChange={(e) => setTicketQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-full h-11 px-3.5 rounded-lg bg-gray-50 border border-gray-300 text-sm font-bold text-gray-900"
              />
              <input
                aria-label="Geser jumlah tiket terjual"
                type="range"
                min={50}
                max={5000}
                step={50}
                value={Math.min(5000, ticketQty)}
                onChange={(e) => setTicketQty(Number(e.target.value))}
                className="w-full accent-gray-900 cursor-pointer"
              />
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Penjualan Kotor</span>
              <span className="font-bold text-gray-900">{formatRupiah(grossRevenue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Biaya Platform ({isFreeEvent ? '0%' : '2,5%'})</span>
              <span className="font-bold text-gray-900">-{formatRupiah(platformFee)}</span>
            </div>
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">Dana Bersih Mitra</span>
              <span className="text-2xl font-extrabold text-teal-800">{formatRupiah(netPayout)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
