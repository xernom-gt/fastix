# 🛠️ README: Product Requirements Document (PRD) — PARIWISLOKA

> ** Konteks Wajib untuk Developer & AI Agent (Cursor / Copilot / Windsurf):**
> Dokumen ini adalah spesifikasi teknis utama (**Single Source of Truth**) untuk membangun **Pariwisloka** (Platform SaaS E-Ticketing & Event Management berbasis Lokasi). Setiap pembuatan *database migration*, *API endpoint*, logika *backend*, maupun komponen *frontend* **WAJIB** mematuhi skema, rumus validasi, dan *State Machine* di dalam dokumen ini tanpa terkecuali (*Zero-Mistake Policy*).

---

## 1. Arsitektur Aplikasi & Standar Identitas Sistem

### 1.1 Pemisahan Aplikasi (*App Separation*)
1. **Pariwisloka App (Public Web/Mobile):** Digunakan oleh `Guest` (katalog), `Customer` (pembelian tiket & pengajuan wisata), dan `Owner Wisata` (manajemen wisata, kuota, staf, & penarikan saldo).
2. **Pariwisloka Gate (Mode Khusus di Public App):** Mode layar penuh (*Fullscreen Scanner*) dengan dukungan **Offline-First** khusus `Staff Gate` menggunakan login `venue_code` + `PIN`.
3. **Pariwisloka HQ (Internal Admin Panel - Private Network):** Aplikasi web internal khusus `Internal Admin` untuk memverifikasi dokumen legalitas (KYB) dan memantau arus pencairan dana (*Payout*).

### 1.2 Standar Format Kode Unik (*System Naming Convention*)
| Jenis Identitas | Kolom Database | Format Wajib | Contoh | Aturan Pembuatan |
| :--- | :--- | :--- | :--- | :--- |
| **Kode Wisata** | `venues.venue_code` | `LOKA-XXXX` | `LOKA-0142` | 4 karakter alfanumerik/angka unik, di-generate otomatis saat draf wisata dibuat. |
| **Nomor Invoice** | `transactions.invoice_number` | `PWL/INV/YYYYMMDD/XXXX` | `PWL/INV/20261020/8821` | Kombinasi tanggal transaksi + 4 digit acak unik untuk referensi *Payment Gateway*. |
| **Kode Tiket QR** | `redemptions.ticket_code` | `PWL-TIX-XXXXXXXX` | `PWL-TIX-9F8A7B2C` | String unik per lembar tiket yang di-generate saat *Webhook* `PAID` diterima. |
| **Teks Watermark** | *(File Image Processing)* | `VERIFIKASI RESMI PARIWISLOKA - [YYYY-MM-DD] - HANYA UNTUK INTERNAL` | — | Wajib ditempelkan secara otomatis (*overlay*) di tengah foto KTP & NPWP sebelum masuk ke *Private Cloud Storage*. |

---

## 2. State Machine & Standar Warna Status UI

Seluruh perubahan status di *backend* dan warna *badge* indikator di *frontend* wajib mengikuti tabel di bawah ini. Status menunggu (*waiting/pending*) menggunakan warna **Kuning Pastel** atau **Oranye Pastel**:

| Modul | Kolom Tabel | Nilai Status (*State*) | Warna Indikator UI (Hex) | Pemicu Perpindahan Status (*Allowed Trigger*) |
| :--- | :--- | :--- | :--- | :--- |
| **Verifikasi Legalitas (KYB)** | `owner_legalities.verification_status` | `NOT_SUBMITTED` | Abu-abu (`#E5E7EB`) | Status awal sebelum dokumen diunggah. |
| | | `PENDING` | **Kuning Pastel (`#FEF3C7`)** | Diubah saat Customer mengunggah form wisata + KTP/NPWP/NIB. |
| | | `APPROVED` | Hijau (`#D1FAE5`) | Hanya oleh `Internal Admin`; otomatis mengubah `users.role = 'OWNER'` & `venues.is_published = TRUE`. |
| | | `REJECTED` | Merah (`#FEE2E2`) | Hanya oleh `Internal Admin`; wajib mengisi kolom `rejection_reason`. |
| **Transaksi Pembayaran** | `transactions.payment_status` | `PENDING` | **Oranye Pastel (`#FFEDD5`)** | Saat Checkout berhasil mengunci kuota & menerbitkan QRIS (batas 15 menit). |
| | | `PAID` | Hijau (`#D1FAE5`) | **HANYA** melalui *Webhook* resmi Payment Gateway (dilarang dari *client/frontend*). |
| | | `EXPIRED` | Merah (`#FEE2E2`) | Otomatis oleh *scheduler/check* jika melewati `expired_at` (15 menit) tanpa pembayaran. |
| | | `CANCELLED` | Abu-abu (`#E5E7EB`) | Dibatalkan oleh pengguna sebelum dibayar; melepas kunci kuota harian. |
| **Tiket QR Gate** | `redemptions.status` | `VALID` | Hijau (`#D1FAE5`) | Otomatis dibuat saat transaksi menjadi `PAID`. |
| | | `REDEEMED` | Biru (`#DBEAFE`) | Terkunci permanen pada pemindaian pertama oleh `Staff Gate`. |
| | | `EXPIRED` | Merah (`#FEE2E2`) | Otomatis jika tidak dipindai hingga melewati pukul 23:59 WIB pada `booking_date`. |
| **Penarikan Dana (Payout)** | `payouts.status` | `PENDING` / `PROCESSING` | **Kuning Pastel (`#FEF3C7`)** | Saat Owner meminta tarik dana & menunggu respons API Disbursement. |
| | | `SUCCESS` | Hijau (`#D1FAE5`) | **HANYA** melalui *Webhook* Disbursement Payment Gateway saat transfer berhasil. |
| | | `FAILED` | Merah (`#FEE2E2`) | Melalui *Webhook* Disbursement jika gagal; otomatis mengembalikan saldo ke `available_balance`. |

---

## 3. Skema Database Final (PostgreSQL)

Skema di bawah ini telah mengintegrasikan seluruh perbaikan *Zero-Mistake* (pengunci `venue_code`, `venue_id` pada transaksi, `expired_at`, `is_released` untuk H+1, dan `signature_hash` untuk mode *offline*):

```sql
-- 1. TABEL USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role VARCHAR(20) DEFAULT 'CUSTOMER', -- 'CUSTOMER', 'OWNER'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABEL LEGALITAS OWNER (KYB)
CREATE TABLE owner_legalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    ktp_number VARCHAR(255) NOT NULL,  -- Wajib Enkripsi AES-256
    ktp_photo_url TEXT NOT NULL,       -- Private Bucket + Auto-Watermark
    npwp_number VARCHAR(255) NOT NULL, -- Wajib Enkripsi AES-256
    npwp_photo_url TEXT NOT NULL,      -- Private Bucket + Auto-Watermark
    nib_number VARCHAR(255),
    bank_code VARCHAR(20) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_account_name VARCHAR(100) NOT NULL,
    verification_status VARCHAR(20) DEFAULT 'NOT_SUBMITTED', -- 'NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'
    rejection_reason TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABEL TEMPAT WISATA (VENUES)
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id),
    venue_code VARCHAR(12) UNIQUE NOT NULL, -- Format: LOKA-XXXX (Untuk Login Staff Gate)
    name VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    description TEXT,
    is_published BOOLEAN DEFAULT FALSE, -- Hanya TRUE jika verification_status = 'APPROVED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABEL STAF LOKET (STAFFS)
CREATE TABLE staffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    staff_name VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL, -- Bcrypt / Argon2 Hash dari 6 digit PIN
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABEL PRODUK TIKET (TICKETS)
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    daily_quota INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 6. TABEL TRANSAKSI UTAMA (TRANSACTIONS)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(id),
    venue_id UUID REFERENCES venues(id) NOT NULL, -- Pengunci 1 Invoice = 1 Tempat Wisata
    invoice_number VARCHAR(50) UNIQUE NOT NULL,    -- Format: PWL/INV/YYYYMMDD/XXXX
    total_amount DECIMAL(12, 2) NOT NULL,
    platform_fee DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'PENDING',  -- 'PENDING', 'PAID', 'EXPIRED', 'CANCELLED'
    payment_gateway_ref VARCHAR(100),
    qr_string TEXT,
    expired_at TIMESTAMP NOT NULL,                 -- NOW() + INTERVAL '15 minutes'
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABEL ITEM TRANSAKSI (TRANSACTION_ITEMS)
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id),
    booking_date DATE NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    is_released BOOLEAN DEFAULT FALSE -- Penanda apakah dana sudah dipindah dari pending ke available pada H+1
);

-- 8. TABEL VALIDASI TIKET QR (REDEMPTIONS)
CREATE TABLE redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_item_id UUID REFERENCES transaction_items(id) ON DELETE CASCADE,
    ticket_code VARCHAR(100) UNIQUE NOT NULL, -- Format: PWL-TIX-XXXXXXXX
    signature_hash VARCHAR(255) NOT NULL,     -- HMAC-SHA256 Signature untuk verifikasi Offline
    status VARCHAR(20) DEFAULT 'VALID',       -- 'VALID', 'REDEEMED', 'EXPIRED'
    redeemed_at TIMESTAMP,
    redeemed_by_staff_id UUID REFERENCES staffs(id)
);

-- 9. TABEL BUKU KAS SALDO OWNER (OWNER_BALANCES)
CREATE TABLE owner_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID UNIQUE REFERENCES users(id),
    pending_balance DECIMAL(12, 2) DEFAULT 0,
    available_balance DECIMAL(12, 2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. TABEL MUTASI SALDO (BALANCE_MUTATIONS)
CREATE TABLE balance_mutations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id),
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(30) NOT NULL, -- 'PAYIN_INFLOW', 'HOLDING_RELEASED', 'PAYOUT_WITHDRAW', 'PAYOUT_REFUND'
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. TABEL PENCAIRAN DANA (PAYOUTS)
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id),
    amount DECIMAL(12, 2) NOT NULL,
    admin_fee DECIMAL(12, 2) DEFAULT 0,
    bank_code VARCHAR(20) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_account_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'
    gateway_disbursement_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transferred_at TIMESTAMP
);

-- INDEKS PERFORMA WAJIB
CREATE INDEX idx_venues_city ON venues(city) WHERE is_published = TRUE;
CREATE INDEX idx_redemptions_ticket_code ON redemptions(ticket_code);
CREATE INDEX idx_transaction_items_booking ON transaction_items(booking_date, ticket_id);
CREATE INDEX idx_transactions_status_expiry ON transactions(payment_status, expired_at);
```

---

## 4. Spesifikasi Teknis & Alur Sistem per Modul (Sesuai DFD 1.0 – 5.0)

### Modul 1.0: Autentikasi & Verifikasi Legalitas Owner (KYB)
* **Daftar Endpoint:**
  * `POST /api/v1/auth/login` — Login Customer/Owner via OTP atau Google OAuth.
  * `POST /api/v1/owner/onboarding` — Pengajuan draf tempat wisata + unggah berkas legalitas.
  * `GET /api/v1/admin/legalities` — Daftar pengajuan berstatus `PENDING` (khusus Pariwisloka HQ, mengembalikan *Signed URL* gambar ber-watermark).
  * `PATCH /api/v1/admin/legalities/:id/verify` — Eksekusi `APPROVED` atau `REJECTED` oleh Internal Admin.
* **Aturan Teknis Backend (Zero-Leak):**
  1. Saat menerima unggahan foto KTP dan NPWP, proses di memori server menggunakan *image processing* (misal: `sharp` di Node.js) untuk menempelkan teks watermark `"VERIFIKASI RESMI PARIWISLOKA - [TANGGAL] - HANYA UNTUK INTERNAL"` secara diagonal di atas gambar.
  2. Simpan file hasil watermark ke *Private Cloud Bucket* (bukan *public folder*).
  3. Enkripsi string `ktp_number` dan `npwp_number` menggunakan algoritma **AES-256-CBC/GCM** dengan `ENCRYPTION_KEY` dari *environment variable* sebelum melakukan `INSERT` ke `owner_legalities`.
  4. Saat Admin menyetujui (`APPROVED`), jalankan dalam **1 Database Transaction (`BEGIN ... COMMIT`)**:
     * `UPDATE owner_legalities SET verification_status = 'APPROVED'`
     * `UPDATE users SET role = 'OWNER'`
     * `UPDATE venues SET is_published = TRUE`
     * `INSERT INTO owner_balances (owner_id, pending_balance, available_balance) VALUES (..., 0, 0) ON CONFLICT DO NOTHING`

---

### Modul 2.0: Manajemen Wisata, Kuota Tiket & Staf Gate
* **Daftar Endpoint:**
  * `GET /api/v1/venues?city={city}` — Katalog publik (wajib filter `WHERE is_published = TRUE`).
  * `GET /api/v1/venues/:id/tickets?date={YYYY-MM-DD}` — Detail tiket beserta sisa kuota real-time pada tanggal yang dipilih.
  * `POST /api/v1/owner/tickets` — Tambah/ubah harga dan `daily_quota` tiket.
  * `POST /api/v1/owner/staffs` — Tambah akun petugas loket (`staff_name` + 6 digit `pin`).
* **Aturan Teknis Backend:**
  1. Validasi kepemilikan: setiap perubahan pada `tickets` atau `staffs` wajib memeriksa bahwa `venues.owner_id == current_user.id`.
  2. PIN Staff Gate wajib di-*hash* menggunakan `bcrypt` sebelum disimpan ke `staffs.pin_hash`.

---

### Modul 3.0: Transaksi Tiket, Kunci Kuota & Escrow (Pay-In)
* **Daftar Endpoint:**
  * `POST /api/v1/transactions/checkout` — Buat pesanan & panggil API QRIS Payment Gateway.
  * `POST /api/v1/webhooks/payment` — Endpoint penerima *Webhook* dari Midtrans/Xendit.
* **Algoritma Anti-Overbooking saat Checkout (`POST /api/v1/transactions/checkout`):**
  1. Buka transaksi database dan kunci baris tiket (`SELECT * FROM tickets WHERE id = $1 FOR UPDATE`).
  2. Hitung kuota terpakai pada `booking_date` yang diminta:
     ```sql
     SELECT COALESCE(SUM(ti.quantity), 0) AS used_quota
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     WHERE ti.ticket_id = $1
       AND ti.booking_date = $2
       AND (
         t.payment_status = 'PAID'
         OR (t.payment_status = 'PENDING' AND t.expired_at > NOW())
       );
     ```
  3. Jika `(used_quota + requested_quantity) > ticket.daily_quota`, batalkan transaksi (`ROLLBACK`) dan kembalikan HTTP `409 Conflict` (*"Kuota tiket untuk tanggal tersebut sudah habis"*).
  4. Jika kuota cukup, simpan ke `transactions` (`payment_status = 'PENDING'`, `expired_at = NOW() + INTERVAL '15 minutes'`) dan `transaction_items`, lalu panggil API Payment Gateway untuk mendapatkan `qr_string`.
* **Algoritma Penerimaan Webhook Lunas (`POST /api/v1/webhooks/payment`):**
  1. **Wajib Verifikasi Signature:** Cocokkan *signature hash* pada header *webhook* dengan *Server Key* Payment Gateway. Jika tidak cocok, tolak dengan HTTP `401 Unauthorized`.
  2. **Idempotency & Locking:** Kunci baris transaksi (`SELECT * FROM transactions WHERE invoice_number = $1 FOR UPDATE`). Jika `payment_status == 'PAID'`, langsung kembalikan HTTP `200 OK` tanpa memproses ulang (mencegah saldo masuk ganda jika *webhook* dikirim dua kali).
  3. Jika status valid berubah menjadi `PAID`, jalankan dalam **1 Database Transaction**:
     * Update `transactions`: `payment_status = 'PAID'`, `paid_at = NOW()`.
     * *Looping* sebanyak `quantity` pada `transaction_items` untuk membuat baris di tabel `redemptions`:
       * Generate `ticket_code` (`PWL-TIX-XXXXXXXX`).
       * Buat `signature_hash = HMAC_SHA256(ticket_code + ":" + venue_id + ":" + booking_date, QR_SECRET_KEY)`.
     * Hitung pendapatan bersih: `net_amount = total_amount - platform_fee`.
     * Tambahkan ke saldo tertahan Owner:
       ```sql
       UPDATE owner_balances
       SET pending_balance = pending_balance + $1, updated_at = NOW()
       WHERE owner_id = $2;
       ```
     * Catat ke `balance_mutations` dengan `type = 'PAYIN_INFLOW'`, `amount = net_amount`, dan `reference_id = transaction.id`.

---

### Modul 4.0: Validasi Gate & Mode Offline-First (Redemption)
* **Daftar Endpoint:**
  * `POST /api/v1/gate/login` — Login Staff Gate menggunakan `venue_code` (contoh: `LOKA-0142`) + `pin`. Mengembalikan token JWT khusus Staff yang berisi `staff_id`, `venue_id`, dan `QR_PUBLIC_VERIFY_KEY`.
  * `GET /api/v1/gate/sync?date={YYYY-MM-DD}` — Mengunduh daftar seluruh tiket `VALID` dan `REDEEMED` pada tanggal tersebut untuk disimpan di *local storage* HP petugas (SQLite / IndexedDB).
  * `POST /api/v1/gate/scan` — Memvalidasi 1 kode QR secara *real-time* (saat *online*).
  * `POST /api/v1/gate/sync-redeemed` — Mengunggah antrean tiket yang di-scan saat HP sedang *offline* (*batch sync*).
* **Format Payload QR E-Ticket:**
  Agar bisa divalidasi saat *offline*, QR Code yang ditampilkan di HP Customer berisi JSON terkompresi/string berformat:
  `{ticket_code}|{venue_id}|{booking_date}|{signature_hash}`
* **Logika Pemindaian di Aplikasi Pariwisloka Gate:**
  1. **Saat Online:** Kirim `ticket_code` ke `POST /api/v1/gate/scan`. Server melakukan `SELECT ... FOR UPDATE` pada tabel `redemptions`:
     * Jika `status == 'VALID'` dan `booking_date == TODAY`: ubah menjadi `REDEEMED`, isi `redeemed_at = NOW()`, `redeemed_by_staff_id = current_staff.id`, kembalikan respons **VALID (Hijau)**.
     * Jika `status == 'REDEEMED'`: tolak dan kembalikan respons **SUDAH DIPAKAI pada [redeemed_at] (Merah)**.
  2. **Saat Offline (Tanpa Sinyal):**
     * Cek apakah `ticket_code` ada di *local database* HP staf:
       * Jika ada dan berstatus `REDEEMED` $\rightarrow$ Tolak (**Merah**).
       * Jika ada dan berstatus `VALID` $\rightarrow$ Ubah status di *local database* menjadi `REDEEMED`, masukkan ke *Offline Sync Queue*, tampilkan **VALID (Hijau)**.
     * **Kasus Pembelian Dadakan (*On-The-Spot*) saat HP Staf Offline:** Jika `ticket_code` belum ada di *local database* HP staf (karena pengunjung baru beli tiket siang hari saat staf sudah offline), aplikasi staf mengecek kecocokan `venue_id`, `booking_date == TODAY`, dan menghitung ulang `HMAC_SHA256` dari payload QR. Jika tanda tangan kriptografi cocok dan belum pernah di-scan di HP tersebut, terima tiket (**Hijau**), simpan ke *local database* sebagai `REDEEMED`, dan masukkan ke *Offline Sync Queue*.

---

### Modul 5.0: Pelepasan Saldo (Holding H+1) & Penarikan Dana (Pay-Out)
* **Daftar Komponen & Endpoint:**
  * **Cron Job / Scheduler (`releaseHoldingBalances`):** Berjalan otomatis setiap hari pukul **23:59 WIB**.
  * `POST /api/v1/owner/payouts` — Pengajuan tarik dana oleh Owner.
  * `POST /api/v1/webhooks/disbursement` — Webhook status transfer bank dari Payment Gateway.
* **Algoritma Cron Job H+1 (Pukul 23:59 WIB):**
  1. Cari seluruh transaksi yang masa kunjungannya sudah lewat H+1 dan belum pernah dirilis:
     ```sql
     SELECT ti.id AS item_id, t.id AS transaction_id, v.owner_id,
            (t.total_amount - t.platform_fee) AS net_amount
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     JOIN venues v ON t.venue_id = v.id
     WHERE t.payment_status = 'PAID'
       AND ti.is_released = FALSE
       AND ti.booking_date <= CURRENT_DATE - INTERVAL '1 day'
     FOR UPDATE;
     ```
  2. Dalam satu transaksi database per baris:
     * Kurangi `pending_balance` dan tambahkan `available_balance` pada `owner_balances` sebesar `net_amount`.
     * Masukkan catatan ke `balance_mutations` dengan `type = 'HOLDING_RELEASED'`.
     * Update `transaction_items SET is_released = TRUE`.
* **Algoritma Penarikan Dana (`POST /api/v1/owner/payouts`):**
  1. Kunci baris saldo Owner (`SELECT * FROM owner_balances WHERE owner_id = $1 FOR UPDATE`).
  2. Validasi `requested_amount <= available_balance`. Jika kurang, tolak dengan HTTP `400 Bad Request`.
  3. **Keamanan Rekening Tujuan:** Ambil `bank_code`, `bank_account_number`, dan `bank_account_name` langsung dari tabel `owner_legalities WHERE user_id = $1 AND verification_status = 'APPROVED'`. **Dilarang keras** menerima nomor rekening dari input *body request* API.
  4. Potong `available_balance = available_balance - requested_amount`, buat baris di tabel `payouts` (`status = 'PROCESSING'`), catat di `balance_mutations` (`type = 'PAYOUT_WITHDRAW'`), lalu panggil API Disbursement Payment Gateway.
  5. Jika *Webhook* Disbursement mengembalikan `FAILED`, jalankan transaksi pengembalian dana: tambahkan kembali `available_balance`, ubah `payouts.status = 'FAILED'`, dan catat `balance_mutations` dengan `type = 'PAYOUT_REFUND'`.

---

## 5. Instruksi Guardrail untuk AI Coding Agent

Jika kamu adalah *AI Coding Assistant* yang membaca file ini, patuhi **5 Aturan Keras** berikut saat menghasilkan kode:
1. **Jangan Buat Endpoint Client untuk Ubah Status Uang:** Jangan pernah membuat *endpoint* `PUT/PATCH` yang mengizinkan aplikasi *frontend* mengubah `payment_status` menjadi `PAID` atau `payouts.status` menjadi `SUCCESS`. Perubahan tersebut hanya boleh terjadi di dalam *Webhook Handler* yang memvalidasi * cryptographic signature* dari Payment Gateway.
2. **Wajib Gunakan Database Transaction & Row Locking:** Setiap fungsi yang menyentuh tabel `owner_balances`, `balance_mutations`, `redemptions`, atau pengecekan kuota `tickets` wajib menggunakan transaksi SQL (`BEGIN ... COMMIT/ROLLBACK`) dan `SELECT ... FOR UPDATE` untuk mencegah *race condition*.
3. **Jangan Ekspos Kolom Sensitif di API Response:** Jangan pernah mengembalikan `ktp_number`, `npwp_number` (meskipun terenkripsi), atau `pin_hash` pada respons JSON untuk *endpoint* publik.
4. **Satu Transaksi Satu Tempat Wisata:** Validasi pada saat checkout bahwa seluruh tiket yang dibeli berada di dalam `venue_id` dan `booking_date` yang sama agar perhitungan potongan `platform_fee` serta jadwal rilis H+1 tidak tercampur.
5. **Gunakan Sandbox Environment Variabel:** Seluruh kredensial Payment Gateway, kunci AES-256 (`ENCRYPTION_KEY`), dan kunci HMAC QR (`QR_SECRET_KEY`) wajib diambil dari `.env` dan tidak boleh ditulis langsung (*hardcoded*) di dalam kode sumber.

---

## 6. Urutan Pengerjaan (*Development Checklist*)

- [ ] **Tahap 1 (Database & Setup):** Inisialisasi proyek, konfigurasi `.env`, dan jalankan *migration* 11 tabel PostgreSQL beserta indeksnya.
- [ ] **Tahap 2 (Modul 1.0 - Auth & KYB):** Buat login JWT, *service* enkripsi AES-256 + *auto-watermark* foto KTP/NPWP, dan endpoint *Approve/Reject* untuk Pariwisloka HQ.
- [ ] **Tahap 3 (Modul 2.0 - Venue & Master Tiket):** Buat CRUD tempat wisata (otomatis generate `LOKA-XXXX`), pengaturan kuota harian tiket, pembuatan PIN Staf, dan API katalog publik per kota.
- [ ] **Tahap 4 (Modul 3.0 - Checkout & Webhook QRIS):** Buat logika kunci kuota harian (15 menit), integrasi QRIS Sandbox, dan *webhook* `PAID` yang menerbitkan `PWL-TIX-XXXXXXXX` beserta penambahan `pending_balance`.
- [ ] **Tahap 5 (Modul 4.0 - Pariwisloka Gate Offline-First):** Buat login Staf, API unduh tiket harian, generator/validator HMAC QR, dan *endpoint sync* pemindaian tiket.
- [ ] **Tahap 6 (Modul 5.0 - Scheduler H+1 & Payout):** Buat *cron job* pukul 23:59 WIB untuk pelepasan `pending_balance` $\rightarrow$ `available_balance`, serta *endpoint* penarikan dana dan *webhook* Disbursement.