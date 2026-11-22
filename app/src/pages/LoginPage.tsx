import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/authStore';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with';
      shape?: 'rectangular' | 'pill';
      width?: number;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsIdApi;
      };
    };
  }
}

const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    loginWithCredentials,
    loginWithGoogle,
    requestRegistration,
    verifyRegistrationOtp,
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

  // OTP & Google state
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState('');

  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setError('Autentikasi Google tidak mengembalikan token kredensial.');
        return;
      }

      setError('');
      setIsSubmitting(true);
      try {
        const loggedIn = await loginWithGoogle(response.credential);
        if (loggedIn.role === 'OWNER') {
          navigate('/mitra', { replace: true });
          return;
        }
        navigate(redirectTo, { replace: true });
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Gagal masuk dengan akun Google.',
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [loginWithGoogle, navigate, redirectTo],
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || step !== 'form' || authMode !== 'login') {
      setGoogleReady(false);
      return;
    }

    let cancelled = false;
    const initGoogleButton = () => {
      const gsi = window.google?.accounts?.id;
      const container = googleButtonRef.current;
      if (!gsi || !container || cancelled) return false;

      gsi.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (res) => {
          void handleGoogleCredential(res);
        },
      });
      container.innerHTML = '';
      gsi.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: container.clientWidth || 320,
      });
      setGoogleReady(true);
      return true;
    };

    if (initGoogleButton()) return;

    const timer = window.setInterval(() => {
      if (initGoogleButton()) {
        window.clearInterval(timer);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authMode, step, handleGoogleCredential]);

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
      setError(err instanceof Error ? err.message : 'Gagal masuk ke akun.');
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
      await requestRegistration({
        fullName: regFullName,
        phoneNumber: regPhone,
        email: emailTrimmed,
        password: regPassword,
      });
      setOtp('');
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim kode OTP pendaftaran.');
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
      setError(err instanceof Error ? err.message : 'Gagal memverifikasi OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleFallbackClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In belum dikonfigurasi pada environment (VITE_GOOGLE_CLIENT_ID).');
      return;
    }
    setError('Layanan Google Sign-In sedang dimuat. Silakan coba beberapa saat lagi.');
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

          {/* Toggle Masuk vs Daftar */}
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

                <div ref={googleButtonRef} className={googleReady ? 'w-full flex justify-center' : 'hidden'} />

                {!googleReady && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleGoogleFallbackClick}
                    className="w-full h-11 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] disabled:opacity-60 text-xs sm:text-sm font-semibold text-[#111827] flex items-center justify-center gap-2 transition-all duration-200"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      account_circle
                    </span>
                    <span>Masuk dengan Google</span>
                  </button>
                )}

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
            <form key="step-otp" onSubmit={handleVerifyOtp} className="fx-fade-up space-y-4">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 leading-relaxed">
                Masukkan 6 digit kode OTP verifikasi pendaftaran yang telah dikirim ke{' '}
                <strong className="text-[#111827]">{regEmail}</strong>.
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
                  placeholder="000000"
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
