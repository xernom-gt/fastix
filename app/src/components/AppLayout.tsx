import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:5173';

export const AppLayout: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
      isActive ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
    }`;

  const bottomNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold whitespace-nowrap transition-colors ${
      isActive ? 'text-[#111827]' : 'text-gray-500'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111827]">
      {/* Top Utility Bar (Desktop) */}
      <div className="hidden md:block bg-[#090D16] text-gray-300 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-center gap-6 text-[11px] font-medium">
          <a href={LANDING_URL} className="hover:text-white transition-colors">
            Tentang Fastix
          </a>
          <a href={`${LANDING_URL}#keunggulan`} className="hover:text-white transition-colors">
            Transparansi Biaya
          </a>
          <Link to="/tiket" className="hover:text-white transition-colors">
            E-Ticket QRIS
          </Link>
          <a href={`${LANDING_URL}#faq`} className="hover:text-white transition-colors">
            FAQ
          </a>
        </div>
      </div>

      {/* Main Fastix Monochrome Header */}
      <header className="sticky top-0 z-40 bg-[#111827] text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between md:grid md:grid-cols-3 gap-4">
          <Link to="/explore" className="flex items-center gap-2.5 shrink-0 md:justify-self-start">
            <span className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                confirmation_number
              </span>
            </span>
            <span className="font-extrabold text-xl tracking-tight text-white">Fastix</span>
          </Link>

          <nav
            aria-label="Menu aplikasi utama"
            className="hidden md:flex items-center justify-self-center gap-1 bg-white/10 border border-white/10 rounded-full p-1 whitespace-nowrap"
          >
            <NavLink to="/explore" end className={navClass}>
              Beranda
            </NavLink>
            <NavLink to="/jelajah" className={navClass}>
              Jelajah
            </NavLink>
            <NavLink to="/tiket" className={navClass}>
              Tiket Saya
            </NavLink>
            <a
              href={LANDING_URL}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Jadi Mitra
            </a>
          </nav>

          <div className="flex items-center justify-end gap-2 md:justify-self-end">
            <button
              type="button"
              aria-label="Cari destinasi"
              onClick={() => navigate('/jelajah')}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                search
              </span>
            </button>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/akun"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl border border-white/15 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    person
                  </span>
                  <span className="hidden sm:inline">{user.fullName}</span>
                  <span className="sm:hidden">Akun</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/explore');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white transition-colors"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-colors"
              >
                Masuk
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-12">
        <Outlet />
      </main>

      {/* Fastix Dark Monochrome Footer */}
      <footer className="hidden md:block bg-[#111827] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  confirmation_number
                </span>
                <span className="font-extrabold text-xl tracking-tight">Fastix</span>
              </div>
              <p className="text-xs text-gray-300">
                Your Smart Tourism Ticketing Partner
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Tentang Kami</h3>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>
                  <a href={LANDING_URL} className="hover:text-white transition-colors">
                    Tentang Fastix
                  </a>
                </li>
                <li>
                  <a href={`${LANDING_URL}#keunggulan`} className="hover:text-white transition-colors">
                    Cara Kerja Escrow
                  </a>
                </li>
                <li>
                  <a href={`${LANDING_URL}#mitra`} className="hover:text-white transition-colors">
                    Daftar Mitra Wisata
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Informasi</h3>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>
                  <a href={`${LANDING_URL}#faq`} className="hover:text-white transition-colors">
                    Syarat &amp; Ketentuan
                  </a>
                </li>
                <li>
                  <a href={`${LANDING_URL}#faq`} className="hover:text-white transition-colors">
                    FAQ Pemesanan
                  </a>
                </li>
                <li>
                  <Link to="/tiket" className="hover:text-white transition-colors">
                    Cek E-Ticket QRIS
                  </Link>
                </li>
                <li>
                  <Link to="/gate/login" className="hover:text-white transition-colors">
                    Portal Staff Gate
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Kategori Wisata</h3>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>
                  <Link to="/explore?kategori=candi_sejarah" className="hover:text-white transition-colors">
                    Candi &amp; Sejarah
                  </Link>
                </li>
                <li>
                  <Link to="/explore?kategori=pantai_bahari" className="hover:text-white transition-colors">
                    Pantai &amp; Bahari
                  </Link>
                </li>
                <li>
                  <Link to="/explore?kategori=alam_geopark" className="hover:text-white transition-colors">
                    Alam &amp; Geopark
                  </Link>
                </li>
                <li>
                  <Link to="/explore" className="hover:text-white transition-colors">
                    Semua Destinasi
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-white/15 flex items-center justify-between text-xs text-gray-300">
            <span>© 2026 Fastix. Hak Cipta Dilindungi.</span>
            <span>E-Ticketing Wisata Berbasis Lokasi &amp; QRIS</span>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 grid grid-cols-4 h-16"
      >
        <NavLink to="/explore" end className={bottomNavClass}>
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            home
          </span>
          <span>Beranda</span>
        </NavLink>
        <NavLink to="/jelajah" className={bottomNavClass}>
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            explore
          </span>
          <span>Jelajah</span>
        </NavLink>
        <NavLink to="/tiket" className={bottomNavClass}>
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            qr_code_2
          </span>
          <span>Tiket Saya</span>
        </NavLink>
        <NavLink
          to={isAuthenticated ? '/akun' : '/login?redirect=/akun'}
          className={bottomNavClass}
        >
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            person
          </span>
          <span>Akun</span>
        </NavLink>
      </nav>
    </div>
  );
};
