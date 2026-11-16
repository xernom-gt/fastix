import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { formatRupiah, getTodayISO, type TicketProduct } from '@pariwisloka/shared';
import { useAuth } from '../store/authStore';
import { useBookings } from '../store/bookingStore';
import {
  loadStaffAccounts,
  saveStaffAccounts,
  type StaffGateAccount,
} from '../utils/operationsStorage';

function generateSixDigitPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function MitraDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const { venues, updateVenues, getExtraUsedQuota } = useBookings();
  const [staffs, setStaffs] = useState<StaffGateAccount[]>(loadStaffAccounts);

  const ownedVenues = useMemo(
    () => venues.filter((v) => user?.ownedVenueIds?.includes(v.id)),
    [venues, user?.ownedVenueIds],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const rawTab = searchParams.get('tab');
  const activeTab: 'overview' | 'tickets' | 'staff' =
    rawTab === 'overview' || rawTab === 'staff' ? rawTab : 'tickets';

  const setActiveTab = (tab: 'overview' | 'tickets' | 'staff') => {
    setSearchParams({ tab }, { replace: true });
  };

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

  const activeVenue = useMemo(
    () => ownedVenues.find((v) => v.id === selectedVenueId) ?? ownedVenues[0],
    [ownedVenues, selectedVenueId],
  );

  const venueStaffs = useMemo(
    () => staffs.filter((s) => s.venueId === activeVenue?.id),
    [staffs, activeVenue],
  );

  const updateStaffs = (next: StaffGateAccount[]) => {
    setStaffs(next);
    saveStaffAccounts(next);
  };

  if (!isAuthenticated || user?.role !== 'OWNER') {
    return <Navigate to="/login?redirect=/mitra" replace />;
  }

  const today = getTodayISO();

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-12 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500">Workspace Pengelola Destinasi</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">
            {activeTab === 'overview'
              ? 'Ringkasan Kuota Hari Ini'
              : activeTab === 'staff'
                ? 'Akun & PIN Staff Gate'
                : 'Kelola Tiket & Kuota Harian'}
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

      {/* Switch Tab (Desktop quick tabs) */}
      <div className="hidden md:flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'tickets'
              ? 'bg-[#111827] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Tiket, Harga &amp; Kuota Harian
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'staff'
              ? 'bg-[#111827] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Akun &amp; PIN Staff Gate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'overview'
              ? 'bg-[#111827] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Ringkasan Kuota
        </button>
      </div>

      {activeTab === 'overview' ? (
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

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
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
                        className="px-3.5 py-1.5 rounded-lg border border-gray-300 hover:border-[#111827] text-xs font-bold text-[#111827] transition-colors"
                      >
                        Ubah Harga / Kuota
                      </button>
                    )}
                  </div>

                  {isEditing && (
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-gray-600">
                            Harga (Rp)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-[#111827] focus:border-[#111827] focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-gray-600">
                            Kuota Harian
                          </label>
                          <input
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
                  placeholder="Akses pagi pukul 05.30 - 08.00 WIB"
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
