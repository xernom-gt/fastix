export type StatusModule = 'kyb' | 'payment' | 'redemption' | 'payout' | 'mutation';

export interface StatusStyleConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}

/**
 * Standar Warna Status UI resmi sesuai PRD Pariwisloka Bab 2:
 * - NOT_SUBMITTED / CANCELLED : Abu-abu (#E5E7EB)
 * - PENDING / PROCESSING (KYB / Payout) : Kuning Pastel (#FEF3C7)
 * - PENDING (Transaksi Pembayaran QRIS) : Oranye Pastel (#FFEDD5)
 * - APPROVED / PAID / VALID / SUCCESS : Hijau (#D1FAE5)
 * - REDEEMED : Biru (#DBEAFE)
 * - REJECTED / EXPIRED / FAILED : Merah (#FEE2E2)
 */
export const STATUS_STYLE_MAP: Record<string, StatusStyleConfig> = {
  'kyb:NOT_SUBMITTED': {
    bg: '#E5E7EB',
    text: '#1F2937',
    border: '#D1D5DB',
    dot: '#6B7280',
    label: 'NOT_SUBMITTED · Belum Diajukan',
  },
  'kyb:PENDING': {
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#FDE68A',
    dot: '#D97706',
    label: 'PENDING · Menunggu Verifikasi HQ',
  },
  'kyb:APPROVED': {
    bg: '#D1FAE5',
    text: '#065F46',
    border: '#A7F3D0',
    dot: '#059669',
    label: 'APPROVED · Terverifikasi & Tayang',
  },
  'kyb:REJECTED': {
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#FECACA',
    dot: '#DC2626',
    label: 'REJECTED · Berkas Ditolak',
  },

  'payment:PENDING': {
    bg: '#FFEDD5',
    text: '#9A3412',
    border: '#FED7AA',
    dot: '#EA580C',
    label: 'PENDING · Menunggu QRIS (15m)',
  },
  'payment:PAID': {
    bg: '#D1FAE5',
    text: '#065F46',
    border: '#A7F3D0',
    dot: '#059669',
    label: 'PAID · Lunas (Webhook Verified)',
  },
  'payment:EXPIRED': {
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#FECACA',
    dot: '#DC2626',
    label: 'EXPIRED · Lewat 15 Menit',
  },
  'payment:CANCELLED': {
    bg: '#E5E7EB',
    text: '#374151',
    border: '#D1D5DB',
    dot: '#6B7280',
    label: 'CANCELLED · Dibatalkan',
  },

  'redemption:VALID': {
    bg: '#D1FAE5',
    text: '#065F46',
    border: '#A7F3D0',
    dot: '#059669',
    label: 'VALID · Siap Scan di Gate',
  },
  'redemption:REDEEMED': {
    bg: '#DBEAFE',
    text: '#1E40AF',
    border: '#BFDBFE',
    dot: '#2563EB',
    label: 'REDEEMED · Sudah Dipindai Masuk',
  },
  'redemption:EXPIRED': {
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#FECACA',
    dot: '#DC2626',
    label: 'EXPIRED · Lewat Tanggal (No-Show)',
  },

  'payout:PENDING': {
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#FDE68A',
    dot: '#D97706',
    label: 'PENDING · Antrean Disbursement',
  },
  'payout:PROCESSING': {
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#FDE68A',
    dot: '#D97706',
    label: 'PROCESSING · Diproses Bank',
  },
  'payout:SUCCESS': {
    bg: '#D1FAE5',
    text: '#065F46',
    border: '#A7F3D0',
    dot: '#059669',
    label: 'SUCCESS · Dana Cair ke Rekening',
  },
  'payout:FAILED': {
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#FECACA',
    dot: '#DC2626',
    label: 'FAILED · Gagal (Saldo Dikembalikan)',
  },

  'mutation:PAYIN_INFLOW': {
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#FDE68A',
    dot: '#D97706',
    label: 'PAYIN_INFLOW · Masuk Saldo Tertahan',
  },
  'mutation:HOLDING_RELEASED': {
    bg: '#D1FAE5',
    text: '#065F46',
    border: '#A7F3D0',
    dot: '#059669',
    label: 'HOLDING_RELEASED · Rilis H+1 ke Siap Tarik',
  },
  'mutation:PAYOUT_WITHDRAW': {
    bg: '#DBEAFE',
    text: '#1E40AF',
    border: '#BFDBFE',
    dot: '#2563EB',
    label: 'PAYOUT_WITHDRAW · Penarikan Saldo',
  },
  'mutation:PAYOUT_REFUND': {
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#FECACA',
    dot: '#DC2626',
    label: 'PAYOUT_REFUND · Pengembalian Gagal Transfer',
  },
};
