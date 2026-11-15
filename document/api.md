# Fastix API Specification & Implementation Guide (`api.md`)

> **Single Source of Truth** untuk integrasi antara Frontend (`landing/`, `app/`, `admin/`) dan Backend (`api/`).
> Jika ada perubahan kebutuhan di Frontend, perbarui kontrak di dokumen ini terlebih dahulu sebelum mengubah kode backend.

---

## 1. Konvensi Global

- **Base URL (Local Dev)**: `http://localhost:8080/api/v1`
- **Content-Type**: `application/json; charset=utf-8`
- **Autentikasi**: Bearer JWT (`Authorization: Bearer <token>`)
- **Sinkronisasi Tipe**: Seluruh enum dan field utama mengikuti kontrak di `packages/shared/src/types/wisata.types.ts` dan `packages/shared/src/types/location.types.ts`.

### Format Response Standar

**Success:**
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-11-15T17:00:00+07:00",
    "total": 10
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Kuota tiket pada tanggal yang dipilih tidak mencukupi.",
    "details": {}
  }
}
```

### Konvensi Kode & Status Resmi
- **Venue Code**: `LOKA-XXXX`
- **Invoice Number**: `PWL/INV/YYYYMMDD/XXXX`
- **Ticket Code**: `PWL-TIX-XXXXXXXX`
- **QR Payload**: `{ticketCode}|{venueId}|{bookingDate}|{signatureHash}` (HMAC-SHA256)
- **Status Enum**:
  - `KybStatus`: `NOT_SUBMITTED` | `PENDING` | `APPROVED` | `REJECTED`
  - `PaymentStatus`: `PENDING` | `PAID` | `EXPIRED` | `CANCELLED`
  - `RedemptionStatus`: `VALID` | `REDEEMED` | `EXPIRED`
  - `PayoutStatus`: `PENDING` | `PROCESSING` | `SUCCESS` | `FAILED`

### Aturan Bisnis Kritis (Wajib di Backend)
1. **Single-Venue, Single-Date Invariant**: 1 transaksi (`Transaction`) hanya boleh berisi item dari 1 destinasi (`venueId`) dan 1 tanggal kunjungan (`bookingDate`).
2. **Atomic Quota Reservation**: Saat `POST /bookings`, gunakan DB transaction + row lock (`SELECT ... FOR UPDATE`) untuk memastikan `dailyQuota - usedQuotaPaid - usedQuotaPending >= qty`.
3. **Expiry 15 Menit**: Transaksi `PENDING` yang melewati `expiredAt` otomatis berubah menjadi `EXPIRED` dan mengembalikan `usedQuotaPending`.
4. **Escrow H+1**: Dana transaksi `PAID` ditahan di Escrow dan baru berstatus siap cair (`PayoutStatus`) pada `H+1` setelah `bookingDate`.

---

## 2. Daftar Endpoint API

### A. Public & Landing (`landing/`)

| Method | Endpoint | Auth | Kegunaan di FE |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Healthcheck service & koneksi DB |
| `GET` | `/regions` | Public | Daftar `WILAYAH_INDONESIA` + jumlah destinasi aktif |
| `POST` | `/partner-leads` | Public | Form pendaftaran Calon Mitra Wisata di Landing Page |

#### `POST /partner-leads`
**Request:**
```json
{
  "venueName": "Taman Wisata Alam Contoh",
  "kotaKode": "bandung",
  "picName": "Budi Santoso",
  "whatsapp": "081234567890",
  "email": "mitra@contoh.id"
}
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "leadId": "lead_01JXYZ",
    "status": "RECEIVED"
  }
}
```

---

### B. Discovery & Katalog (`app/` - Guest & Tourist)

| Method | Endpoint | Auth | Kegunaan di FE |
| :--- | :--- | :--- | :--- |
| `GET` | `/venues` | Public | Dipakai di `/explore` (Beranda) & `/jelajah` (Katalog) |
| `GET` | `/venues/:id` | Public | Dipakai di `/destinasi/:id` (Detail & Pilih Tiket) |

#### `GET /venues`
**Query Params:**
- `q` (string, opsional): Kata kunci nama, lokasi, atau `LOKA-XXXX`
- `kota` (string, opsional): `bali` | `jogja` | `bandung` | `jakarta` | `malang` | `all`
- `kategori` (string, opsional): `candi_sejarah` | `pantai_bahari` | `alam_geopark` | `desa_wisata` | `museum_edukasi` | `theme_waterpark` | `all`
- `tanggal` (string, `YYYY-MM-DD`, default hari ini): Menghitung sisa kuota pada tanggal tersebut
- `sortBy` (string): `popularitas` | `harga_asc` | `terdekat`
- `lat`, `lng` (number, opsional): Koordinat user untuk menghitung `distanceMeters` (Haversine)
- `limit`, `offset` (number, opsional): Pagination

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "v-borobudur",
      "venueCode": "LOKA-1001",
      "nama": "Candi Borobudur",
      "kotaKode": "jogja",
      "lokasi": "Magelang, D.I. Yogyakarta",
      "kategori": "candi_sejarah",
      "hargaMulai": 50000,
      "rating": 4.9,
      "jumlahUlasan": 1240,
      "gambarUrl": "https://...",
      "gambarAlt": "Candi Borobudur saat pagi hari",
      "distanceMeters": 12400,
      "remainingQuota": 320,
      "isPublished": true
    }
  ],
  "meta": {
    "total": 12,
    "tanggal": "2026-11-15"
  }
}
```

#### `GET /venues/:id?tanggal=YYYY-MM-DD`
Mengembalikan objek `Destinasi` lengkap (`alamat`, `jamBuka`, `deskripsi`, `fasilitas`, `koordinat`, dan array `tickets[]` dengan `dailyQuota`, `usedQuotaPaid`, `usedQuotaPending` untuk tanggal terpilih).

---

### C. Auth Wisatawan (`app/` - `/login`)

| Method | Endpoint | Auth | Kegunaan di FE |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/otp/request` | Public | Kirim OTP ke nomor WhatsApp/SMS wisatawan |
| `POST` | `/auth/otp/verify` | Public | Verifikasi OTP & login, return JWT + user profile |
| `GET` | `/auth/me` | `TOURIST` | Ambil profil user yang sedang login |

#### `POST /auth/otp/verify`
**Request:**
```json
{
  "phone": "081234567890",
  "fullName": "Wisatawan Fastix",
  "otpCode": "123456"
}
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": "usr_01",
      "phone": "081234567890",
      "fullName": "Wisatawan Fastix",
      "role": "TOURIST"
    }
  }
}
```

---

### D. Booking, Pembayaran QRIS & E-Ticket (`app/` - `/checkout` & `/tiket`)

| Method | Endpoint | Auth | Kegunaan di FE |
| :--- | :--- | :--- | :--- |
| `POST` | `/bookings` | `TOURIST` | Buat invoice checkout & lock kuota 15 menit |
| `GET` | `/bookings/:invoiceId` | `TOURIST` | Cek status pembayaran & QRIS string di `/checkout/:invoiceId` |
| `POST` | `/webhooks/qris` | Gateway Signature | Callback pembayaran lunas -> terbit `ETicket[]` & catat Escrow |
| `POST` | `/bookings/:invoiceId/simulate-pay` | `TOURIST` (Dev Only) | Simulasi bayar lunas saat environment `development` |
| `GET` | `/tickets` | `TOURIST` | Daftar semua e-ticket milik user di `/tiket` |
| `GET` | `/tickets/:ticketCode` | `TOURIST` | Detail 1 e-ticket di `/tiket/:ticketCode` |

#### `POST /bookings`
**Request:**
```json
{
  "venueId": "v-borobudur",
  "bookingDate": "2026-11-20",
  "items": [
    {
      "ticketId": "tkt-101",
      "quantity": 2
    }
  ]
}
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "id": "tx_01",
    "invoiceNumber": "PWL/INV/20261115/0042",
    "venueId": "v-borobudur",
    "venueCode": "LOKA-1001",
    "venueName": "Candi Borobudur",
    "bookingDate": "2026-11-20",
    "items": [
      {
        "ticketId": "tkt-101",
        "ticketTitle": "Tiket Masuk Reguler",
        "bookingDate": "2026-11-20",
        "quantity": 2,
        "unitPrice": 50000
      }
    ],
    "subtotal": 100000,
    "platformFee": 5000,
    "totalAmount": 105000,
    "paymentStatus": "PENDING",
    "qrString": "000201010212...",
    "expiredAt": "2026-11-15T17:15:00+07:00"
  }
}
```

---

### E. Validasi Gate & Mitra (`GATE_STAFF` / `MITRA`)

| Method | Endpoint | Auth | Kegunaan |
| :--- | :--- | :--- | :--- |
| `POST` | `/gate/redeem` | `GATE_STAFF`, `MITRA` | Validasi HMAC `qrPayload` & tandai tiket `REDEEMED` (1x pakai) |
| `POST` | `/mitra/kyb` | `MITRA` | Submit dokumen legalitas mitra untuk ditinjau Admin HQ |

#### `POST /gate/redeem`
**Request:**
```json
{
  "qrPayload": "PWL-TIX-88219012|v-borobudur|2026-11-20|a9f1c..."
}
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "ticketCode": "PWL-TIX-88219012",
    "status": "REDEEMED",
    "redeemedAt": "2026-11-20T09:12:00+07:00"
  }
}
```

---

### F. Admin HQ (`admin/`)

| Method | Endpoint | Auth | Kegunaan di FE |
| :--- | :--- | :--- | :--- |
| `POST` | `/admin/auth/login` | Public | Login Admin HQ |
| `GET` | `/admin/kyb` | `ADMIN_HQ` | Daftar pengajuan KYB mitra (`?status=PENDING`) |
| `PATCH` | `/admin/kyb/:id/decision` | `ADMIN_HQ` | Setujui / Tolak KYB (`reason` wajib jika `REJECTED`) |
| `GET` | `/admin/escrow` | `ADMIN_HQ` | Monitoring read-only saldo Escrow & status Payout H+1 |

#### `PATCH /admin/kyb/:id/decision`
**Request:**
```json
{
  "decision": "REJECTED",
  "reason": "Dokumen NIB tidak terbaca dengan jelas."
}
```

---

## 3. Daftar Tugas Implementasi Backend (`api/` Build Checklist)

Checklist berikut disusun berurutan agar AI atau engineer dapat membangun folder `api/` secara bertahap dengan mengacu pada dokumen ini dan skema di `document/erd_pariwisloka.md`:

- [ ] **Task 1 — Bootstrap Project & Database**
  - Inisialisasi service backend di `c:\project\paristix\api\` (Go/Fiber atau Node/Fastify sesuai keputusan stack) + `.env.example`.
  - Setup koneksi PostgreSQL & migrasi tabel mengacu pada `document/erd_pariwisloka.md`.
  - Implementasi response wrapper standar (`success`, `data`, `meta`, `error`) dan CORS untuk `5173`, `5174`, `5175`.
- [ ] **Task 2 — Auth & RBAC Middleware**
  - Implementasi `POST /auth/otp/request`, `POST /auth/otp/verify`, `GET /auth/me`.
  - Implementasi `POST /admin/auth/login`.
  - Implementasi middleware JWT + Role Guard (`TOURIST`, `MITRA`, `GATE_STAFF`, `ADMIN_HQ`).
- [ ] **Task 3 — Public, Regions, Leads & Discovery**
  - Implementasi `GET /health`, `GET /regions`, `POST /partner-leads`.
  - Implementasi `GET /venues` (filter `q`, `kota`, `kategori`, `tanggal`, `sortBy`, kalkulasi jarak Haversine) dan `GET /venues/:id`.
- [ ] **Task 4 — Atomic Booking, Expiry Worker & QRIS Webhook**
  - Implementasi `POST /bookings` dengan DB row-lock untuk mencegah *overselling* kuota harian.
  - Implementasi background worker/cron untuk mengubah transaksi `PENDING` yang melewati `expiredAt` menjadi `EXPIRED` dan melepaskan `usedQuotaPending`.
  - Implementasi `POST /webhooks/qris` (verifikasi signature) + `POST /bookings/:invoiceId/simulate-pay` (dev only) untuk menerbitkan `ETicket[]` ber-HMAC dan mencatat Escrow.
  - Implementasi `GET /tickets` dan `GET /tickets/:ticketCode`.
- [ ] **Task 5 — Gate Redeem & Admin HQ**
  - Implementasi `POST /gate/redeem` dengan verifikasi HMAC-SHA256 dan proteksi *double-scan* (atomic `VALID -> REDEEMED`).
  - Implementasi `GET /admin/kyb`, `PATCH /admin/kyb/:id/decision` (wajib `reason` saat `REJECTED` + audit log), dan `GET /admin/escrow` (read-only).
- [ ] **Task 6 — Automated Tests & Contract Check**
  - Uji unit kalkulasi fee, Haversine, dan HMAC signature.
  - Uji integrasi konkurensi booking (pastikan kuota tidak minus saat *concurrent request*) dan double-redeem gate.
