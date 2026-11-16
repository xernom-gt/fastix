import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';

export default function AccountPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login?redirect=/akun" replace />;
  }

  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const handleLogout = () => {
    logout();
    navigate('/explore', { replace: true });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Akun Saya</h1>
        <p className="text-sm text-gray-500">Kelola profil wisatawan dan akses tiket Fastix Anda.</p>
      </div>

      {/* Profil Ringkas */}
      <section
        aria-label="Profil wisatawan"
        className="rounded-2xl border border-gray-200 bg-white p-6 flex items-center gap-4 shadow-sm"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#111827] text-white flex items-center justify-center font-extrabold text-lg shrink-0">
          {initials || (
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              person
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base sm:text-lg font-extrabold text-[#111827] truncate">
            {user.fullName}
          </h2>
          <p className="text-sm text-gray-600">{user.phoneNumber}</p>
          {user.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
        </div>
      </section>

      {/* Menu Pintasan */}
      <section
        aria-label="Menu akun"
        className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden"
      >
        <Link
          to="/tiket"
          className="flex items-center justify-between gap-4 p-4 sm:px-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-10 h-10 rounded-xl bg-gray-100 text-[#111827] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                qr_code_2
              </span>
            </span>
            <div>
              <p className="text-sm font-bold text-[#111827]">Tiket Saya</p>
              <p className="text-xs text-gray-500">Lihat e-ticket QRIS aktif dan detail kunjungan</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-[20px] text-gray-400" aria-hidden="true">
            chevron_right
          </span>
        </Link>

        <Link
          to="/jelajah"
          className="flex items-center justify-between gap-4 p-4 sm:px-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-10 h-10 rounded-xl bg-gray-100 text-[#111827] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                explore
              </span>
            </span>
            <div>
              <p className="text-sm font-bold text-[#111827]">Jelajah Destinasi</p>
              <p className="text-xs text-gray-500">Cari destinasi wisata dan pesan tiket baru</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-[20px] text-gray-400" aria-hidden="true">
            chevron_right
          </span>
        </Link>

        {user.role === 'OWNER' && (
          <Link
            to="/mitra"
            className="flex items-center justify-between gap-4 p-4 sm:px-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <span className="w-10 h-10 rounded-xl bg-gray-100 text-[#111827] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  storefront
                </span>
              </span>
              <div>
                <p className="text-sm font-bold text-[#111827]">Mode Owner Wisata</p>
                <p className="text-xs text-gray-500">Kelola tiket, kuota harian, &amp; PIN Staff Gate</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[20px] text-gray-400" aria-hidden="true">
              chevron_right
            </span>
          </Link>
        )}
      </section>

      {/* Tombol Keluar */}
      <div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#111827] hover:bg-black text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            logout
          </span>
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );
}
