import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { loadGateSession, loadStaffAccounts, saveGateSession } from '../utils/operationsStorage';

export default function GateLoginPage() {
  const navigate = useNavigate();
  const existingSession = loadGateSession();

  const [venueCode, setVenueCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (existingSession) {
    return <Navigate to="/gate/scan" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedCode = venueCode.trim().toUpperCase();
    const cleanPin = pin.trim();
    if (!normalizedCode || !/^\d{6}$/.test(cleanPin)) {
      setError('Masukkan kode destinasi dan PIN tepat 6 digit angka.');
      return;
    }

    const staffs = loadStaffAccounts();
    const matched = staffs.find(
      (s) => s.venueCode.toUpperCase() === normalizedCode && s.pin === cleanPin,
    );

    if (!matched) {
      setError('Kode destinasi atau PIN 6 digit tidak sesuai.');
      return;
    }

    if (!matched.isActive) {
      setError('Akun Staff Gate ini sedang dinonaktifkan oleh Owner Wisata.');
      return;
    }

    saveGateSession(matched);
    navigate('/gate/scan', { replace: true });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex relative bg-[#111827] text-white items-center justify-center overflow-hidden p-12">
        <div
          aria-hidden="true"
          className="absolute -top-32 -left-24 w-[580px] h-[580px] rounded-full border-[52px] border-white/[0.04]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-44 -right-24 w-[620px] h-[620px] rounded-full border-[60px] border-white/[0.05]"
        />

        <div className="relative z-10 max-w-sm space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px] text-white" aria-hidden="true">
                qr_code_scanner
              </span>
            </span>
            <span className="text-3xl font-extrabold tracking-tight">Fastix Gate</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            Portal verifikasi tiket masuk untuk petugas pintu destinasi wisata. Mendukung validasi
            cepat dan pencatatan antrean saat koneksi terbatas.
          </p>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex flex-col justify-center items-center px-6 py-10 sm:px-12">
        <div className="w-full max-w-sm space-y-7">
          <div className="flex items-center justify-between">
            <Link to="/explore" className="flex items-center gap-2 text-[#111827]">
              <span className="w-8 h-8 rounded-xl bg-[#111827] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  qr_code_scanner
                </span>
              </span>
              <span className="font-extrabold text-xl tracking-tight">Fastix Gate</span>
            </Link>

            <span className="px-2.5 py-1 rounded-full bg-gray-100 text-[11px] font-bold text-gray-700">
              Loket Check-in
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#111827]">
              Masuk Petugas Gate
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Masukkan nomor seri wisata dan PIN 6 digit dari Owner.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="gate-venue-code" className="block text-xs font-semibold text-[#111827]">
                No. Seri / Kode Wisata
              </label>
              <input
                id="gate-venue-code"
                type="text"
                value={venueCode}
                onChange={(e) => setVenueCode(e.target.value.toUpperCase())}
                placeholder="LOKA-0142"
                required
                className="w-full h-12 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none font-mono text-base text-[#111827]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gate-pin" className="block text-xs font-semibold text-[#111827]">
                PIN 6 Digit
              </label>
              <input
                id="gate-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                required
                className="w-full h-12 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none font-mono text-base tracking-[0.25em] text-[#111827]"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-[#111827] hover:bg-black text-white text-sm font-bold transition-colors"
            >
              Masuk ke Scanner
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <Link to="/explore" className="hover:text-[#111827] font-semibold">
              Kembali ke Beranda
            </Link>
            <Link to="/mitra" className="hover:text-[#111827] font-semibold">
              Portal Owner
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
