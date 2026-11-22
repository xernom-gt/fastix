import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { WILAYAH_INDONESIA, type KybStatus } from '@pariwisloka/shared';
import { apiPost, getAuthToken } from '../services/apiClient';
import { useAuth } from '../store/authStore';

interface KybApplication {
  venueName: string;
  kotaKode: string;
  alamat: string;
  ktpNumber: string;
  npwpNumber: string;
  nibNumber: string;
  bankName: string;
  bankAccountNumber: string;
  status: KybStatus;
  submittedAt?: string;
}

const KYB_STORAGE_KEY = 'fastix_kyb_application_v1';

function loadKybApplication(): KybApplication {
  try {
    const raw = localStorage.getItem(KYB_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as KybApplication;
  } catch {
    // ignore storage read error
  }
  return {
    venueName: '',
    kotaKode: 'bali',
    alamat: '',
    ktpNumber: '',
    npwpNumber: '',
    nibNumber: '',
    bankName: 'BCA',
    bankAccountNumber: '',
    status: 'NOT_SUBMITTED',
  };
}

export default function MitraApplyPage() {
  const { user, isAuthenticated, upgradeToOwner } = useAuth();
  const [form, setForm] = useState<KybApplication>(loadKybApplication);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthenticated || !user) {
    return <Navigate to="/login?redirect=/jadi-mitra" replace />;
  }

  const saveForm = (next: KybApplication) => {
    setForm(next);
    localStorage.setItem(KYB_STORAGE_KEY, JSON.stringify(next));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (
      !form.venueName.trim() ||
      !form.alamat.trim() ||
      !form.ktpNumber.trim() ||
      !form.npwpNumber.trim() ||
      !form.nibNumber.trim() ||
      !form.bankAccountNumber.trim()
    ) {
      setError('Lengkapi seluruh data tempat wisata, dokumen legalitas, dan rekening bank.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (getAuthToken()) {
        await apiPost('/mitra/kyb', {
          ktpNumber: form.ktpNumber.trim(),
          ktpPhotoUrl: 'https://storage.fastix.id/kyb/ktp-placeholder.jpg',
          npwpNumber: form.npwpNumber.trim(),
          npwpPhotoUrl: 'https://storage.fastix.id/kyb/npwp-placeholder.jpg',
          nibNumber: form.nibNumber.trim(),
          bankCode: form.bankName,
          bankAccountNumber: form.bankAccountNumber.trim(),
          bankAccountName: user.fullName,
        });
      }

      saveForm({
        ...form,
        status: 'PENDING',
        submittedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal mengirim pengajuan KYB. Silakan periksa kembali data Anda.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateApprove = () => {
    saveForm({
      ...form,
      status: 'APPROVED',
    });
    upgradeToOwner(['tirta-gangga']);
  };

  if (user.role === 'OWNER' || form.status === 'APPROVED') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#111827] text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              verified
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#111827]">
            Akun Mitra Wisata Aktif
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Pengajuan verifikasi usaha Anda telah disetujui. Anda kini dapat mengelola tiket,
            kuota harian, dan akun petugas gerbang melalui Dashboard Owner.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/mitra"
              className="px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-colors"
            >
              Buka Dashboard Owner
            </Link>
            <Link
              to="/akun"
              className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-[#111827] text-xs font-bold transition-colors"
            >
              Kembali ke Akun
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-6">
      <div className="space-y-1">
        <Link
          to="/akun"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#111827]"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            arrow_back
          </span>
          <span>Kembali ke Akun</span>
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">
          Ajukan Jadi Mitra Wisata
        </h1>
        <p className="text-sm text-gray-600">
          Lengkapi profil destinasi dan dokumen verifikasi usaha untuk menjual tiket di Fastix.
        </p>
      </div>

      {form.status === 'PENDING' ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
            Menunggu Verifikasi
          </span>
          <h2 className="text-lg font-extrabold text-[#111827]">{form.venueName}</h2>
          <p className="text-xs text-gray-600">
            Dokumen KTP ({form.ktpNumber}), NPWP ({form.npwpNumber}), NIB ({form.nibNumber}), dan
            rekening {form.bankName} ({form.bankAccountNumber}) sedang ditinjau oleh tim Admin.
          </p>

          <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSimulateApprove}
              className="px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-colors"
            >
              Setujui Pengajuan (Aktifkan Owner)
            </button>
            <button
              type="button"
              onClick={() => saveForm({ ...form, status: 'NOT_SUBMITTED' })}
              className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs font-bold text-[#111827] transition-colors"
            >
              Ubah Data
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5"
        >
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-[#111827]">1. Informasi Tempat Wisata</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="kyb-venue" className="block text-xs font-semibold text-gray-700">
                  Nama Destinasi
                </label>
                <input
                  id="kyb-venue"
                  type="text"
                  value={form.venueName}
                  onChange={(e) => setForm({ ...form, venueName: e.target.value })}
                  placeholder="Taman Wisata Tirta Sari"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-sm text-[#111827]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="kyb-kota" className="block text-xs font-semibold text-gray-700">
                  Wilayah
                </label>
                <select
                  id="kyb-kota"
                  value={form.kotaKode}
                  onChange={(e) => setForm({ ...form, kotaKode: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-300 bg-white text-sm text-[#111827]"
                >
                  {WILAYAH_INDONESIA.map((w) => (
                    <option key={w.kode} value={w.kode}>
                      {w.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="kyb-alamat" className="block text-xs font-semibold text-gray-700">
                Alamat Lengkap
              </label>
              <input
                id="kyb-alamat"
                type="text"
                value={form.alamat}
                onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                placeholder="Jl. Raya Abang Desa Adat, Karangasem"
                required
                className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-sm text-[#111827]"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <h2 className="text-sm font-extrabold text-[#111827]">
              2. Dokumen Legalitas &amp; Rekening Pencairan
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="kyb-ktp" className="block text-xs font-semibold text-gray-700">
                  Nomor KTP
                </label>
                <input
                  id="kyb-ktp"
                  type="text"
                  value={form.ktpNumber}
                  onChange={(e) => setForm({ ...form, ktpNumber: e.target.value })}
                  placeholder="5107011208900002"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-sm text-[#111827]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="kyb-npwp" className="block text-xs font-semibold text-gray-700">
                  Nomor NPWP
                </label>
                <input
                  id="kyb-npwp"
                  type="text"
                  value={form.npwpNumber}
                  onChange={(e) => setForm({ ...form, npwpNumber: e.target.value })}
                  placeholder="09.254.294.3-907.000"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-sm text-[#111827]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="kyb-nib" className="block text-xs font-semibold text-gray-700">
                  Nomor NIB
                </label>
                <input
                  id="kyb-nib"
                  type="text"
                  value={form.nibNumber}
                  onChange={(e) => setForm({ ...form, nibNumber: e.target.value })}
                  placeholder="1220004918273"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-sm text-[#111827]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="kyb-bank" className="block text-xs font-semibold text-gray-700">
                  Bank Pencairan
                </label>
                <select
                  id="kyb-bank"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-300 bg-white text-sm text-[#111827]"
                >
                  <option value="BCA">BCA</option>
                  <option value="Mandiri">Bank Mandiri</option>
                  <option value="BNI">BNI</option>
                  <option value="BRI">BRI</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="kyb-rek" className="block text-xs font-semibold text-gray-700">
                  Nomor Rekening
                </label>
                <input
                  id="kyb-rek"
                  type="text"
                  value={form.bankAccountNumber}
                  onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                  placeholder="7720194821"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-sm text-[#111827]"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-[#111827] hover:bg-black disabled:opacity-60 text-white text-sm font-bold transition-colors"
          >
            {isSubmitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Mitra'}
          </button>
        </form>
      )}
    </div>
  );
}
