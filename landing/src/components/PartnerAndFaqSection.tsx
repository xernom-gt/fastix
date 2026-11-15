import { useState } from 'react';
import { WILAYAH_INDONESIA } from '@pariwisloka/shared';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const FAQ_ITEMS = [
  {
    q: 'Apakah harus login untuk melihat destinasi?',
    a: 'Tidak. Katalog dan sisa kuota harian dapat dilihat bebas; login hanya diperlukan saat checkout QRIS atau membuka E-Ticket.',
  },
  {
    q: 'Berapa lama batas waktu pembayaran QRIS?',
    a: 'Kuota tiket dikunci 15 menit setelah invoice terbit. Jika melewati batas waktu, kuota otomatis dilepas kembali.',
  },
  {
    q: 'Apa syarat mendaftar sebagai mitra Fastix?',
    a: 'Siapkan KTP penanggung jawab, NPWP, NIB, dan rekening resmi untuk verifikasi KYB serta pencairan Escrow H+1.',
  },
];

interface PartnerLeadPayload {
  venueName: string;
  kotaKode: string;
  picName: string;
  whatsapp: string;
  email: string;
}

export function PartnerAndFaqSection() {
  const [picName, setPicName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [kotaKode, setKotaKode] = useState(WILAYAH_INDONESIA[0]?.kode ?? 'bali');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedLead, setSubmittedLead] = useState<{ leadId: string; payload: PartnerLeadPayload } | null>(null);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const payload: PartnerLeadPayload = {
      venueName: venueName.trim(),
      kotaKode,
      picName: picName.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
    };

    if (!payload.picName || !payload.venueName || !payload.whatsapp || !payload.email) {
      setSubmitError('Mohon lengkapi seluruh kolom pendaftaran mitra.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (API_URL) {
        const res = await fetch(`${API_URL}/partner-leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          throw new Error(body?.error?.message ?? 'Gagal mengirim pengajuan ke server.');
        }
        setSubmittedLead({ leadId: body.data?.leadId ?? 'RECEIVED', payload });
      } else {
        setSubmittedLead({ leadId: 'SIMULASI-LOKAL', payload });
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengirim pengajuan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedLead(null);
    setSubmitError(null);
    setPicName('');
    setVenueName('');
    setKotaKode(WILAYAH_INDONESIA[0]?.kode ?? 'bali');
    setWhatsapp('');
    setEmail('');
  };

  return (
    <>
      <section id="daftar-mitra" className="bg-white border-t border-gray-200 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Daftar Mitra</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              Daftarkan Destinasi Anda
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Isi kontak singkat untuk verifikasi KYB dan aktivasi kode <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">LOKA-XXXX</code>.
            </p>
          </div>

          <div className="lg:col-span-7 bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8">
            {submittedLead ? (
              <div className="space-y-4 py-2" role="status">
                <p className="text-base font-extrabold text-gray-900">
                  Pengajuan kemitraan tercatat ({submittedLead.leadId}).
                </p>
                <p className="text-sm text-gray-600">
                  Terima kasih <strong>{submittedLead.payload.picName}</strong>. Pengajuan untuk{' '}
                  <strong>{submittedLead.payload.venueName}</strong> siap ditindaklanjuti ke{' '}
                  <strong>{submittedLead.payload.whatsapp}</strong> ({submittedLead.payload.email}).
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-900"
                >
                  Kirim Pengajuan Lain
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="lead-name" className="block text-xs font-bold text-gray-700">
                    Nama PIC
                  </label>
                  <input
                    id="lead-name"
                    type="text"
                    value={picName}
                    onChange={(e) => setPicName(e.target.value)}
                    placeholder="Nama lengkap"
                    required
                    className="w-full h-11 px-3.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="lead-wa" className="block text-xs font-bold text-gray-700">
                    WhatsApp
                  </label>
                  <input
                    id="lead-wa"
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    required
                    className="w-full h-11 px-3.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="lead-email" className="block text-xs font-bold text-gray-700">
                    Email Resmi
                  </label>
                  <input
                    id="lead-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mitra@contoh.id"
                    required
                    className="w-full h-11 px-3.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="lead-kota" className="block text-xs font-bold text-gray-700">
                    Wilayah
                  </label>
                  <select
                    id="lead-kota"
                    value={kotaKode}
                    onChange={(e) => setKotaKode(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900"
                  >
                    {WILAYAH_INDONESIA.map((w) => (
                      <option key={w.kode} value={w.kode}>
                        {w.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="lead-venue" className="block text-xs font-bold text-gray-700">
                    Nama Tempat Wisata / Acara
                  </label>
                  <input
                    id="lead-venue"
                    type="text"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="Contoh: Taman Wisata Alam"
                    required
                    className="w-full h-11 px-3.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900"
                  />
                </div>

                {submitError && (
                  <div className="sm:col-span-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-800" role="alert">
                    {submitError}
                  </div>
                )}

                <div className="sm:col-span-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-lg bg-gray-900 hover:bg-black disabled:opacity-60 text-white text-sm font-bold transition-colors"
                  >
                    {isSubmitting ? 'Mengirim...' : 'Ajukan Kemitraan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-gray-50 border-t border-gray-200 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 space-y-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Pertanyaan Umum
          </h2>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-gray-200 bg-white px-5 py-4"
              >
                <summary className="flex items-center justify-between gap-4 font-bold text-sm text-gray-900 cursor-pointer list-none min-h-[32px]">
                  <span>{item.q}</span>
                  <span
                    className="material-symbols-outlined text-[20px] text-gray-500 group-open:rotate-180 transition-transform shrink-0"
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
