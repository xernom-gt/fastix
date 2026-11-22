import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/authStore';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    loginWithCredentials,
    requestRegistration,
    verifyRegistrationOtp,
    loginWithGoogle,
    loginAsDemoOwner,
  } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/explore';

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'form' | 'otp'>('form');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state (5 fields)
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // OTP state
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailTrimmed = loginEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setError('Masukkan alamat email yang valid.');
      return;
    }

    if (loginPassword.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedIn = await loginWithCredentials(emailTrimmed, loginPassword);
      if (loggedIn.role === 'OWNER') {
        navigate('/mitra', { replace: true });
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal masuk ke akun.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!regFullName.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }

    const cleanPhone = regPhone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setError('Nomor HP/WhatsApp minimal 9 digit.');
      return;
    }

    const emailTrimmed = regEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setError('Masukkan alamat email yang valid.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Kata sandi dan ulangi kata sandi harus sama.');
      return;
    }

    setIsSubmitting(true);
    try {
      const info = await requestRegistration({
        fullName: regFullName,
        phoneNumber: regPhone,
        email: emailTrimmed,
        password: regPassword,
      });
      setDevOtpHint(info.devOtp ?? '');
      setOtp('');
      setStep('otp');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal mengirim kode OTP pendaftaran.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.trim().length < 6) {
      setError('Masukkan 6 digit kode OTP yang dikirimkan.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyRegistrationOtp(regEmail, otp);
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal memverifikasi OTP.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSelect = (email: string) => {
    const loggedIn = loginWithGoogle(email);
    if (loggedIn.role === 'OWNER') {
      navigate('/mitra', { replace: true });
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  const handleDemoOwner = () => {
    loginAsDemoOwner();
    const target = searchParams.get('redirect') || '/mitra';
    navigate(target, { replace: true });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Left Brand Panel (50% Desktop, Fastix Monochrome with Subtle Geometric Rings) */}
      <div className="hidden lg:flex relative bg-[#111827] text-white items-center justify-center overflow-hidden">
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
        <div className="fx-fade-up w-full max-w-sm space-y-6">
          {/* Top Brand + Back Pill */}
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
              {authMode === 'login' ? 'Selamat datang kembali!' : 'Buat Akun Wisatawan'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {authMode === 'login'
                ? 'Silakan masuk untuk melanjutkan ke akun Anda.'
                : 'Daftar akun Fastix untuk kemudahan transaksi tiket wisata.'}
            </p>
          </div>

          {/* Toggle Masuk vs Daftar (hanya tampil saat tahap form) */}
          {step === 'form' && (
            <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'login'}
                onClick={() => {
                  setAuthMode('login');
                  setError('');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                  authMode === 'login'
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-gray-500 hover:text-[#111827]'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'register'}
                onClick={() => {
                  setAuthMode('register');
                  setError('');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                  authMode === 'register'
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-gray-500 hover:text-[#111827]'
                }`}
              >
                Daftar
              </button>
            </div>
          )}

          {step === 'form' ? (
            authMode === 'login' ? (
              /* Form Masuk (Email & Password) */
              <form key="mode-login" onSubmit={handleLoginSubmit} className="fx-fade-up space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="block text-xs font-semibold text-[#111827]">
                    Alamat Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="nama@email.com"
                    required
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm text-[#111827] placeholder:text-gray-400 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-[#111827]">
                    Kata Sandi
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm text-[#111827] placeholder:text-gray-400 transition-colors"
                  />
                </div>

                {error && (
                  <p role="alert" className="fx-fade-up text-xs font-semibold text-[#991B1B] bg-[#FEE2E2] px-3 py-2 rounded-xl">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group w-full h-11 rounded-xl bg-[#111827] hover:bg-black disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow"
                >
                  <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                    login
                  </span>
                  <span>{isSubmitting ? 'Memproses...' : 'Masuk ke Akun'}</span>
                </button>

                <div className="relative py-1 flex items-center">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="px-3 text-[11px] font-medium text-gray-400">atau</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>

                <button
                  type="button"
                  onClick={() => setShowGooglePicker((prev) => !prev)}
                  className="w-full h-11 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] text-xs sm:text-sm font-semibold text-[#111827] flex items-center justify-center gap-2 transition-all duration-200"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    account_circle
                  </span>
                  <span>Masuk dengan Google</span>
                </button>

                {showGooglePicker && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 space-y-1.5">
                    <p className="px-1.5 text-[11px] font-semibold text-gray-500">
                      Pilih akun Google simulasi:
                    </p>
                    <button
                      type="button"
                      onClick={() => handleGoogleSelect('raka.pratama@gmail.com')}
                      className="w-full text-left px-3 py-2 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#111827] truncate">Raka Pratama</p>
                        <p className="text-[11px] text-gray-500 truncate">raka.pratama@gmail.com</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-700 shrink-0">
                        Wisatawan
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGoogleSelect('bagus@tirtagangga.id')}
                      className="w-full text-left px-3 py-2 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#111827] truncate">Anak Agung Bagus</p>
                        <p className="text-[11px] text-gray-500 truncate">bagus@tirtagangga.id</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#111827] text-[10px] font-bold text-white shrink-0">
                        Owner
                      </span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDemoOwner}
                  className="w-full h-11 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 active:scale-[0.98] text-xs font-bold text-[#111827] flex items-center justify-center gap-2 transition-all duration-200"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    storefront
                  </span>
                  <span>Masuk Demo Owner (Tirta Gangga · LOKA-0142)</span>
                </button>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <Link to="/explore" className="hover:text-[#111827] font-semibold transition-colors">
                    Kembali ke Beranda
                  </Link>
                  <Link
                    to="/gate/login"
                    className="inline-flex items-center gap-1 font-semibold text-gray-600 hover:text-[#111827] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      qr_code_scanner
                    </span>
                    <span>Masuk sebagai Staff</span>
                  </Link>
                </div>
              </form>
            ) : (
              /* Form Daftar (5 Fields) */
              <form key="mode-register" onSubmit={handleRegisterSubmit} className="fx-fade-up space-y-3.5">
                <div className="space-y-1">
                  <label htmlFor="reg-name" className="block text-xs font-semibold text-[#111827]">
                    Nama Lengkap
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Nama sesuai KTP atau identitas"
                    required
                    className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm text-[#111827] placeholder:text-gray-400 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-phone" className="block text-xs font-semibold text-[#111827]">
                    Nomor HP / WhatsApp
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="081234567890"
                    required
                    className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm text-[#111827] placeholder:text-gray-400 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-email" className="block text-xs font-semibold text-[#111827]">
                    Alamat Email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="nama@email.com"
                    required
                    className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm text-[#111827] placeholder:text-gray-400 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-password" className="block text-xs font-semibold text-[#111827]">
                    Kata Sandi
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                    className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm text-[#111827] placeholder:text-gray-400 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-[#111827]">
                    Ulangi Kata Sandi
                  </label>
                  <input
                    id="reg-confirm-password"
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi"
                    required
                    className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-sm text-[#111827] placeholder:text-gray-400 transition-colors"
                  />
                </div>

                {error && (
                  <p role="alert" className="fx-fade-up text-xs font-semibold text-[#991B1B] bg-[#FEE2E2] px-3 py-2 rounded-xl">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group w-full h-11 rounded-xl bg-[#111827] hover:bg-black disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow mt-2"
                >
                  <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                    arrow_forward
                  </span>
                  <span>{isSubmitting ? 'Mengirim OTP...' : 'Daftar & Minta OTP'}</span>
                </button>

                <p className="text-center text-xs text-gray-500 pt-1">
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setError('');
                    }}
                    className="font-bold text-[#111827] hover:underline"
                  >
                    Masuk di sini
                  </button>
                </p>
              </form>
            )
          ) : (
            /* Tahap OTP 6 Digit setelah Registrasi */
            <form key="step-otp" onSubmit={handleVerifyOtp} className="fx-fade-up space-y-4">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 leading-relaxed space-y-1.5">
                <p>
                  Kode OTP verifikasi pendaftaran dikirim ke{' '}
                  <strong className="text-[#111827]">{regPhone}</strong> &amp;{' '}
                  <strong className="text-[#111827]">{regEmail}</strong>.
                </p>
                <p className="font-semibold text-[#111827]">
                  Gunakan kode simulasi:{' '}
                  <span className="font-mono text-sm px-2 py-0.5 rounded bg-gray-200 text-[#111827]">
                    {devOtpHint || '123456'}
                  </span>
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-otp" className="block text-xs font-semibold text-[#111827]">
                  Kode OTP (6 Digit)
                </label>
                <input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  required
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-gray-300 focus:border-[#111827] focus:outline-none text-center text-lg tracking-[0.3em] font-extrabold text-[#111827]"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs font-semibold text-[#991B1B] bg-[#FEE2E2] px-3 py-2 rounded-xl">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-[#111827] hover:bg-black disabled:opacity-60 text-white text-xs sm:text-sm font-bold transition-colors"
              >
                {isSubmitting ? 'Memverifikasi...' : 'Verifikasi OTP & Selesaikan Pendaftaran'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setError('');
                }}
                className="w-full text-center text-xs font-semibold text-gray-500 hover:text-[#111827]"
              >
                Ubah Data Pendaftaran
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
