# 🎭 Use Case Diagram — Pariwisloka

Sumber: BRD §2 & §4 (RBAC), PRD §4 (Modul 1.0–5.0).
File diagram: `usecase_pariwisloka.puml` (PlantUML).

## Cara Import ke draw.io
1. Buka https://app.diagrams.net
2. **Arrange → Insert → Advanced → PlantUML…**
3. Paste isi `usecase_pariwisloka.puml` → **Insert**.

> Hasil PlantUML di draw.io berupa gambar (tidak bisa diedit per elemen). Jika ingin editable, gambar ulang manual memakai tabel di bawah sebagai acuan (shape: *UML → Actor* & *Ellipse*).

## Aktor

| Aktor | Jenis | Login | Pewarisan |
|---|---|---|---|
| Guest | Manusia | Tanpa login | — |
| Customer | Manusia | OTP / Google | mewarisi Guest |
| Owner Wisata | Manusia | Akun Customer yang `APPROVED` | mewarisi Customer |
| Staff Gate | Manusia | `venue_code` + PIN 6 digit | — |
| Internal Admin | Manusia | Kredensial internal HQ | — |
| Payment Gateway | Sistem eksternal | Signature webhook | — |
| Scheduler | Sistem internal | — | — |

## Use Case per Aktor

### Guest (Pariwisloka App)
- Jelajahi katalog wisata per kota
- Lihat detail wisata, harga & sisa kuota
- Login (OTP / Google)
- ❌ Tidak boleh: beli tiket, ajukan wisata

### Customer (+ semua milik Guest)
- Checkout tiket — **include**: validasi kuota harian, bayar QRIS (15 menit)
- Batalkan pesanan yang masih `PENDING`
- Lihat E-Ticket QR & riwayat transaksi
- Ajukan draf wisata + dokumen KYB (KTP, NPWP, NIB, rekening)
- ❌ Tidak boleh: batalkan tiket `REDEEMED`, ubah status bayar dari klien

### Owner Wisata (+ semua milik Customer)
- Kelola detail wisata
- Kelola jenis tiket, harga & kuota harian
- Kelola akun & PIN Staff Gate
- Lihat laporan omzet & saldo (pending / available)
- Ajukan payout (≤ `available_balance`, rekening dari KYB)
- ❌ Tidak boleh: publish tanpa approval, ganti rekening manual

### Staff Gate (Pariwisloka Gate)
- Login kode wisata + PIN
- Sinkron tiket harian untuk mode offline
- Scan & validasi QR — **extend**: verifikasi HMAC offline (tiket beli dadakan)
- Upload antrean scan offline
- ❌ Tidak boleh: lihat saldo/omzet, ubah harga/kuota

### Internal Admin (Pariwisloka HQ)
- Login admin internal
- Periksa dokumen KYB ber-watermark
- Setujui / tolak pengajuan Owner — **include**: periksa dokumen (tolak wajib alasan)
- Pantau escrow & mutasi saldo
- Pantau payout
- ❌ Tidak boleh: ubah saldo manual

### Payment Gateway (sistem)
- Webhook PAID → **include**: terbitkan tiket QR + tambah `pending_balance`
- Webhook Disbursement → payout `SUCCESS` / `FAILED` (refund saldo)

### Scheduler (sistem)
- Kedaluwarsakan transaksi `PENDING` > 15 menit
- 23:59 WIB: rilis saldo H+1 & ubah tiket no-show jadi `EXPIRED`
