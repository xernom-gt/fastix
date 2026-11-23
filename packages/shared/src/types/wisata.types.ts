export type KategoriWisata =
  | 'candi_sejarah'
  | 'pantai_bahari'
  | 'alam_geopark'
  | 'desa_wisata'
  | 'museum_edukasi'
  | 'theme_waterpark';

export type KybStatus = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'EXPIRED' | 'CANCELLED';
export type RedemptionStatus = 'VALID' | 'REDEEMED' | 'REFUNDED' | 'EXPIRED';
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface TicketProduct {
  id: string;
  venueId: string;
  title: string;
  description: string;
  price: number;
  dailyQuota: number;
  usedQuotaPaid: number;
  usedQuotaPending: number;
}

export interface Destinasi {
  id: string;
  venueCode: string; // Format: LOKA-XXXX
  nama: string;
  kotaKode: string;
  lokasi: string;
  alamat: string;
  jamBuka: string;
  deskripsi: string;
  kategori: KategoriWisata;
  hargaMulai: number;
  rating: number;
  jumlahUlasan: number;
  gambarUrl: string;
  gambarAlt: string;
  fasilitas: string[];
  tickets: TicketProduct[];
  koordinat: {
    lat: number;
    lng: number;
  };
  isPublished: boolean;
}

export interface TransactionItem {
  ticketId: string;
  ticketTitle: string;
  bookingDate: string; // YYYY-MM-DD
  quantity: number;
  unitPrice: number;
}

export interface Transaction {
  id: string;
  invoiceNumber: string; // Format: PWL/INV/YYYYMMDD/XXXX
  venueId: string;
  venueCode: string;
  venueName: string;
  venueAddress: string;
  bookingDate: string; // Single-venue, single-date invariant
  items: TransactionItem[];
  subtotal: number;
  platformFee: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  qrString: string;
  snapToken?: string;
  snapRedirectUrl?: string;
  expiredAt: string; // ISO timestamp (+15 menit)
  paidAt?: string;
  createdAt: string;
}

export interface ETicket {
  id: string;
  ticketCode: string; // Format: PWL-TIX-XXXXXXXX
  invoiceNumber: string;
  venueId: string;
  venueCode: string;
  venueName: string;
  venueAddress: string;
  ticketTitle: string;
  bookingDate: string;
  signatureHash: string;
  qrPayload: string; // {ticket_code}|{venue_id}|{booking_date}|{signature_hash}
  status: RedemptionStatus;
  holderName: string;
  paidAt: string;
  redeemedAt?: string;
}

export interface FilterCariWisata {
  keyword?: string;
  kota?: string;
  tanggal?: string;
  kategori?: KategoriWisata | 'all';
  sortBy?: 'terdekat' | 'popularitas' | 'harga_asc' | 'harga_desc';
}

export interface VenueSearchMeta {
  total: number;
  tanggal: string;
  isFuzzyMatch: boolean;
  correctedQuery: string | null;
}
