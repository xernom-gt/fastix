import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { getTodayISO, type ETicket } from '@pariwisloka/shared';
import { useBookings } from '../store/bookingStore';
import {
  loadGateSession,
  loadOfflineQueue,
  saveGateSession,
  saveOfflineQueue,
  type OfflineScanQueueItem,
  type StaffGateAccount,
} from '../utils/operationsStorage';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8080/api/v1';
const GATE_TOKEN_STORAGE_KEY = 'fastix_gate_token_v1';

interface ApiErrorBody {
  error?: { message?: string; code?: string };
  message?: string;
}

interface GateTicketsTodayResponse extends ApiErrorBody {
  data?: ETicket[] | { tickets?: ETicket[] };
}

interface GateRedeemResponse extends ApiErrorBody {
  data?: {
    ticket?: Partial<ETicket>;
    redeemedAt?: string;
    holderName?: string;
    ticketTitle?: string;
    ticketCode?: string;
  };
}

interface GateSyncResponse extends ApiErrorBody {
  data?: {
    syncedCount?: number;
  };
}

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
  const [staff, setStaff] = useState<StaffGateAccount | null>(() => loadGateSession());
  const venueId = staff?.venueId;
  const { tickets, redeemTicket } = useBookings();

  const [offlineQueue, setOfflineQueue] = useState<OfflineScanQueueItem[]>(loadOfflineQueue);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'REDEEMED'>('ALL');
  const [mobileTab, setMobileTab] = useState<'scan' | 'list'>('scan');
  const [searchQuery, setSearchQuery] = useState('');
  const [apiTickets, setApiTickets] = useState<ETicket[] | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const gateToken = localStorage.getItem(GATE_TOKEN_STORAGE_KEY);

  // Camera preview state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const lastScanAtRef = useRef<number>(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [isFullscreenCamera, setIsFullscreenCamera] = useState(false);
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
    setIsFullscreenCamera(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!isFullscreenCamera) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreenCamera(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenCamera]);

  const startCamera = async (openFullscreenOnMobile = false) => {
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
      if (openFullscreenOnMobile && window.innerWidth < 768) {
        setIsFullscreenCamera(true);
      }
    } catch {
      setCameraNotice(
        'Izin kamera ditolak atau kamera tidak tersedia. Gunakan input manual kode PWL-TIX di bawah.',
      );
      setCameraActive(false);
    }
  };

  const openFullscreenScanner = () => {
    setIsFullscreenCamera(true);
    if (!cameraActive) {
      void startCamera(false);
    }
  };

  const switchToManualInput = () => {
    setIsFullscreenCamera(false);
    window.setTimeout(() => {
      manualInputRef.current?.focus();
    }, 50);
  };

  const handleUnauthorized = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    localStorage.removeItem(GATE_TOKEN_STORAGE_KEY);
    saveGateSession(null);
    setStaff(null);
    setApiTickets(null);
    navigate('/gate/login', { replace: true });
  }, [navigate]);

  const fetchTodayTickets = useCallback(async () => {
    if (!gateToken || !venueId) return;
    setIsLoadingTickets(true);
    try {
      const response = await fetch(`${API_BASE_URL}/gate/tickets/today`, {
        headers: { Authorization: `Bearer ${gateToken}` },
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) return;
      const payload = (await response.json().catch(() => ({}))) as GateTicketsTodayResponse;
      const list = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.data?.tickets)
          ? payload.data.tickets
          : null;
      if (list) {
        setApiTickets(list);
      }
    } catch {
      // Keep local/cached tickets when server is unreachable
    } finally {
      setIsLoadingTickets(false);
    }
  }, [gateToken, venueId, handleUnauthorized]);

  useEffect(() => {
    if (!isOfflineMode && gateToken && venueId) {
      void fetchTodayTickets();
    }
  }, [isOfflineMode, gateToken, venueId, fetchTodayTickets]);

  const venueTickets = useMemo(() => {
    if (!staff) return [];
    if (apiTickets) return apiTickets;
    return tickets.filter((t) => t.venueId === staff.venueId);
  }, [apiTickets, tickets, staff]);

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return venueTickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (!query) return true;
      return (
        t.ticketCode.toLowerCase().includes(query) ||
        t.holderName.toLowerCase().includes(query)
      );
    });
  }, [venueTickets, statusFilter, searchQuery]);

  if (!staff || !gateToken) {
    return <Navigate to="/gate/login" replace />;
  }

  const processLocalRedeem = (code: string) => {
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

    if (apiTickets) {
      setApiTickets((prev) =>
        prev
          ? prev.map((t) =>
              t.ticketCode === target.ticketCode
                ? { ...t, status: 'REDEEMED', redeemedAt: nowIso }
                : t,
            )
          : prev,
      );
    }

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
      detail: `${target.holderName} (${target.ticketTitle})`,
      ticketCode: target.ticketCode,
    });
    setManualInput('');
  };

  const processTicketCode = async (raw: string) => {
    const trimmed = raw.trim();
    const code = extractTicketCode(trimmed);
    if (!code) return;

    if (isOfflineMode || !gateToken) {
      processLocalRedeem(code);
      return;
    }

    setIsRedeeming(true);
    try {
      const qrPayload = trimmed.includes('|') ? trimmed : undefined;
      const response = await fetch(`${API_BASE_URL}/gate/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gateToken}`,
        },
        body: JSON.stringify({
          ticketCode: code,
          ...(qrPayload ? { qrPayload } : {}),
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as GateRedeemResponse;

      if (!response.ok) {
        const message =
          payload.error?.message || payload.message || 'Tiket tidak dapat divalidasi.';
        const isDoubleScan =
          response.status === 409 || /redeem|sudah|double/i.test(message);
        setOutcome({
          accepted: false,
          headline: isDoubleScan
            ? 'DITOLAK • Sudah Digunakan (Double-Scan)'
            : 'DITOLAK • Validasi Gagal',
          detail: message,
          ticketCode: code,
        });
        return;
      }

      const ticketData = payload.data?.ticket;
      const redeemedAt =
        payload.data?.redeemedAt ?? ticketData?.redeemedAt ?? new Date().toISOString();
      const matched = venueTickets.find((t) => t.ticketCode.toUpperCase() === code);
      const holderName =
        payload.data?.holderName ?? ticketData?.holderName ?? matched?.holderName ?? 'Pengunjung';
      const ticketTitle =
        payload.data?.ticketTitle ?? ticketData?.ticketTitle ?? matched?.ticketTitle ?? 'E-Ticket';

      redeemTicket(code);
      if (apiTickets) {
        setApiTickets((prev) =>
          prev
            ? prev.map((t) =>
                t.ticketCode.toUpperCase() === code
                  ? { ...t, status: 'REDEEMED', redeemedAt }
                  : t,
              )
            : prev,
        );
      }

      setOutcome({
        accepted: true,
        headline: 'VALID • Check-in Berhasil',
        detail: `${holderName} (${ticketTitle})`,
        ticketCode: code,
      });
      setManualInput('');
    } catch {
      processLocalRedeem(code);
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void processTicketCode(manualInput);
  };

  const processTicketCodeRef = useRef(processTicketCode);
  processTicketCodeRef.current = processTicketCode;

  useEffect(() => {
    if (!cameraActive) return;

    const intervalId = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (decoded?.data) {
        const now = Date.now();
        if (now - lastScanAtRef.current < 2000) return;
        lastScanAtRef.current = now;
        void processTicketCodeRef.current(decoded.data);
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [cameraActive]);

  const handleSyncOfflineQueue = async () => {
    const pendingItems = offlineQueue.filter((q) => !q.synced);
    if (pendingItems.length === 0) return;

    setSyncNotice(null);
    if (!gateToken) {
      const nextQueue = offlineQueue.map((item) => ({ ...item, synced: true }));
      setOfflineQueue(nextQueue);
      saveOfflineQueue(nextQueue);
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/gate/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gateToken}`,
        },
        body: JSON.stringify({
          items: pendingItems.map((item) => ({
            ticketCode: item.ticketCode,
            scannedAt: item.scannedAt,
          })),
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as GateSyncResponse;
      if (!response.ok) {
        setSyncNotice(
          payload.error?.message || payload.message || 'Gagal menyinkronkan antrean ke server.',
        );
        return;
      }

      const nextQueue = offlineQueue.map((item) => ({ ...item, synced: true }));
      setOfflineQueue(nextQueue);
      saveOfflineQueue(nextQueue);
      void fetchTodayTickets();
    } catch {
      setSyncNotice('Server tidak terjangkau. Antrean tetap tersimpan lokal.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    stopCamera();
    localStorage.removeItem(GATE_TOKEN_STORAGE_KEY);
    saveGateSession(null);
    setStaff(null);
    setApiTickets(null);
    navigate('/gate/login', { replace: true });
  };

  const pendingSyncCount = offlineQueue.filter((q) => !q.synced).length;
  const validCount = venueTickets.filter((t) => t.status === 'VALID').length;
  const redeemedCount = venueTickets.filter((t) => t.status === 'REDEEMED').length;

  return (
    <div className="min-h-screen bg-gray-100 text-[#111827] pb-12 overflow-x-hidden">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      {/* Operational Loket Header */}
      <header className="sticky top-0 z-30 bg-[#090D16] text-white border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-white/15 border border-white/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                qr_code_scanner
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold leading-tight truncate">{staff.venueName}</p>
              <p className="text-[11px] text-gray-300 truncate">
                {staff.venueCode} • {staff.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsOfflineMode((prev) => !prev)}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                isOfflineMode
                  ? 'bg-amber-400 text-[#111827] border-amber-300'
                  : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30 hover:bg-emerald-500/30'
              }`}
            >
              {isOfflineMode ? 'Offline' : 'Online'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {/* Ringkasan Harian */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="min-w-0 rounded-xl sm:rounded-2xl bg-white border border-gray-200 px-2.5 py-3 sm:p-4">
            <p className="text-[11px] sm:text-xs font-semibold text-gray-500 leading-tight">
              Total Hari Ini
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-[#111827] mt-1">
              {venueTickets.length}
            </p>
          </div>
          <div className="min-w-0 rounded-xl sm:rounded-2xl bg-white border border-gray-200 px-2.5 py-3 sm:p-4">
            <p className="text-[11px] sm:text-xs font-semibold text-gray-500 leading-tight">
              Belum Check-in
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-[#111827] mt-1">{validCount}</p>
          </div>
          <div className="min-w-0 rounded-xl sm:rounded-2xl bg-white border border-gray-200 px-2.5 py-3 sm:p-4">
            <p className="text-[11px] sm:text-xs font-semibold text-gray-500 leading-tight">
              Sudah Masuk
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-[#111827] mt-1">
              {redeemedCount}
            </p>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div
          role="tablist"
          aria-label="Navigasi area loket"
          className="lg:hidden grid grid-cols-2 gap-1.5 rounded-2xl bg-white border border-gray-200 p-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'scan'}
            onClick={() => setMobileTab('scan')}
            className={`min-h-[44px] px-3 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
              mobileTab === 'scan'
                ? 'bg-[#111827] text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Pindai Tiket
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'list'}
            onClick={() => setMobileTab('list')}
            className={`min-h-[44px] px-3 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
              mobileTab === 'list'
                ? 'bg-[#111827] text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Daftar Tiket ({venueTickets.length})
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Kolom Kiri: Kamera QR + Input Manual + Hasil Validasi */}
          <div
            className={`${mobileTab === 'scan' ? 'block' : 'hidden'} lg:block lg:col-span-7 min-w-0 space-y-4 sm:space-y-5`}
          >
            <section className="rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-base font-extrabold text-[#111827]">
                  Pemindai QR E-Ticket
                </h1>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openFullscreenScanner}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-[#111827] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      fullscreen
                    </span>
                    <span>Layar Penuh</span>
                  </button>
                  {cameraActive ? (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#111827] transition-colors cursor-pointer"
                    >
                      Matikan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startCamera(true)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                        videocam
                      </span>
                      <span>Aktifkan Kamera</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Single camera container switches seamlessly between compact preview and mobile fullscreen */}
              <div
                role={isFullscreenCamera ? 'dialog' : undefined}
                aria-modal={isFullscreenCamera ? true : undefined}
                aria-label={isFullscreenCamera ? 'Pemindai QR Layar Penuh' : undefined}
                className={
                  isFullscreenCamera
                    ? 'fixed inset-0 z-50 bg-[#090D16] text-white flex flex-col justify-between p-4 sm:p-6'
                    : 'relative w-full h-48 sm:h-56 rounded-xl sm:rounded-2xl bg-[#090D16] overflow-hidden flex items-center justify-center'
                }
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={
                    isFullscreenCamera
                      ? `absolute inset-0 w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`
                      : `w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`
                  }
                />

                {isFullscreenCamera && (
                  <div className="relative z-10 flex items-center justify-between gap-3 bg-black/70 backdrop-blur-md border border-white/15 rounded-2xl px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-white truncate">
                        {staff.venueName}
                      </p>
                      <p className="text-[11px] text-gray-200 truncate">
                        {isOfflineMode ? 'Mode Offline' : 'Mode Online'} • {staff.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFullscreenCamera(false)}
                      aria-label="Tutup mode kamera layar penuh"
                      className="min-h-[44px] px-4 rounded-xl bg-white text-[#111827] hover:bg-gray-100 text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        close
                      </span>
                      <span>Tutup</span>
                    </button>
                  </div>
                )}

                {isFullscreenCamera ? (
                  <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
                    <div className="relative w-60 h-60 sm:w-72 sm:h-72 flex items-center justify-center">
                      <span
                        aria-hidden="true"
                        className="absolute top-0 left-0 w-9 h-9 border-t-4 border-l-4 border-white rounded-tl-xl"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute top-0 right-0 w-9 h-9 border-t-4 border-r-4 border-white rounded-tr-xl"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 left-0 w-9 h-9 border-b-4 border-l-4 border-white rounded-bl-xl"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 right-0 w-9 h-9 border-b-4 border-r-4 border-white rounded-br-xl"
                      />
                      {!cameraActive && (
                        <div className="text-center px-4 space-y-2 text-gray-300">
                          <span
                            className="material-symbols-outlined text-[40px] text-white/80"
                            aria-hidden="true"
                          >
                            qr_code_scanner
                          </span>
                          <p className="text-xs font-medium">
                            {cameraNotice ?? 'Menyiapkan akses kamera perangkat...'}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="mt-5 text-xs font-semibold text-white text-center bg-black/65 backdrop-blur-sm px-3.5 py-1.5 rounded-full">
                      Arahkan QR e-ticket pengunjung ke dalam kotak bidik
                    </p>
                  </div>
                ) : (
                  <>
                    {!cameraActive && (
                      <div className="flex items-center gap-3 px-4 text-gray-300">
                        <span
                          className="material-symbols-outlined text-[28px] text-white/75 shrink-0"
                          aria-hidden="true"
                        >
                          qr_code_2
                        </span>
                        <p className="text-xs leading-snug">
                          Aktifkan kamera untuk pindai QR, atau masukkan kode tiket di bawah.
                        </p>
                      </div>
                    )}
                    {cameraActive && (
                      <div
                        aria-hidden="true"
                        className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-2 border-white/85 pointer-events-none"
                      />
                    )}
                  </>
                )}

                {isFullscreenCamera && (
                  <div className="relative z-10 space-y-3">
                    {outcome && (
                      <div
                        role="status"
                        className={`rounded-2xl p-3.5 space-y-1 shadow-lg ${
                          outcome.accepted
                            ? 'bg-emerald-700 text-white'
                            : 'bg-red-700 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                            {outcome.accepted ? 'check_circle' : 'cancel'}
                          </span>
                          <p className="text-xs font-extrabold">{outcome.headline}</p>
                        </div>
                        <p className="text-xs text-white/90">{outcome.detail}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 bg-black/70 backdrop-blur-md border border-white/15 rounded-2xl p-3">
                      <button
                        type="button"
                        onClick={switchToManualInput}
                        className="flex-1 min-h-[44px] px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Input Kode Manual
                      </button>
                      {cameraActive && (
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="min-h-[44px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          Matikan Kamera
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {cameraNotice && (
                <div className="rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-700">
                  {cameraNotice}
                </div>
              )}

              {/* Input Manual Fallback (One-handed mobile friendly) */}
              <form onSubmit={handleManualSubmit} className="space-y-2 pt-0.5">
                <label
                  htmlFor="gate-manual-code"
                  className="block text-xs font-bold text-[#111827]"
                >
                  Input / Paste Kode Tiket Manual
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    ref={manualInputRef}
                    id="gate-manual-code"
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="PWL-TIX-9A8B7C6D"
                    className="w-full sm:flex-1 min-h-[48px] h-12 px-4 rounded-xl border border-gray-300 font-mono text-base text-[#111827] focus:border-[#111827] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isRedeeming}
                    className="h-12 px-6 rounded-xl bg-[#111827] hover:bg-black disabled:opacity-60 text-white text-sm font-extrabold whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isRedeeming ? 'Memvalidasi...' : 'Validasi Tiket'}
                  </button>
                </div>
              </form>

              {outcome && (
                <div
                  role="status"
                  className={`rounded-2xl p-4 space-y-1.5 shadow-sm ${
                    outcome.accepted
                      ? 'bg-emerald-700 text-white'
                      : 'bg-red-700 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      {outcome.accepted ? 'check_circle' : 'cancel'}
                    </span>
                    <p className="text-sm font-extrabold">{outcome.headline}</p>
                  </div>
                  <p className="text-xs font-medium text-white/90">{outcome.detail}</p>
                  <p className="text-[11px] font-mono text-white/75">{outcome.ticketCode}</p>
                </div>
              )}
            </section>

            {/* Panel Antrean Offline Sync: 1 baris ringkas saat 0 tertunda */}
            {pendingSyncCount === 0 ? (
              <section className="rounded-xl bg-white border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-bold text-[#111827] truncate">
                    Antrean Offline Sync: 0 tertunda
                  </p>
                </div>
                {offlineQueue.length > 0 && (
                  <span className="text-[11px] font-semibold text-gray-500 shrink-0">
                    {offlineQueue.length} tersinkron
                  </span>
                )}
              </section>
            ) : (
              <section className="rounded-2xl bg-white border border-amber-300 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#111827]">
                      Antrean Offline Sync ({pendingSyncCount} tertunda)
                    </h2>
                    <p className="text-xs text-gray-500">
                      Data check-in offline siap disinkronkan ke server.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => void handleSyncOfflineQueue()}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#111827] hover:bg-black disabled:opacity-60 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}
                  </button>
                </div>

                {syncNotice && (
                  <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {syncNotice}
                  </p>
                )}

                <div className="divide-y divide-gray-100">
                  {offlineQueue.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
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
              </section>
            )}
          </div>

          {/* Kolom Kanan: Daftar Tiket Harian */}
          <section
            className={`${mobileTab === 'list' ? 'block' : 'hidden'} lg:block lg:col-span-5 min-w-0 rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 space-y-3.5 h-fit`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#111827]">Daftar Tiket Hari Ini</h2>
              {isLoadingTickets && (
                <span className="text-[11px] font-semibold text-gray-500">Memuat...</span>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="relative">
                <span
                  className="material-symbols-outlined text-[18px] text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                >
                  search
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kode PWL-TIX atau nama pengunjung..."
                  aria-label="Cari kode tiket atau nama pengunjung"
                  className="w-full min-h-[44px] pl-9 pr-3.5 rounded-xl border border-gray-300 text-xs sm:text-sm text-[#111827] placeholder:text-gray-500 focus:border-[#111827] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(['ALL', 'VALID', 'REDEEMED'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === tab
                        ? 'bg-[#111827] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tab === 'ALL' ? 'Semua' : tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {filteredTickets.length === 0 ? (
                <p className="py-6 text-center text-xs font-medium text-gray-500">
                  {venueTickets.length === 0
                    ? 'Belum ada tiket untuk hari ini.'
                    : 'Tidak ada tiket yang sesuai pencarian atau filter.'}
                </p>
              ) : (
                filteredTickets.map((t) => (
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
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
