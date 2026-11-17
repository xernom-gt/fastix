import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { formatRupiah, getTodayISO, type Destinasi, type TicketProduct } from '@pariwisloka/shared';
import { parseOwnerTab, type OwnerTab } from '../components/OwnerLayout';
import { useAuth } from '../store/authStore';
import { useBookings } from '../store/bookingStore';
import {
  DISBURSEMENT_BANK_ADMIN_FEE,
  getVerifiedBankAccount,
  loadBalanceMutations,
  loadPayoutHistory,
  loadStaffAccounts,
  MIN_PAYOUT_AMOUNT,
  saveBalanceMutations,
  savePayoutHistory,
  saveStaffAccounts,
  type BalanceMutation,
  type BalanceMutationType,
  type PayoutRecord,
  type PayoutStatus,
  type StaffGateAccount,
} from '../utils/operationsStorage';

function generateSixDigitPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getVenueTimezone(venue: Destinasi): 'WIB' | 'WITA' {
  if (venue.kotaKode === 'bali' || /bali/i.test(venue.lokasi)) {
    return 'WITA';
  }
  return 'WIB';
}

function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const MUTATION_META: Record<BalanceMutationType, { label: string; badgeClass: string }> = {
  PAYIN_INFLOW: { label: 'Masuk Penjualan', badgeClass: 'bg-gray-100 text-gray-800' },
  HOLDING_RELEASED: { label: 'Rilis Escrow H+1', badgeClass: 'bg-emerald-50 text-emerald-800' },
  PAYOUT_WITHDRAW: { label: 'Penarikan Dana', badgeClass: 'bg-amber-50 text-amber-800' },
  PAYOUT_REFUND: { label: 'Pengembalian Gagal', badgeClass: 'bg-blue-50 text-blue-800' },
};

const PAYOUT_STATUS_META: Record<PayoutStatus, { label: string; badgeClass: string }> = {
  PROCESSING: { label: 'Diproses', badgeClass: 'bg-amber-50 text-amber-800' },
  COMPLETED: { label: 'Selesai', badgeClass: 'bg-emerald-50 text-emerald-800' },
  FAILED: { label: 'Gagal', badgeClass: 'bg-red-50 text-red-700' },
};

const TAB_HEADINGS: Record<OwnerTab, string> = {
  tickets: 'Kelola Tiket & Kuota Harian',
  finance: 'Keuangan, Escrow H+1 & Payout',
  profile: 'Profil Destinasi Wisata',
  staff: 'Akun & PIN Staff Gate',
  overview: 'Ringkasan Kuota Hari Ini',
};

export default function MitraDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const { venues, updateVenues, getExtraUsedQuota, transactions } = useBookings();
  const [staffs, setStaffs] = useState<StaffGateAccount[]>(loadStaffAccounts);
  const [mutations, setMutations] = useState<BalanceMutation[]>(loadBalanceMutations);
  const [payouts, setPayouts] = useState<PayoutRecord[]>(loadPayoutHistory);

  const ownedVenues = useMemo(
    () => venues.filter((v) => user?.ownedVenueIds?.includes(v.id)),
    [venues, user?.ownedVenueIds],
  );

  const [searchParams] = useSearchParams();
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const activeTab = parseOwnerTab(searchParams.get('tab'));

  // Ticket edit & create state
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editQuota, setEditQuota] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newQuota, setNewQuota] = useState('');
  const [ticketFeedback, setTicketFeedback] = useState<string | null>(null);

  // Staff create & PIN state
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [staffFeedback, setStaffFeedback] = useState<string | null>(null);

  // Finance & payout state
  const [payoutAmountInput, setPayoutAmountInput] = useState('');
  const [payoutFeedback, setPayoutFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Destination profile edit state
  const [profileName, setProfileName] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileHours, setProfileHours] = useState('');
  const [profileDesc, setProfileDesc] = useState('');
  const [profileFacilities, setProfileFacilities] = useState<string[]>([]);
  const [newFacility, setNewFacility] = useState('');
  const [profileFeedback, setProfileFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const activeVenue = useMemo(
    () => ownedVenues.find((v) => v.id === selectedVenueId) ?? ownedVenues[0],
    [ownedVenues, selectedVenueId],
  );

  useEffect(() => {
    if (!activeVenue) return;
    setProfileName(activeVenue.nama);
    setProfileAddress(activeVenue.alamat);
    setProfileHours(activeVenue.jamBuka);
    setProfileDesc(activeVenue.deskripsi);
    setProfileFacilities(activeVenue.fasilitas);
    setNewFacility('');
    setProfileFeedback(null);
    setPayoutFeedback(null);
  }, [activeVenue?.id]);

  const today = getTodayISO();

  const venueStaffs = useMemo(
    () => staffs.filter((s) => s.venueId === activeVenue?.id),
    [staffs, activeVenue],
  );

  const financeSummary = useMemo(() => {
    if (!activeVenue) {
      return {
        grossRevenue: 0,
        platformFee: 0,
        pendingBalance: 0,
        availableBalance: 0,
        ledgerRows: [] as BalanceMutation[],
      };
    }

    const venueMutations = mutations.filter((m) => m.venueId === activeVenue.id);
    const livePaidTxs = transactions.filter(
      (tx) => tx.venueId === activeVenue.id && tx.paymentStatus === 'PAID',
    );

    let grossRevenue = 0;
    let platformFee = 0;
    let pendingBalance = 0;
    let availableBalance = 0;

    for (const mut of venueMutations) {
      if (mut.type === 'PAYIN_INFLOW') {
        grossRevenue += mut.grossAmount ?? mut.amount;
        platformFee += mut.platformFee ?? 0;
        pendingBalance += mut.amount;
      } else if (mut.type === 'HOLDING_RELEASED') {
        grossRevenue += mut.grossAmount ?? mut.amount;
        platformFee += mut.platformFee ?? 0;
        availableBalance += mut.amount;
      } else if (mut.type === 'PAYOUT_WITHDRAW' || mut.type === 'PAYOUT_REFUND') {
        availableBalance += mut.amount;
      }
    }

    const liveMutations: BalanceMutation[] = livePaidTxs.map((tx) => {
      const netRevenueOwner = Math.max(0, tx.totalAmount - tx.platformFee);
      grossRevenue += tx.totalAmount;
      platformFee += tx.platformFee;
      const bookingDate = tx.bookingDate || tx.items[0]?.bookingDate || today;
      const isReleased = bookingDate < today;
      if (isReleased) {
        availableBalance += netRevenueOwner;
      } else {
        pendingBalance += netRevenueOwner;
      }

      return {
        id: `live_${tx.id}`,
        venueId: tx.venueId,
        type: isReleased ? 'HOLDING_RELEASED' : 'PAYIN_INFLOW',
        amount: netRevenueOwner,
        grossAmount: tx.totalAmount,
        platformFee: tx.platformFee,
        description: `Transaksi ${tx.invoiceNumber} (${tx.items[0]?.ticketTitle ?? 'Tiket'})`,
        createdAt: tx.paidAt ?? tx.createdAt,
      };
    });

    const ledgerRows = [...liveMutations, ...venueMutations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      grossRevenue,
      platformFee,
      pendingBalance: Math.max(0, pendingBalance),
      availableBalance: Math.max(0, availableBalance),
      ledgerRows,
    };
  }, [activeVenue, mutations, transactions, today]);

  const venuePayouts = useMemo(
    () =>
      payouts
        .filter((p) => p.venueId === activeVenue?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [payouts, activeVenue?.id],
  );

  const updateStaffs = (next: StaffGateAccount[]) => {
    setStaffs(next);
    saveStaffAccounts(next);
  };

  if (!isAuthenticated || user?.role !== 'OWNER') {
    return <Navigate to="/login?redirect=/mitra" replace />;
  }

  const startEditTicket = (ticket: TicketProduct) => {
    setEditingTicketId(ticket.id);
    setEditPrice(String(ticket.price));
    setEditQuota(String(ticket.dailyQuota));
    setTicketFeedback(null);
  };

  const handleSaveTicketEdit = (ticketId: string) => {
    const parsedPrice = Number(editPrice);
    const parsedQuota = Number(editQuota);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isFinite(parsedQuota) || parsedQuota < 1) {
      setTicketFeedback('Harga dan kuota harian harus berupa angka valid (kuota minimal 1).');
      return;
    }

    const next = venues.map((v) => {
      if (v.id !== activeVenue?.id) return v;
      const updatedTickets = v.tickets.map((t) =>
        t.id === ticketId
          ? { ...t, price: Math.round(parsedPrice), dailyQuota: Math.round(parsedQuota) }
          : t,
      );
      const minPrice = updatedTickets.reduce((min, t) => Math.min(min, t.price), updatedTickets[0]?.price ?? v.hargaMulai);
      return { ...v, tickets: updatedTickets, hargaMulai: minPrice };
    });

    updateVenues(next);
    setEditingTicketId(null);
    setTicketFeedback('Harga dan kuota tiket berhasil diperbarui.');
  };

  const handleAddTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVenue) return;

    const parsedPrice = Number(newPrice);
    const parsedQuota = Number(newQuota);
    if (!newTitle.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isFinite(parsedQuota) || parsedQuota < 1) {
      setTicketFeedback('Lengkapi nama tiket, harga, dan kuota harian minimal 1.');
      return;
    }

    const created: TicketProduct = {
      id: `tix_${Date.now()}`,
      venueId: activeVenue.id,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Akses kunjungan harian destinasi wisata.',
      price: Math.round(parsedPrice),
      dailyQuota: Math.round(parsedQuota),
      usedQuotaPaid: 0,
      usedQuotaPending: 0,
    };

    const next = venues.map((v) => {
      if (v.id !== activeVenue.id) return v;
      const updatedTickets = [...v.tickets, created];
      const minPrice = Math.min(v.hargaMulai, created.price);
      return { ...v, tickets: updatedTickets, hargaMulai: minPrice };
    });

    updateVenues(next);
    setNewTitle('');
    setNewDesc('');
    setNewPrice('');
    setNewQuota('');
    setTicketFeedback(`Tiket "${created.title}" berhasil ditambahkan.`);
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVenue) return;

    const cleanPin = staffPin.trim();
    if (!staffName.trim() || !/^\d{6}$/.test(cleanPin)) {
      setStaffFeedback('Nama petugas wajib diisi dan PIN harus tepat 6 digit angka.');
      return;
    }

    const created: StaffGateAccount = {
      id: `stf_${Date.now()}`,
      name: staffName.trim(),
      venueId: activeVenue.id,
      venueCode: activeVenue.venueCode,
      venueName: activeVenue.nama,
      pin: cleanPin,
      isActive: true,
    };

    updateStaffs([...staffs, created]);
    setStaffName('');
    setStaffPin('');
    setStaffFeedback(`Akun Staff Gate untuk ${created.name} berhasil dibuat.`);
  };

  const handleResetPin = (staffId: string) => {
    const freshPin = generateSixDigitPin();
    updateStaffs(staffs.map((s) => (s.id === staffId ? { ...s, pin: freshPin } : s)));
    setRevealedPins((prev) => ({ ...prev, [staffId]: true }));
    setStaffFeedback(`PIN baru (${freshPin}) telah dibuat. Bagikan ke petugas gate.`);
  };

  const handleToggleStaffActive = (staffId: string) => {
    updateStaffs(staffs.map((s) => (s.id === staffId ? { ...s, isActive: !s.isActive } : s)));
  };

  if (!activeVenue) {
    return null;
  }

  const kybBank = getVerifiedBankAccount(activeVenue.id);
  const parsedPayoutAmount = Number(payoutAmountInput);
  const isPayoutAmountValid =
    Number.isFinite(parsedPayoutAmount) &&
    parsedPayoutAmount >= MIN_PAYOUT_AMOUNT &&
    parsedPayoutAmount <= financeSummary.availableBalance;
  const netPayoutPreview = isPayoutAmountValid
    ? Math.max(0, Math.round(parsedPayoutAmount) - DISBURSEMENT_BANK_ADMIN_FEE)
    : 0;

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.round(Number(payoutAmountInput));
    if (!Number.isFinite(amount) || amount < MIN_PAYOUT_AMOUNT) {
      setPayoutFeedback({
        type: 'error',
        message: `Nominal penarikan minimal ${formatRupiah(MIN_PAYOUT_AMOUNT)}.`,
      });
      return;
    }
    if (amount > financeSummary.availableBalance) {
      setPayoutFeedback({
        type: 'error',
        message: 'Nominal penarikan melebihi Saldo Siap Tarik.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const newMutation: BalanceMutation = {
      id: `mut_${Date.now()}`,
      venueId: activeVenue.id,
      type: 'PAYOUT_WITHDRAW',
      amount: -amount,
      description: `Penarikan dana ke ${kybBank.bankName} ****${kybBank.accountNumber.slice(-4)}`,
      createdAt: nowIso,
    };
    const newPayout: PayoutRecord = {
      id: `pay_${Date.now()}`,
      venueId: activeVenue.id,
      amountRequested: amount,
      bankAdminFee: DISBURSEMENT_BANK_ADMIN_FEE,
      netReceived: amount - DISBURSEMENT_BANK_ADMIN_FEE,
      bankName: kybBank.bankName,
      accountNumber: kybBank.accountNumber,
      accountHolder: kybBank.accountHolder,
      status: 'PROCESSING',
      createdAt: nowIso,
    };

    const nextMutations = [newMutation, ...mutations];
    const nextPayouts = [newPayout, ...payouts];
    setMutations(nextMutations);
    setPayouts(nextPayouts);
    saveBalanceMutations(nextMutations);
    savePayoutHistory(nextPayouts);
    setPayoutAmountInput('');
    setPayoutFeedback({
      type: 'success',
      message: `Pengajuan tarik dana ${formatRupiah(amount)} diproses. Dana bersih ${formatRupiah(newPayout.netReceived)} dikirim ke rekening KYB.`,
    });
  };

  const handleAddFacility = () => {
    const trimmed = newFacility.trim();
    if (!trimmed) return;
    if (profileFacilities.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      setNewFacility('');
      return;
    }
    setProfileFacilities([...profileFacilities, trimmed]);
    setNewFacility('');
  };

  const handleRemoveFacility = (facilityToRemove: string) => {
    setProfileFacilities(profileFacilities.filter((f) => f !== facilityToRemove));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim() || !profileAddress.trim() || !profileHours.trim() || !profileDesc.trim()) {
      setProfileFeedback({
        type: 'error',
        message: 'Nama destinasi, alamat, jam operasional, dan deskripsi wajib diisi.',
      });
      return;
    }

    const next = venues.map((v) =>
      v.id === activeVenue.id
        ? {
            ...v,
            nama: profileName.trim(),
            alamat: profileAddress.trim(),
            jamBuka: profileHours.trim(),
            deskripsi: profileDesc.trim(),
            fasilitas: profileFacilities,
          }
        : v,
    );

    updateVenues(next);
    setProfileFeedback({
      type: 'success',
      message: 'Profil destinasi berhasil disimpan dan langsung sinkron ke katalog wisatawan.',
    });
  };

  const venueTimezone = getVenueTimezone(activeVenue);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-12 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500">Workspace Pengelola Destinasi</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">
            {TAB_HEADINGS[activeTab]}
          </h1>
        </div>

        <select
          aria-label="Pilih destinasi milik mitra"
          value={activeVenue.id}
          onChange={(e) => {
            setSelectedVenueId(e.target.value);
            setEditingTicketId(null);
            setTicketFeedback(null);
            setStaffFeedback(null);
          }}
          className="h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-[#111827] focus:border-[#111827] focus:outline-none"
        >
          {ownedVenues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.venueCode} • {v.nama}
            </option>
          ))}
        </select>
      </div>

      {/* Ringkasan Destinasi Aktif */}
      <div className="rounded-2xl bg-[#111827] text-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold tracking-wide">
            {activeVenue.venueCode}
          </span>
          <h2 className="text-lg font-extrabold">{activeVenue.nama}</h2>
          <p className="text-xs text-gray-300">{activeVenue.lokasi}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
          <div className="rounded-xl bg-white/10 px-4 py-2.5">
            <p className="text-[11px] text-gray-300">Jenis Tiket</p>
            <p className="text-base font-extrabold">{activeVenue.tickets.length}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-2.5">
            <p className="text-[11px] text-gray-300">Staff Gate Aktif</p>
            <p className="text-base font-extrabold">
              {venueStaffs.filter((s) => s.isActive).length}
            </p>
          </div>
        </div>
      </div>

      {activeTab === 'finance' ? (
        <div className="space-y-6">
          {/* Ringkasan Saldo & Escrow H+1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-1">
              <p className="text-[11px] font-semibold text-gray-500">Omzet Kotor</p>
              <p className="text-base sm:text-lg font-extrabold text-[#111827] tabular-nums">
                {formatRupiah(financeSummary.grossRevenue)}
              </p>
              <p className="text-[11px] text-gray-500">Total penjualan QRIS</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-1">
              <p className="text-[11px] font-semibold text-gray-500">Platform Fee</p>
              <p className="text-base sm:text-lg font-extrabold text-[#111827] tabular-nums">
                {formatRupiah(financeSummary.platformFee)}
              </p>
              <p className="text-[11px] text-gray-500">Potongan layanan per tiket</p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-1">
              <p className="text-[11px] font-semibold text-amber-800">Saldo Tertahan (H+1)</p>
              <p className="text-base sm:text-lg font-extrabold text-[#111827] tabular-nums">
                {formatRupiah(financeSummary.pendingBalance)}
              </p>
              <p className="text-[11px] text-amber-800">Rilis H+1 pukul 23:59 WIB</p>
            </div>

            <div className="rounded-2xl border border-[#111827] bg-[#111827] text-white p-4 space-y-1">
              <p className="text-[11px] font-semibold text-gray-300">Saldo Siap Tarik</p>
              <p className="text-base sm:text-lg font-extrabold tabular-nums">
                {formatRupiah(financeSummary.availableBalance)}
              </p>
              <p className="text-[11px] text-gray-300">Siap cair ke rekening KYB</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Buku Mutasi & Riwayat Payout */}
            <div className="lg:col-span-2 space-y-6">
              <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-[#111827]">Buku Mutasi Saldo</h3>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {financeSummary.ledgerRows.length} catatan
                  </span>
                </div>

                {financeSummary.ledgerRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500">
                    Belum ada mutasi saldo untuk destinasi ini.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {financeSummary.ledgerRows.map((row) => {
                      const meta = MUTATION_META[row.type];
                      const isPositive = row.amount >= 0;
                      return (
                        <div
                          key={row.id}
                          className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                {formatShortDateTime(row.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-[#111827] truncate">
                              {row.description}
                            </p>
                          </div>

                          <span
                            className={`text-xs sm:text-sm font-extrabold tabular-nums whitespace-nowrap ${
                              isPositive ? 'text-emerald-700' : 'text-[#111827]'
                            }`}
                          >
                            {isPositive ? `+${formatRupiah(row.amount)}` : formatRupiah(row.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-[#111827]">Riwayat Penarikan Dana</h3>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {venuePayouts.length} pengajuan
                  </span>
                </div>

                {venuePayouts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500">
                    Belum ada riwayat penarikan dana. Ajukan dari formulir di samping.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {venuePayouts.map((item) => {
                      const statusMeta = PAYOUT_STATUS_META[item.status];
                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusMeta.badgeClass}`}
                              >
                                {statusMeta.label}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                {formatShortDateTime(item.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-[#111827]">
                              {item.bankName} • {item.accountNumber} ({item.accountHolder})
                            </p>
                            <p className="text-[11px] text-gray-500">
                              Diajukan {formatRupiah(item.amountRequested)} • Admin bank{' '}
                              {formatRupiah(item.bankAdminFee)}
                            </p>
                          </div>

                          <div className="sm:text-right shrink-0">
                            <p className="text-[11px] text-gray-500">Dana Diterima</p>
                            <p className="text-sm font-extrabold text-[#111827] tabular-nums">
                              {formatRupiah(item.netReceived)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Form Tarik Dana */}
            <form
              onSubmit={handleRequestPayout}
              className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 h-fit"
            >
              <h3 className="text-sm font-extrabold text-[#111827]">Ajukan Tarik Dana</h3>

              {payoutFeedback && (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                    payoutFeedback.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {payoutFeedback.message}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-gray-600">
                    Rekening Terverifikasi KYB
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-600">
                    <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                      lock
                    </span>
                    Terkunci
                  </span>
                </div>
                <p className="text-xs font-extrabold text-[#111827]">{kybBank.bankName}</p>
                <p className="font-mono text-xs font-bold text-[#111827]">{kybBank.accountNumber}</p>
                <p className="text-[11px] text-gray-600">a.n. {kybBank.accountHolder}</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="mitra-payout-amount" className="block text-xs font-semibold text-gray-700">
                    Nominal Penarikan (Rp)
                  </label>
                  {financeSummary.availableBalance >= MIN_PAYOUT_AMOUNT && (
                    <button
                      type="button"
                      onClick={() => setPayoutAmountInput(String(financeSummary.availableBalance))}
                      className="text-[11px] font-bold text-[#111827] underline hover:no-underline"
                    >
                      Tarik Semua
                    </button>
                  )}
                </div>
                <input
                  id="mitra-payout-amount"
                  type="number"
                  min={MIN_PAYOUT_AMOUNT}
                  max={financeSummary.availableBalance}
                  value={payoutAmountInput}
                  onChange={(e) => {
                    setPayoutAmountInput(e.target.value);
                    setPayoutFeedback(null);
                  }}
                  placeholder={String(MIN_PAYOUT_AMOUNT)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-300 text-xs font-semibold text-[#111827] focus:border-[#111827] focus:outline-none"
                />
                <p className="text-[11px] text-gray-500">
                  Minimum penarikan {formatRupiah(MIN_PAYOUT_AMOUNT)}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Nominal Penarikan</span>
                  <span className="font-semibold text-[#111827] tabular-nums">
                    {isPayoutAmountValid ? formatRupiah(Math.round(parsedPayoutAmount)) : 'Rp 0'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Biaya Admin Bank</span>
                  <span className="font-semibold text-[#111827] tabular-nums">
                    -{formatRupiah(DISBURSEMENT_BANK_ADMIN_FEE)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="font-bold text-[#111827]">Dana Diterima Bersih</span>
                  <span className="text-sm font-extrabold text-[#111827] tabular-nums">
                    {formatRupiah(netPayoutPreview)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={financeSummary.availableBalance < MIN_PAYOUT_AMOUNT}
                className="w-full min-h-[44px] h-11 rounded-xl bg-[#111827] hover:bg-black disabled:bg-gray-300 disabled:text-gray-500 text-white text-xs font-bold transition-colors"
              >
                Ajukan Penarikan Dana
              </button>
            </form>
          </div>
        </div>
      ) : activeTab === 'profile' ? (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-extrabold text-[#111827]">Informasi Publik Destinasi</h3>
              <p className="text-xs text-gray-500">
                Perubahan langsung tersimpan dan tampil pada halaman detail destinasi wisatawan.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-[11px] font-bold text-[#111827] w-fit">
              Kode: {activeVenue.venueCode}
            </span>
          </div>

          {profileFeedback && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs font-semibold ${
                profileFeedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {profileFeedback.message}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="mitra-profile-name" className="block text-xs font-semibold text-gray-700">
                Nama Destinasi
              </label>
              <input
                id="mitra-profile-name"
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-xs font-semibold text-[#111827] focus:border-[#111827] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="mitra-profile-hours" className="block text-xs font-semibold text-gray-700">
                Jam Operasional
              </label>
              <input
                id="mitra-profile-hours"
                type="text"
                value={profileHours}
                onChange={(e) => setProfileHours(e.target.value)}
                placeholder={`06.00 - 18.00 ${venueTimezone}`}
                required
                className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-xs font-semibold text-[#111827] focus:border-[#111827] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="mitra-profile-address" className="block text-xs font-semibold text-gray-700">
              Alamat Lengkap
            </label>
            <input
              id="mitra-profile-address"
              type="text"
              value={profileAddress}
              onChange={(e) => setProfileAddress(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-xs text-[#111827] focus:border-[#111827] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="mitra-profile-desc" className="block text-xs font-semibold text-gray-700">
              Deskripsi Destinasi
            </label>
            <textarea
              id="mitra-profile-desc"
              rows={3}
              value={profileDesc}
              onChange={(e) => setProfileDesc(e.target.value)}
              required
              className="w-full p-3.5 rounded-xl border border-gray-300 text-xs text-[#111827] focus:border-[#111827] focus:outline-none"
            />
          </div>

          <div className="space-y-2.5">
            <label htmlFor="mitra-profile-facility" className="block text-xs font-semibold text-gray-700">
              Fasilitas Tersedia
            </label>

            <div className="flex flex-wrap gap-2">
              {profileFacilities.map((facility) => (
                <span
                  key={facility}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs font-semibold text-[#111827]"
                >
                  <span>{facility}</span>
                  <button
                    type="button"
                    aria-label={`Hapus fasilitas ${facility}`}
                    onClick={() => handleRemoveFacility(facility)}
                    className="text-gray-500 hover:text-[#111827]"
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      close
                    </span>
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 max-w-md">
              <input
                id="mitra-profile-facility"
                type="text"
                value={newFacility}
                onChange={(e) => setNewFacility(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFacility();
                  }
                }}
                placeholder="Tambah fasilitas (mis. Mushola)"
                className="flex-1 h-10 px-3 rounded-xl border border-gray-300 text-xs text-[#111827] focus:border-[#111827] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddFacility}
                className="px-4 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-xs font-bold text-[#111827] transition-colors"
              >
                Tambah
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-6 h-11 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-colors"
            >
              Simpan Profil Destinasi
            </button>
          </div>
        </form>
      ) : activeTab === 'overview' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeVenue.tickets.map((ticket) => {
              const usedTotal =
                ticket.usedQuotaPaid +
                ticket.usedQuotaPending +
                getExtraUsedQuota(ticket.id, today);
              const remaining = Math.max(0, ticket.dailyQuota - usedTotal);
              const ratio = Math.min(100, Math.round((usedTotal / Math.max(1, ticket.dailyQuota)) * 100));

              return (
                <div
                  key={ticket.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#111827]">{ticket.title}</h3>
                      <p className="text-xs text-gray-500">{formatRupiah(ticket.price)}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 text-[11px] font-extrabold text-[#111827]">
                      Sisa {remaining}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-[#111827] rounded-full transition-all"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Terpakai: {usedTotal} tiket</span>
                    <span>Kuota harian: {ticket.dailyQuota}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'tickets' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daftar Tiket */}
          <div className="lg:col-span-2 space-y-3">
            {ticketFeedback && (
              <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-xs font-semibold text-[#111827]">
                {ticketFeedback}
              </div>
            )}

            {activeVenue.tickets.map((ticket) => {
              const usedTotal =
                ticket.usedQuotaPaid +
                ticket.usedQuotaPending +
                getExtraUsedQuota(ticket.id, today);
              const remaining = Math.max(0, ticket.dailyQuota - usedTotal);
              const occupancyPercent = Math.min(
                100,
                Math.round((usedTotal / Math.max(1, ticket.dailyQuota)) * 100),
              );
              const isEditing = editingTicketId === ticket.id;

              return (
                <div
                  key={ticket.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-extrabold text-[#111827]">
                        {ticket.title}
                      </h3>
                      <p className="text-xs text-gray-500">{ticket.description}</p>
                    </div>
                    <span className="text-sm font-extrabold text-[#111827] whitespace-nowrap">
                      {formatRupiah(ticket.price)}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-gray-100 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-3 text-gray-600">
                        <span>
                          Kuota Harian: <strong className="text-[#111827]">{ticket.dailyQuota}</strong>
                        </span>
                        <span>
                          Terpakai:{' '}
                          <strong className="text-[#111827]">{usedTotal}</strong>
                        </span>
                        <span>
                          Sisa: <strong className="text-[#111827]">{remaining}</strong>
                        </span>
                      </div>

                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEditTicket(ticket)}
                          className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-[#111827] text-[#111827] hover:text-white border border-gray-300 hover:border-[#111827] text-xs font-bold transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                            edit
                          </span>
                          <span>Ubah Harga / Kuota</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div
                        role="progressbar"
                        aria-label={`Okupansi kuota ${ticket.title}`}
                        aria-valuenow={occupancyPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden"
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            occupancyPercent >= 85 ? 'bg-amber-600' : 'bg-[#111827]'
                          }`}
                          style={{ width: `${occupancyPercent}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-medium text-gray-500">
                        Okupansi hari ini: {occupancyPercent}% ({usedTotal}/{ticket.dailyQuota} tiket)
                      </p>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label
                            htmlFor={`edit-price-${ticket.id}`}
                            className="block text-[11px] font-bold text-gray-600"
                          >
                            Harga (Rp)
                          </label>
                          <input
                            id={`edit-price-${ticket.id}`}
                            type="number"
                            min={0}
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-[#111827] focus:border-[#111827] focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor={`edit-quota-${ticket.id}`}
                            className="block text-[11px] font-bold text-gray-600"
                          >
                            Kuota Harian
                          </label>
                          <input
                            id={`edit-quota-${ticket.id}`}
                            type="number"
                            min={1}
                            value={editQuota}
                            onChange={(e) => setEditQuota(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-[#111827] focus:border-[#111827] focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveTicketEdit(ticket.id)}
                          className="px-4 py-2 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-colors"
                        >
                          Simpan Perubahan
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTicketId(null)}
                          className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Form Tambah Tiket Baru */}
          <form
            onSubmit={handleAddTicket}
            className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-extrabold text-[#111827]">Tambah Jenis Tiket</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="mitra-tix-title" className="block text-xs font-semibold text-gray-700">
                  Nama Tiket
                </label>
                <input
                  id="mitra-tix-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Tiket Sunrise Pelataran"
                  required
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs text-[#111827] focus:border-[#111827] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="mitra-tix-desc" className="block text-xs font-semibold text-gray-700">
                  Deskripsi Singkat
                </label>
                <input
                  id="mitra-tix-desc"
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={`Akses pagi pukul 05.30 - 08.00 ${venueTimezone}`}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs text-[#111827] focus:border-[#111827] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="mitra-tix-price" className="block text-xs font-semibold text-gray-700">
                    Harga (Rp)
                  </label>
                  <input
                    id="mitra-tix-price"
                    type="number"
                    min={0}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="75000"
                    required
                    className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs text-[#111827] focus:border-[#111827] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="mitra-tix-quota" className="block text-xs font-semibold text-gray-700">
                    Kuota Harian
                  </label>
                  <input
                    id="mitra-tix-quota"
                    type="number"
                    min={1}
                    value={newQuota}
                    onChange={(e) => setNewQuota(e.target.value)}
                    placeholder="100"
                    required
                    className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs text-[#111827] focus:border-[#111827] focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-colors"
            >
              Simpan Tiket Baru
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daftar Staff Gate */}
          <div className="lg:col-span-2 space-y-3">
            {staffFeedback && (
              <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-xs font-semibold text-[#111827]">
                {staffFeedback}
              </div>
            )}

            {venueStaffs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-xs text-gray-500">
                Belum ada akun Staff Gate untuk destinasi ini. Tambahkan di formulir sebelah.
              </div>
            ) : (
              venueStaffs.map((staff) => {
                const isRevealed = Boolean(revealedPins[staff.id]);
                return (
                  <div
                    key={staff.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-[#111827]">{staff.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            staff.isActive
                              ? 'bg-[#111827] text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {staff.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Kode Venue: <strong className="text-[#111827]">{staff.venueCode}</strong> •
                        PIN:{' '}
                        <strong className="font-mono text-[#111827]">
                          {isRevealed ? staff.pin : '••••••'}
                        </strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedPins((prev) => ({ ...prev, [staff.id]: !prev[staff.id] }))
                        }
                        className="px-3 py-1.5 rounded-lg border border-gray-300 hover:border-[#111827] text-xs font-bold text-[#111827] transition-colors"
                      >
                        {isRevealed ? 'Sembunyikan' : 'Lihat PIN'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPin(staff.id)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 hover:border-[#111827] text-xs font-bold text-[#111827] transition-colors"
                      >
                        Reset PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStaffActive(staff.id)}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#111827] transition-colors"
                      >
                        {staff.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Form Tambah Staff Gate */}
          <form
            onSubmit={handleAddStaff}
            className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-extrabold text-[#111827]">Tambah Akun Staff Gate</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="mitra-staff-name" className="block text-xs font-semibold text-gray-700">
                  Nama Petugas
                </label>
                <input
                  id="mitra-staff-name"
                  type="text"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Ratna Sari"
                  required
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs text-[#111827] focus:border-[#111827] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="mitra-staff-pin" className="block text-xs font-semibold text-gray-700">
                  PIN 6 Digit
                </label>
                <div className="flex gap-2">
                  <input
                    id="mitra-staff-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={staffPin}
                    onChange={(e) => setStaffPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="482910"
                    required
                    className="flex-1 h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs text-[#111827] focus:border-[#111827] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setStaffPin(generateSixDigitPin())}
                    className="px-3 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-[11px] font-bold text-[#111827] whitespace-nowrap transition-colors"
                  >
                    Acak PIN
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-colors"
            >
              Buat Akun Staff
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
