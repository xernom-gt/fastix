import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/authStore';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithPhone, loginWithGoogle } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/explore';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const isPhoneReady = phone.replace(/\D/g, '').length >= 9;

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isPhoneReady) {
      setError('Masukkan nomor HP yang valid (minimal 9 digit).');
      return;
    }
    setStep('otp');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.trim().length < 4) {
      setError('Masukkan kode OTP simulasi (minimal 4 digit, contoh: 123456).');
      return;
    }
    loginWithPhone(phone, fullName || 'Wisatawan Fastix');
    navigate(redirectTo, { replace: true });
  };

  const handleGoogle = () => {
    loginWithGoogle();
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Left Brand Panel (50% Desktop, Fastix Monochrome with Subtle Geometric Rings) */}
      <div className="hidden lg:flex relative bg-[#111827] text-white items-center justify-center overflow-hidden">
        {/* Subtle overlapping circular rings matching reference composition */}
        <div
          aria-hidden="true"
          className="fx-ring-slow absolute -top-32 -left-24 w-[620px] h-[620px] rounded-full border-[56px] border-white/[0.04]"
        />
        <div
          aria-hidden="true"
          className="fx-ring-slow-reverse absolute -bottom-48 -right-24 w-[680px] h-[680px] rounded-full border-[64px] border-white/[0.05]"
        />

        <div className="fx-fade-up relative z-10 flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px] text-white" aria-hidden="true">
              confirmation_number
            </span>
          </span>
          <span className="text-4xl font-extrabold tracking-tight text-white">Fastix</span>
        </div>
      </div>

      {/* Right Form Panel (50% Crisp White) */}
      <div className="flex flex-col justify-center items-center px-6 py-10 sm:px-12">
        <div className="fx-fade-up w-full max-w-sm space-y-7">
          {/* Top Brand + Language/Back Pill */}
          <div className="flex items-center justify-between">
            <Link to="/explore" className="flex items-center gap-2 text-[#111827]">
              <span className="w-8 h-8 rounded-xl bg-[#111827] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  confirmation_number
                </span>
              </span>
              <span className="font-extrabold text-xl tracking-tight">Fastix</span>
            </Link>

            <Link
              to="/explore"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-[#111827] transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-[#111827]" aria-hidden="true" />
              <span>ID</span>
            </Link>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#111827]">
              Selamat datang kembali!
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Silakan masuk untuk melanjutkan ke akun Anda.
            </p>
          </div>

          {step === 'input' ? (
            <form key="step-input" onSubmit={handleRequestOtp} className="fx-fade-up space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-phone" className="block text-xs font-semibold text-[#111827]">
                  Nomor HP / WhatsApp
                </label>
                <input
                  id="login-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="081234567890"
                  required
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm text-[#111827] placeholder:text-gray-400 transition-colors duration-200"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-name" className="block text-xs font-semibold text-[#111827]">
                  Nama Lengkap <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <input
                  id="login-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama sesuai pemegang tiket"
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm text-[#111827] placeholder:text-gray-400 transition-colors duration-200"
                />
              </div>

              {error && (
                <p role="alert" className="fx-fade-up text-xs font-semibold text-[#991B1B] bg-[#FEE2E2] px-3 py-2 rounded-xl">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className={`group w-full h-11 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] ${
                  isPhoneReady
                    ? 'bg-[#111827] hover:bg-black text-white shadow-sm hover:shadow'
                    : 'bg-gray-300 hover:bg-gray-400 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                  login
                </span>
                <span>Lanjutkan</span>
              </button>

              <div className="relative py-1 flex items-center">
                <div className="flex-1 border-t border-gray-200" />
                <span className="px-3 text-[11px] font-medium text-gray-400">atau</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                className="w-full h-11 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] text-xs sm:text-sm font-semibold text-[#111827] flex items-center justify-center gap-2 transition-all duration-200"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  account_circle
                </span>
                <span>Masuk dengan Google</span>
              </button>
            </form>
          ) : (
            <form key="step-otp" onSubmit={handleVerifyOtp} className="fx-fade-up space-y-4">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600">
                Kode OTP dikirim ke <strong className="text-[#111827]">{phone}</strong>.
                Gunakan <strong className="text-[#111827]">123456</strong> untuk simulasi.
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-otp" className="block text-xs font-semibold text-[#111827]">
                  Kode OTP
                </label>
                <input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  required
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm tracking-widest font-bold text-[#111827]"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs font-semibold text-[#991B1B] bg-[#FEE2E2] px-3 py-2 rounded-xl">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-[#111827] hover:bg-black text-white text-xs sm:text-sm font-bold transition-colors"
              >
                Verifikasi &amp; Masuk
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('input');
                  setError('');
                }}
                className="w-full text-center text-xs font-semibold text-gray-500 hover:text-[#111827]"
              >
                Ubah Nomor HP
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
