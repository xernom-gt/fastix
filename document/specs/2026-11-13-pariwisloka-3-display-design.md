# Design Spec: Pariwisloka 3-Display Monorepo (Tahap 1: Monorepo, Landing & Main App Customer)

**Tanggal:** 2026-11-13  
**Status:** Menunggu review user  
**Acuan:** [brd_pariwisloka.md](../brd_pariwisloka.md), [prd_pariwisloka.md](../prd_pariwisloka.md)

---

## 1. Tujuan & Ruang Lingkup

Menata ulang frontend Pariwisloka menjadi arsitektur **3 display terpisah** dalam satu `pnpm` monorepo di `c:\project\paristix\`, mengikuti standar keamanan BRD (*App Separation*) dan efisiensi performa di perangkat pengunjung:

1. **`landing/`** — Portal promosi & informasi publik (Guest, port `5173`).
2. **`app/`** — Main Aplikasi Pariwisloka (Tahap 1: alur Customer — eksplorasi katalog, detail destinasi, single-venue checkout QRIS 15 menit, dan E-Ticket QR; port `5174`). *(Mode Owner & Staff Gate akan ditambahkan pada Tahap 2 di aplikasi ini).*
3. **`admin/`** — Pariwisloka HQ Internal Admin (port `5175`, disiapkan sebagai *shell/placeholder* pada Tahap 1 dan dibangun penuh pada Tahap 3).

**Di luar cakupan Tahap 1:** integrasi backend riil (`api/`), halaman Owner Wisata (KYB onboarding, kelola tiket/kuota, payout), mode Pariwisloka Gate (scanner offline-first), dan fitur admin HQ penuh.

---

## 2. Struktur Monorepo & Pemisahan File

```text
paristix/
├─ landing/                  # Display 1: Promosi Publik (Vite + React + Tailwind v3)
├─ app/                      # Display 2: Main Aplikasi (Vite + React + Tailwind v3)
├─ admin/                    # Display 3: Admin HQ Shell (Vite + React + Tailwind v3)
├─ api/                      # Backend (dipindahkan dari application/backend/)
├─ packages/
│  └─ shared/                # Paket bersama yang tipis & netral (Opsi A)
│     ├─ package.json
│     └─ src/
│        ├─ index.ts
│        ├─ types/           # Tipe Destinasi, TicketType, Transaction, Redemption, Status
│        ├─ constants/       # Mapping warna status pastel resmi PRD Bab 2
│        ├─ components/      # StatusBadge.tsx
│        ├─ utils/           # formatRupiah.ts, formatDistance.ts, formatDate.ts
│        └─ data/            # Data mock destinasi & tiket contoh untuk Tahap 1
├─ document/                 # BRD, PRD, ERD, Use Case, Activity Diagram, & specs/
├─ package.json              # Root scripts: dev:landing, dev:app, dev:admin, dev:all, build:all
├─ pnpm-workspace.yaml       # packages: ["landing", "app", "admin", "packages/*"]
├─ .env.example              # VITE_LANDING_URL, VITE_APP_URL, VITE_ADMIN_URL, VITE_API_URL
├─ .gitignore
└─ README.md
```

Folder `application/` lama akan dipindahkan isinya ke `landing/`, `packages/shared/`, dan `api/`, lalu dihapus setelah verifikasi build berhasil.

---

## 3. Batasan Keamanan & Performa (Opsi A)

1. **Isolasi Bundle (`admin/` terpisah):** `landing/` dan `app/` tidak mengimpor satu baris pun kode dari `admin/`. Pengunjung publik tidak pernah mengunduh route atau logika internal HQ.
2. **Aturan Ketat `packages/shared`:**
   - Hanya berisi komponen UI netral (`StatusBadge`), tipe data domain publik, formatter, dan data mock katalog.
   - **Dilarang** menyimpan endpoint admin, logika verifikasi KYB, kunci enkripsi, atau kode khusus staf/admin di `packages/shared`.
   - Tidak menambah dependency berat di `packages/shared` (hanya `react` sebagai peer dependency) agar *tree-shaking* dan ukuran bundle `landing/` tetap ringan.
3. **Zero-Dependency Heavy Animation:** Menggunakan transisi CSS ringan (`tailwindcss`) alih-alih library animasi berat agar halaman tetap responsif di HP kelas bawah.

---

## 4. Desain Visual & Aturan Bisnis (BRD/PRD)

- **Gaya Visual:** *Crisp Monochrome* (latar `#FFFFFF` / `#F9FAFB`, teks & tombol utama `#111827` / `#000000`, font `Plus Jakarta Sans` + ikon `Material Symbols Outlined`) dipadukan dengan **Status Pastel resmi PRD Bab 2**:
  - `NOT_SUBMITTED` / `CANCELLED`: `#E5E7EB` (Abu-abu)
  - `PENDING` (KYB / Payout): `#FEF3C7` (Kuning Pastel)
  - `PENDING` (Pembayaran QRIS): `#FFEDD5` (Oranye Pastel)
  - `APPROVED` / `PAID` / `VALID` / `SUCCESS`: `#D1FAE5` (Hijau)
  - `REDEEMED`: `#DBEAFE` (Biru)
  - `REJECTED` / `EXPIRED` / `FAILED`: `#FEE2E2` (Merah)
- **Format Identitas Resmi (BRD §3):**
  - Kode Wisata (`venue_code`): `LOKA-XXXX`
  - Nomor Invoice (`invoice_number`): `PWL/INV/YYYYMMDD/XXXX`
  - Kode Tiket QR (`ticket_code`): `PWL-TIX-XXXXXXXX`

---

## 5. Rancangan Tiap Display (Tahap 1)

### 5.1 Display 1 — `landing/` (Port 5173)
- **Layout:** `Header` (navigasi `Destinasi`, `Cara Kerja`, `Cek Tiket`, `Mitra Wisata`, tombol `Buka Aplikasi` ke `VITE_APP_URL`) + `Footer`.
- **Halaman `/`:**
  - `HeroSection`: Headline, *Smart Search Bar* (input keyword, kota, tanggal → mengarahkan ke `${VITE_APP_URL}/explore?q=...&city=...&date=...`), & 4 trust metrics.
  - `CategoriesSection`: 6 kategori wisata (klik mengarahkan ke `/explore?kategori=...` di `app/`).
  - `DestinationsSection`: Preview destinasi populer dengan sisa kuota & tombol `Pesan di App →`.
  - `HowItWorksSection`: 4 langkah alur (Pilih Kuota → Bayar QRIS → E-Ticket HMAC → Scan `<0.2s`).
  - `TicketValidatorSection`: Form cek cepat referensi tiket + visual E-Pass (klik verifikasi mengarahkan ke `${VITE_APP_URL}/tiket?ref=...`).
  - `EcosystemSection` & `TestimonialsSection`.

### 5.2 Display 2 — `app/` (Port 5174, Tahap 1: Customer Flow)
- **Layout:** Responsif *mobile-first* — Top Navbar di desktop, **Bottom Navigation Bar** di mobile (`Jelajah`, `Tiket Saya`, `Cek Status`) + link kembali ke `landing/`.
- **Rute & Halaman:**
  1. **`/` & `/explore` (Katalog Wisata):**
     - Pemilih kota (`Semua Wilayah`, `Bali`, `D.I. Yogyakarta`, `Bandung & Lembang`, `DKI Jakarta`, `Malang & Batu`) + tombol deteksi lokasi GPS (`useGeolocation`).
     - Filter kategori, pencarian keyword real-time, & urutkan (`Terdekat`, `Populer`, `Harga Terendah`).
     - Kartu destinasi menampilkan `venue_code` (`LOKA-XXXX`), sisa kuota harian (`daily_quota`), rating, dan harga mulai.
  2. **`/destinasi/:id` (Detail Wisata & Single-Venue Checkout):**
     - Banner foto, deskripsi, alamat, jam operasional, dan fasilitas.
     - **Aturan Single-Venue Checkout (BRD §6.2):** Pemilihan **1 tanggal kunjungan** + **jenis tiket & jumlah**. Sisa kuota dihitung real-time terhadap jumlah yang dipilih.
     - Ringkasan biaya (`Subtotal` + `Platform Fee`) & tombol `Lanjut Bayar QRIS`.
  3. **`/checkout/:invoiceId` (Pembayaran QRIS 15 Menit):**
     - Menampilkan `invoice_number` (`PWL/INV/YYYYMMDD/XXXX`), badge `StatusBadge` (`payment:PENDING` oranye pastel), dan **countdown 15:00** menuju `expired_at`.
     - Tampilan QRIS (SVG) + rincian destinasi & tanggal kunjungan.
     - Kontrol simulasi lokal (khusus mode mock sebelum backend siap):
       - Tombol `Simulasikan Pembayaran Lunas (Webhook PAID)` → mengubah status ke `PAID`, menerbitkan `ticket_code` (`PWL-TIX-XXXXXXXX`) sebanyak jumlah tiket dengan payload `{ticket_code}|{venue_id}|{booking_date}|{signature_hash}`, lalu mengarahkan ke `/tiket/:ticketCode`.
       - Tombol `Batalkan Pesanan` → mengubah status ke `CANCELLED` dan melepas kuota.
       - Jika timer habis → status otomatis menjadi `EXPIRED`.
  4. **`/tiket` & `/tiket/:ticketCode` (E-Ticket & Riwayat):**
     - Input pencarian kode tiket (`PWL-TIX-XXXXXXXX`) atau pilih dari daftar riwayat transaksi yang tersimpan di `localStorage`.
     - Filter tab status: `Semua`, `VALID`, `REDEEMED`, `EXPIRED`.
     - Tampilan **Pariwisloka E-Pass** lengkap dengan QR Code, perforasi tiket, badge status pastel (`VALID` hijau / `REDEEMED` biru / `EXPIRED` merah), dan informasi gate.

### 5.3 Display 3 — `admin/` (Port 5175, Placeholder Tahap 1)
- Aplikasi Vite + React + Tailwind minimal dengan halaman status *"Pariwisloka HQ — Panel Internal Admin"* yang memakai `StatusBadge` dari `@pariwisloka/shared` untuk memastikan workspace & build berjalan mulus sejak Tahap 1.

---

## 6. Rencana Verifikasi

1. `pnpm install` di root berhasil menautkan `landing`, `app`, `admin`, dan `packages/shared`.
2. `pnpm build:all` (`tsc -b && vite build` di seluruh workspace) selesai tanpa error TypeScript maupun bundling.
3. Uji alur di browser:
   - `landing/` (`localhost:5173`) → cari destinasi → redirect ke `app/` (`localhost:5174/explore`) dengan query terisi.
   - `app/` → pilih destinasi → pilih tanggal & jumlah → checkout QRIS 15 menit → simulasi `PAID` → E-Ticket `PWL-TIX-XXXXXXXX` terbit dan tersimpan di `/tiket`.
   - Uji tampilan desktop dan mobile (`< 768px`).
