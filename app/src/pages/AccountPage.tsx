import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';

export default function AccountPage() {
  const { user, isAuthenticated, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [editError, setEditError] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  if (!isAuthenticated || !user) {
    return <Navigate to="/login?redirect=/akun" replace />;
  }

  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const handleStartEdit = () => {
    setNewName(user.fullName);
    setEditError('');
    setIsEditingName(true);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditError('');
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    const trimmed = newName.trim();
    if (!trimmed) {
      setEditError('Nama lengkap tidak boleh kosong.');
      return;
    }

    if (trimmed.length < 2) {
      setEditError('Nama lengkap minimal 2 karakter.');
      return;
    }

    setIsSavingName(true);
    try {
      await updateProfile({ fullName: trimmed });
      setIsEditingName(false);
      setToastMessage('Nama profil berhasil diperbarui.');
      window.setTimeout(() => setToastMessage(''), 3500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError('Gagal memperbarui nama profil.');
      }
    } finally {
      setIsSavingName(false);
    }
  };

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

      {/* Toast Notifikasi Berhasil */}
      {toastMessage && (
        <div
          role="status"
          className="fx-fade-up p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between gap-2 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600" aria-hidden="true">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-emerald-700 hover:text-emerald-900"
            aria-label="Tutup notifikasi"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      )}

      {/* Profil Ringkas */}
      <section
        aria-label="Profil wisatawan"
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[#111827] text-white flex items-center justify-center font-extrabold text-lg shrink-0">
              {initials || (
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                  person
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#111827] truncate">
                  {user.fullName}
                </h2>
                {user.role === 'OWNER' && (
                  <span className="px-2 py-0.5 rounded-full bg-[#111827] text-white text-[10px] font-extrabold shrink-0">
                    Owner
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{user.phoneNumber}</p>
              {user.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
            </div>
          </div>

          {!isEditingName && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-300 hover:border-[#111827] bg-white hover:bg-gray-50 text-xs font-bold text-[#111827] transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                edit
              </span>
              <span>Ubah Nama</span>
            </button>
          )}
        </div>

        {/* Inline Form Ubah Nama */}
        {isEditingName && (
          <form
            onSubmit={handleSaveName}
            className="pt-4 border-t border-gray-100 space-y-3 fx-fade-up"
          >
            <div className="space-y-1">
              <label htmlFor="edit-fullname" className="block text-xs font-semibold text-[#111827]">
                Nama Lengkap Baru
              </label>
              <input
                id="edit-fullname"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Masukkan nama lengkap baru"
                autoFocus
                required
                className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm font-semibold text-[#111827]"
              />
            </div>

            {editError && (
              <p role="alert" className="text-xs font-semibold text-[#991B1B] bg-[#FEE2E2] px-3 py-2 rounded-xl">
                {editError}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isSavingName}
                className="px-4 py-2 rounded-xl bg-[#111827] hover:bg-black disabled:opacity-60 text-white text-xs font-bold transition-colors shadow-sm"
              >
                {isSavingName ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        )}
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

        {user.role === 'OWNER' ? (
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
        ) : (
          <Link
            to="/jadi-mitra"
            className="flex items-center justify-between gap-4 p-4 sm:px-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <span className="w-10 h-10 rounded-xl bg-gray-100 text-[#111827] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  add_business
                </span>
              </span>
              <div>
                <p className="text-sm font-bold text-[#111827]">Ajukan Jadi Mitra Wisata</p>
                <p className="text-xs text-gray-500">Daftarkan destinasi wisata dan verifikasi rekening</p>
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
