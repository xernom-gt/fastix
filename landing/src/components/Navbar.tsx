import { useState } from 'react';

interface NavbarProps {
  appUrl: string;
}

const NAV_LINKS = [
  { label: 'Destinasi', href: '#katalog-b2c' },
  { label: 'Untuk Mitra', href: '#fitur-b2b' },
  { label: 'Biaya', href: '#harga-b2b' },
];

export function Navbar({ appUrl }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              confirmation_number
            </span>
          </span>
          <span className="font-extrabold text-lg tracking-tight text-gray-900">Fastix</span>
        </a>

        <nav aria-label="Navigasi utama" className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-gray-900 transition-colors py-2"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a
            href={`${appUrl}/tiket`}
            className="px-3.5 py-2 min-h-[44px] inline-flex items-center rounded-lg text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cek Tiket
          </a>
          <a
            href="#daftar-mitra"
            className="px-4 py-2 min-h-[44px] inline-flex items-center rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
          >
            Daftar Mitra
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-900 min-h-[44px] hover:bg-gray-50"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            {menuOpen ? 'close' : 'menu'}
          </span>
          <span>Menu</span>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-5 py-4 space-y-1.5">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </a>
          ))}
          <div className="pt-3 mt-2 border-t border-gray-100 flex flex-col gap-2">
            <a
              href={`${appUrl}/tiket`}
              className="w-full min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Cek Tiket
            </a>
            <a
              href="#daftar-mitra"
              onClick={() => setMenuOpen(false)}
              className="w-full min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-black"
            >
              Daftar Mitra
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
