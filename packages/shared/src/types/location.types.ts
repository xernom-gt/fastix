export interface KoordinatGPS {
  lat: number;
  lng: number;
  akurasi?: number;
  timestamp?: number;
}

export interface WilayahIndonesia {
  kode: string;
  nama: string;
  provinsi: string;
  pusat: KoordinatGPS;
}

export interface StatusGeolokasi {
  isLoading: boolean;
  isGranted: boolean;
  isError: boolean;
  errorMessage?: string;
  koordinat?: KoordinatGPS;
  wilayahTerdekat?: WilayahIndonesia;
}

export const WILAYAH_INDONESIA: WilayahIndonesia[] = [
  {
    kode: 'bali',
    nama: 'Bali (Denpasar, Badung, Gianyar)',
    provinsi: 'Bali',
    pusat: { lat: -8.4095, lng: 115.1889 },
  },
  {
    kode: 'jogja',
    nama: 'D.I. Yogyakarta',
    provinsi: 'DI Yogyakarta',
    pusat: { lat: -7.7956, lng: 110.3695 },
  },
  {
    kode: 'bandung',
    nama: 'Bandung & Lembang',
    provinsi: 'Jawa Barat',
    pusat: { lat: -6.9175, lng: 107.6191 },
  },
  {
    kode: 'jakarta',
    nama: 'DKI Jakarta',
    provinsi: 'DKI Jakarta',
    pusat: { lat: -6.2088, lng: 106.8456 },
  },
  {
    kode: 'malang',
    nama: 'Malang & Batu',
    provinsi: 'Jawa Timur',
    pusat: { lat: -7.9797, lng: 112.6304 },
  },
];
