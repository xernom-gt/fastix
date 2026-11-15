import { useState } from 'react';
import { formatRupiah, StatusBadge, type KybStatus, type PayoutStatus } from '@pariwisloka/shared';

interface KybSubmission {
  id: string;
  venueCode: string;
  venueName: string;
  city: string;
  applicantName: string;
  bankInfo: string;
  nib: string;
  submittedAt: string;
  status: KybStatus;
  rejectionReason?: string;
}

interface PayoutItem {
  id: string;
  ownerName: string;
  venueCode: string;
  amount: number;
  adminFee: number;
  bankInfo: string;
  status: PayoutStatus;
  createdAt: string;
}

const INITIAL_KYB: KybSubmission[] = [
  {
    id: 'kyb_01',
    venueCode: 'LOKA-0718',
    venueName: 'Pantai Pandawa Cliff Park',
    city: 'Badung, Bali',
    applicantName: 'I Made Surya',
    bankInfo: 'BCA · 1420987654 · a.n. I Made Surya',
    nib: 'NIB-9120394812',
    submittedAt: '13 Nov 2026, 07:45 WITA',
    status: 'PENDING',
  },
  {
    id: 'kyb_02',
    venueCode: 'LOKA-0142',
    venueName: 'Tirta Gangga Water Palace',
    city: 'Karangasem, Bali',
    applicantName: 'Anak Agung Bagus',
    bankInfo: 'Mandiri · 1450011223344 · a.n. Yayasan Tirta',
    nib: 'NIB-8812039411',
    submittedAt: '10 Nov 2026, 14:20 WITA',
    status: 'APPROVED',
  },
];

const MOCK_PAYOUTS: PayoutItem[] = [
  {
    id: 'po_01',
    ownerName: 'Anak Agung Bagus',
    venueCode: 'LOKA-0142',
    amount: 4500000,
    adminFee: 6500,
    bankInfo: 'Mandiri · 1450011223344',
    status: 'PROCESSING',
    createdAt: '13 Nov 2026, 08:00 WIB',
  },
  {
    id: 'po_02',
    ownerName: 'Pengelola Prambanan',
    venueCode: 'LOKA-0315',
    amount: 12000000,
    adminFee: 6500,
    bankInfo: 'BNI · 0988776655',
    status: 'SUCCESS',
    createdAt: '12 Nov 2026, 16:30 WIB',
  },
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('admin@pariwisloka.id');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<'kyb' | 'escrow'>('kyb');
  const [mobileMenu, setMobileMenu] = useState(false);

  const [submissions, setSubmissions] = useState<KybSubmission[]>(INITIAL_KYB);
  const [rejectTarget, setRejectTarget] = useState<KybSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoggedIn(true);
  };

  const approveSubmission = (id: string) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'APPROVED', rejectionReason: undefined } : s)),
    );
  };

  const submitReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setRejectError('Alasan penolakan wajib diisi sesuai aturan PRD.');
      return;
    }
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === rejectTarget.id ? { ...s, status: 'REJECTED', rejectionReason: rejectReason.trim() } : s,
      ),
    );
    setRejectTarget(null);
    setRejectReason('');
    setRejectError('');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Internal Private Panel
            </span>
            <h1 className="text-2xl font-extrabold text-gray-900 mt-1">Pariwisloka HQ</h1>
            <p className="text-sm text-gray-600 mt-1">
              Masuk dengan kredensial Internal Admin untuk verifikasi berkas KYB dan pengawasan escrow.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="hq-email" className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Email Internal
              </label>
              <input
                id="hq-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-300 text-sm text-gray-900"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="hq-pass" className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Kata Sandi
              </label>
              <input
                id="hq-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi demo apa saja"
                required
                className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-300 text-sm text-gray-900"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors"
            >
              Masuk ke Pariwisloka HQ
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 text-gray-900">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-gray-200 p-4 justify-between">
        <div className="space-y-6">
          <div className="px-2 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Internal Panel</span>
            <p className="text-lg font-extrabold text-gray-900">Pariwisloka HQ</p>
          </div>

          <nav aria-label="Menu Admin HQ" className="space-y-1.5">
            <button
              type="button"
              onClick={() => setTab('kyb')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                tab === 'kyb' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Verifikasi KYB Owner
            </button>
            <button
              type="button"
              onClick={() => setTab('escrow')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                tab === 'escrow' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Escrow &amp; Payout
            </button>
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setIsLoggedIn(false)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-xs font-bold text-gray-800"
        >
          Keluar HQ
        </button>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
        <span className="font-extrabold text-base">Pariwisloka HQ</span>
        <button
          type="button"
          onClick={() => setMobileMenu((v) => !v)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold"
        >
          Menu
        </button>
      </header>
      {mobileMenu && (
        <div className="md:hidden bg-white border-b border-gray-200 p-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setTab('kyb');
              setMobileMenu(false);
            }}
            className="text-left px-3 py-2 rounded-lg text-sm font-bold bg-gray-100"
          >
            Verifikasi KYB Owner
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('escrow');
              setMobileMenu(false);
            }}
            className="text-left px-3 py-2 rounded-lg text-sm font-bold bg-gray-100"
          >
            Escrow &amp; Payout
          </button>
          <button
            type="button"
            onClick={() => setIsLoggedIn(false)}
            className="text-left px-3 py-2 rounded-lg text-xs font-bold text-red-700"
          >
            Keluar HQ
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 max-w-5xl space-y-6">
        {tab === 'kyb' ? (
          <>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Antrean Verifikasi Legalitas (KYB)</h1>
              <p className="text-sm text-gray-600 mt-1">
                Persetujuan otomatis mengubah role user menjadi OWNER dan memublikasikan destinasi.
              </p>
            </div>

            <div className="space-y-4">
              {submissions.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-gray-500">
                        {item.venueCode} · {item.city}
                      </span>
                      <h2 className="text-lg font-bold text-gray-900">{item.venueName}</h2>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Pengaju: <strong>{item.applicantName}</strong> · {item.submittedAt}
                      </p>
                    </div>
                    <StatusBadge module="kyb" status={item.status} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                    <div>
                      <span className="block font-bold text-gray-500 uppercase">NIB &amp; Watermark Dokumen</span>
                      <span className="font-semibold text-gray-900">
                        {item.nib} · Berkas KTP/NPWP ber-watermark internal
                      </span>
                    </div>
                    <div>
                      <span className="block font-bold text-gray-500 uppercase">Rekening Tujuan Payout</span>
                      <span className="font-semibold text-gray-900">{item.bankInfo}</span>
                    </div>
                  </div>

                  {item.rejectionReason && (
                    <p className="text-xs font-semibold text-red-800 bg-red-50 border border-red-200 p-3 rounded-xl">
                      Alasan Penolakan: {item.rejectionReason}
                    </p>
                  )}

                  {item.status === 'PENDING' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => approveSubmission(item.id)}
                        className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold"
                      >
                        Setujui (APPROVED)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectTarget(item)}
                        className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-bold"
                      >
                        Tolak Berkas
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Pengawasan Escrow &amp; Payout</h1>
              <p className="text-sm text-gray-600 mt-1">
                Mode baca-saja sesuai aturan BRD: saldo Owner hanya berubah melalui mutasi resmi sistem.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Owner / Wisata</th>
                    <th className="px-4 py-3 font-bold">Rekening</th>
                    <th className="px-4 py-3 font-bold">Nominal</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {MOCK_PAYOUTS.map((po) => (
                    <tr key={po.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900">{po.ownerName}</p>
                        <p className="text-xs text-gray-500">
                          {po.venueCode} · {po.createdAt}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{po.bankInfo}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">{formatRupiah(po.amount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge module="payout" status={po.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={submitReject}
            className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 border border-gray-200"
          >
            <h2 id="reject-title" className="text-lg font-extrabold text-gray-900">
              Tolak Pengajuan {rejectTarget.venueName}
            </h2>
            <div className="space-y-1.5">
              <label htmlFor="reject-reason" className="block text-xs font-bold uppercase text-gray-600">
                Alasan Penolakan (Wajib)
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Foto NPWP buram, mohon unggah ulang dokumen yang terbaca jelas."
                className="w-full p-3 rounded-xl bg-gray-50 border border-gray-300 text-sm text-gray-900"
              />
            </div>
            {rejectError && (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {rejectError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectError('');
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold"
              >
                Kirim Penolakan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
