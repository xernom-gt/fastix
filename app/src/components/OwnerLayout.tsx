import React from 'react';
import { Link, Navigate, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/authStore';

type OwnerTab = 'overview' | 'tickets' | 'staff';

const OWNER_NAV_ITEMS: Array<{ tab: OwnerTab; label: string; mobileLabel: string; icon: string }> = [
  { tab: 'tickets', label: 'Tiket & Kuota', mobileLabel: 'Tiket', icon: 'confirmation_number' },
  { tab: 'staff', label: 'Staff Gate & PIN', mobileLabel: 'Staff', icon: 'badge' },
  { tab: 'overview', label: 'Ringkasan Kuota', mobileLabel: 'Ringkasan', icon: 'analytics' },
];

export const OwnerLayout: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!isAuthenticated || user?.role !== 'OWNER') {
    return <Navigate to="/login?redirect=/mitra" replace />;
  }

  const rawTab = searchParams.get('tab');
  const activeTab: OwnerTab =
    rawTab === 'overview' || rawTab === 'staff' ? rawTab : 'tickets';

  const selectTab = (tab: OwnerTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate('/explore', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 text-[#111827]">
      {/* Desktop Owner Sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 bg-[#111827] text-white flex-col justify-between sticky top-0 h-screen p-5">
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <span className="w-9 h-9 rounded-xl bg-white/15 border border-white/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                storefront
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-tight truncate">Fastix Mitra</p>
              <p className="text-[11px] text-gray-300 truncate">{user.fullName}</p>
            </div>
          </div>

          <nav aria-label="Navigasi Owner Wisata" className="space-y-1.5">
            {OWNER_NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => selectTab(item.tab)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-white text-[#111827]'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 pt-4 border-t border-white/10">
          <Link
            to="/gate/login"
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              qr_code_scanner
            </span>
            <span>Portal Staff Gate</span>
          </Link>

          <Link
            to="/explore"
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              arrow_back
            </span>
            <span>Mode Wisatawan</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              logout
            </span>
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Owner Top Header */}
      <header className="md:hidden sticky top-0 z-40 bg-[#111827] text-white px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              storefront
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold leading-tight truncate">Fastix Mitra</p>
            <p className="text-[10px] text-gray-300 truncate">{user.fullName}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            to="/explore"
            aria-label="Kembali ke Mode Wisatawan"
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white"
          >
            Wisatawan
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold text-white"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Main Owner Workspace */}
      <main className="flex-1 min-w-0 pb-24 md:pb-10">
        <Outlet />
      </main>

      {/* Mobile Owner Bottom Nav */}
      <nav
        aria-label="Navigasi Owner Mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 grid grid-cols-4 h-16"
      >
        {OWNER_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => selectTab(item.tab)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold whitespace-nowrap transition-colors ${
                isActive ? 'text-[#111827]' : 'text-gray-500'
              }`}
            >
              <span className="material-symbols-outlined text-[21px]" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.mobileLabel}</span>
            </button>
          );
        })}
        <Link
          to="/gate/login"
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold whitespace-nowrap text-gray-500 hover:text-[#111827]"
        >
          <span className="material-symbols-outlined text-[21px]" aria-hidden="true">
            qr_code_scanner
          </span>
          <span>Portal Gate</span>
        </Link>
      </nav>
    </div>
  );
};
