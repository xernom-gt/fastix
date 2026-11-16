import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getTodayISO } from '@pariwisloka/shared';
import { useBookings } from '../store/bookingStore';
import {
  loadGateSession,
  loadOfflineQueue,
  saveGateSession,
  saveOfflineQueue,
  type OfflineScanQueueItem,
} from '../utils/operationsStorage';

interface ScanOutcome {
  accepted: boolean;
  headline: string;
  detail: string;
  ticketCode: string;
}

function extractTicketCode(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';
  const parts = trimmed.split('|');
  return (parts[0] ?? '').trim().toUpperCase();
}

function formatScanTime(iso?: string): string {
  if (!iso) return 'waktu tidak tercatat';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GateScanPage() {
  const navigate = useNavigate();
  const staff = loadGateSession();
  const { tickets, redeemTicket } = useBookings();

  const [offlineQueue, setOfflineQueue] = useState<OfflineScanQueueItem[]>(loadOfflineQueue);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'REDEEMED'>('ALL');

  // Camera preview state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraNotice(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraNotice('Perangkat/browser tidak mendukung akses kamera. Gunakan input manual kode tiket.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraNotice(
        'Izin kamera ditolak atau kamera tidak tersedia. Gunakan input manual kode PWL-TIX di bawah.',
      );
      setCameraActive(false);
    }
  };

  const venueTickets = useMemo(() => {
    if (!staff) return [];
    return tickets.filter((t) => t.venueId === staff.venueId);
  }, [tickets, staff]);

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'ALL') return venueTickets;
    return venueTickets.filter((t) => t.status === statusFilter);
  }, [venueTickets, statusFilter]);

  if (!staff) {
    return <Navigate to="/gate/login" replace />;
  }

  const processTicketCode = (raw: string) => {
    const code = extractTicketCode(raw);
    if (!code) return;

    const target = venueTickets.find((t) => t.ticketCode.toUpperCase() === code);
    if (!target) {
      setOutcome({
        accepted: false,
        headline: 'DITOLAK • Tiket Tidak Dikenali',
        detail: `Kode ${code} tidak terdaftar untuk ${staff.venueName}.`,
        ticketCode: code,
      });
      return;
    }

    // Anti-double-scan: reject any ticket that has already been redeemed and show first scan time
    if (target.status === 'REDEEMED') {
      setOutcome({
        accepted: false,
        headline: 'DITOLAK • Sudah Digunakan (Double-Scan)',
        detail: `${target.holderName} (${target.ticketTitle}) sudah check-in pada ${formatScanTime(target.redeemedAt)}.`,
        ticketCode: target.ticketCode,
      });
      return;
    }

    if (target.status === 'EXPIRED') {
      setOutcome({
        accepted: false,
        headline: 'DITOLAK • Tiket Kedaluwarsa',
        detail: `Masa berlaku tiket ${target.ticketCode} telah habis.`,
        ticketCode: target.ticketCode,
      });
      return;
    }

    const today = getTodayISO();
    if (target.bookingDate !== today) {
      setOutcome({
        accepted: false,
        headline: 'DITOLAK • Tanggal Kunjungan Tidak Sesuai',
        detail: `Tiket berlaku untuk ${target.bookingDate}, bukan kunjungan hari ini (${today}).`,
        ticketCode: target.ticketCode,
      });
      return;
    }

    const redeemed = redeemTicket(target.ticketCode);
    const nowIso = redeemed?.redeemedAt ?? new Date().toISOString();

    if (isOfflineMode) {
      const queuedItem: OfflineScanQueueItem = {
        id: `q_${Date.now()}`,
        ticketCode: target.ticketCode,
        holderName: target.holderName,
        ticketTitle: target.ticketTitle,
        scannedAt: nowIso,
        synced: false,
      };
      const nextQueue = [queuedItem, ...offlineQueue];
      setOfflineQueue(nextQueue);
      saveOfflineQueue(nextQueue);
    }

    setOutcome({
      accepted: true,
      headline: isOfflineMode
        ? 'VALID • Disimpan ke Antrean Offline'
        : 'VALID • Check-in Berhasil',
      detail: `${target.holderName} — ${target.ticketTitle}`,
      ticketCode: target.ticketCode,
    });
    setManualInput('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processTicketCode(manualInput);
  };

  const handleSyncOfflineQueue = () => {
    const nextQueue = offlineQueue.map((item) => ({ ...item, synced: true }));
    setOfflineQueue(nextQueue);
    saveOfflineQueue(nextQueue);
  };

  const handleLogout = () => {
    stopCamera();
    saveGateSession(null);
    navigate('/gate/login', { replace: true });
  };

  const pendingSyncCount = offlineQueue.filter((q) => !q.synced).length;
  const validCount = venueTickets.filter((t) => t.status === 'VALID').length;
  const redeemedCount = venueTickets.filter((t) => t.status === 'REDEEMED').length;

  return (
    <div className="min-h-screen bg-gray-50 text-[#111827] pb-12">
      {/* Top Gate Bar */}
      <header className="sticky top-0 z-30 bg-[#111827] text-white border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-white/15 border border-white/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                qr_code_scanner
              </span>
            </span>
            <div>
              <p className="text-sm font-extrabold leading-tight">{staff.venueName}</p>
              <p className="text-[11px] text-gray-300">
                {staff.venueCode} • Petugas: {staff.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOfflineMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                isOfflineMode
                  ? 'bg-amber-400 text-[#111827] border-amber-300'
                  : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
              }`}
            >
              {isOfflineMode ? 'Mode Offline Aktif' : 'Mode Online'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white transition-colors"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Ringkasan Harian */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl bg-white border border-gray-200 p-4">
            <p className="text-[11px] font-semibold text-gray-500">Total Hari Ini</p>
            <p className="text-xl font-extrabold text-[#111827] mt-0.5">{venueTickets.length}</p>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-4">
            <p className="text-[11px] font-semibold text-gray-500">Belum Check-in</p>
            <p className="text-xl font-extrabold text-[#111827] mt-0.5">{validCount}</p>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-4">
            <p className="text-[11px] font-semibold text-gray-500">Sudah Masuk</p>
            <p className="text-xl font-extrabold text-[#111827] mt-0.5">{redeemedCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Kamera QR + Input Manual + Hasil Validasi */}
          <div className="lg:col-span-7 space-y-5">
            <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-base font-extrabold text-[#111827]">
                  Pemindai QR E-Ticket
                </h1>
                {cameraActive ? (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#111827] transition-colors"
                  >
                    Matikan Kamera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-1.5 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      videocam
                    </span>
                    <span>Aktifkan Kamera</span>
                  </button>
                )}
              </div>

              <div className="relative w-full h-52 sm:h-60 rounded-2xl bg-[#090D16] overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />
                {!cameraActive && (
                  <div className="text-center px-6 space-y-2 text-gray-300">
                    <span
                      className="material-symbols-outlined text-[40px] text-white/70"
                      aria-hidden="true"
                    >
                      qr_code_2
                    </span>
                    <p className="text-xs">
                      Arahkan kamera ke QR e-ticket pengunjung atau masukkan kode di bawah.
                    </p>
                  </div>
                )}
                {cameraActive && (
                  <div
                    aria-hidden="true"
                    className="absolute w-40 h-40 rounded-2xl border-2 border-white/80 pointer-events-none"
                  />
                )}
              </div>

              {cameraNotice && (
                <div className="rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-700">
                  {cameraNotice}
                </div>
              )}

              {/* Input Manual Fallback */}
              <form onSubmit={handleManualSubmit} className="space-y-2.5 pt-1">
                <label
                  htmlFor="gate-manual-code"
                  className="block text-xs font-bold text-[#111827]"
                >
                  Input / Paste Kode Tiket Manual
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="gate-manual-code"
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="PWL-TIX-9A8B7C6D"
                    className="flex-1 h-11 px-3.5 rounded-xl border border-gray-300 font-mono text-sm text-[#111827] focus:border-[#111827] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="h-11 px-5 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold whitespace-nowrap transition-colors"
                  >
                    Validasi Tiket
                  </button>
                </div>

                {/* Tombol Uji Cepat */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-gray-500">Uji cepat:</span>
                  {venueTickets.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => processTicketCode(t.ticketCode)}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 font-mono text-[11px] font-bold text-[#111827] transition-colors"
                    >
                      {t.ticketCode}
                    </button>
                  ))}
                </div>
              </form>

              {outcome && (
                <div
                  role="status"
                  className={`rounded-2xl border p-4 space-y-1 ${
                    outcome.accepted
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-red-50 border-red-300 text-red-900'
                  }`}
                >
                  <p className="text-sm font-extrabold">{outcome.headline}</p>
                  <p className="text-xs font-medium">{outcome.detail}</p>
                  <p className="text-[11px] font-mono opacity-80">{outcome.ticketCode}</p>
                </div>
              )}
            </section>

            {/* Panel Antrean Offline Sync */}
            <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-[#111827]">
                    Antrean Offline Sync ({pendingSyncCount} tertunda)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Hasil validasi saat Mode Offline disimpan lokal hingga disinkronkan.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pendingSyncCount === 0}
                  onClick={handleSyncOfflineQueue}
                  className="px-4 py-2 rounded-xl bg-[#111827] hover:bg-black disabled:bg-gray-200 disabled:text-gray-500 text-white text-xs font-bold transition-colors"
                >
                  Sinkronkan
                </button>
              </div>

              {offlineQueue.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">
                  Belum ada antrean scan offline. Aktifkan &ldquo;Mode Offline&rdquo; untuk simulasi.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {offlineQueue.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-[#111827]">{item.ticketCode}</p>
                        <p className="text-gray-500 truncate">
                          {item.holderName} • {item.ticketTitle}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          item.synced
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {item.synced ? 'Tersinkron' : 'Menunggu Sync'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Kolom Kanan: Daftar Tiket Harian */}
          <section className="lg:col-span-5 rounded-2xl bg-white border border-gray-200 p-5 space-y-4 h-fit">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#111827]">Daftar Tiket Hari Ini</h2>
              <div className="flex items-center gap-1">
                {(['ALL', 'VALID', 'REDEEMED'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      statusFilter === tab
                        ? 'bg-[#111827] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab === 'ALL' ? 'Semua' : tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {filteredTickets.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-mono text-xs font-extrabold text-[#111827]">
                      {t.ticketCode}
                    </p>
                    <p className="text-xs font-semibold text-gray-700 truncate">{t.holderName}</p>
                    <p className="text-[11px] text-gray-500 truncate">{t.ticketTitle}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 ${
                      t.status === 'VALID'
                        ? 'bg-[#111827] text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
