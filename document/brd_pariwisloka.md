# 🌏 PARIWISLOKA — Business Requirements Document (BRD)

> **Dokumen Acuan Utama (Single Source of Truth)**  
> Dokumen ini berisi landasan bisnis, aturan keuangan (*Escrow*), batasan hak akses, dan kebijakan operasional **Pariwisloka** (*Pariwisata & Lokasi*).  
> **Instruksi untuk Developer & AI Agent:** Seluruh logika bisnis, validasi *backend*, dan alur antarmuka **wajib** mematuhi aturan di dalam dokumen ini tanpa pengecualian (*Zero-Mistake Policy*).

---

## 1. Identitas & Visi Produk

* **Nama Produk:** **Pariwisloka** (Perpaduan dari *Pariwisata* dan *Lokasi*).
* **Kategori Sistem:** *Multi-Tenancy SaaS E-Ticketing & Location-Based Event/Venue Discovery Platform*.
* **Model Bisnis:** B2B2C (*Business-to-Business-to-Consumer*).
* **Visi Utama:**
  1. Mendigitalisasi penjualan tiket tempat wisata lokal berbasis lokasi/kota dengan sistem pembayaran QRIS terpusat (*Escrow*).
  2. Melindungi keamanan dana pengunjung dan pemilik wisata melalui mekanisme masa tahan dana (*Holding Period* $H+1$).
  3. Menjamin legalitas mitra pengelola wisata melalui verifikasi dokumen resmi (KTP, NPWP, NIB) dengan komitmen nol kebocoran data (*Zero-Leak Commitment*).
  4. Memastikan operasional gerbang wisata tetap berjalan lancar meskipun lokasi wisata mengalami kendala sinyal internet (*Offline-First Gate Validation*).

---

## 2. Pemisahan Ekosistem Aplikasi (*App Separation*)

Demi menjaga privasi data dan keamanan operasional, ekosistem **Pariwisloka** dipisahkan menjadi 3 antarmuka/aplikasi yang terhubung ke satu *Core Backend*:

| Nama Aplikasi | Target Pengguna | Sifat Jaringan | Fungsi Bisnis Utama |
| :--- | :--- | :--- | :--- |
| **1. Pariwisloka App** | *Guest*, *Customer*, *Owner Wisata* | Publik (*Play Store / App Store / Web*) | Pencarian wisata per kota, pembelian tiket QRIS, penyimpanan *E-Ticket*, pendaftaran mitra wisata (KYB), serta manajemen tiket & pencairan dana bagi Owner. |
| **2. Pariwisloka Gate** | *Staff Gate* (Petugas Loket) | Publik (*Mode Khusus Staf pada App*) | Login cepat via Kode Wisata + PIN, unduh data tiket harian (*Offline Sync*), dan pemindaian QR *E-Ticket* layar penuh. |
| **3. Pariwisloka HQ** | *Internal Admin* | Privat (*Internal Private Web Panel*) | Pemeriksaan berkas KTP/NPWP/NIB ber-*watermark*, persetujuan publikasi tempat wisata, serta pengawasan mutasi & pencairan saldo (*Payout*). |

---

## 3. Standar Penamaan & Identitas Sistem (*Naming Conventions*)

Seluruh tim dan *AI Agent* wajib menggunakan format penamaan resmi berikut di dalam database, *API payload*, maupun tampilan UI:

| Komponen | Format Standar | Contoh Implementasi | Aturan Penggunaan |
| :--- | :--- | :--- | :--- |
| **Kode Tempat Wisata (`venue_code`)** | `LOKA-XXXX` | `LOKA-0142` | Dibuat otomatis saat draf wisata diajukan; digunakan bersama PIN 6 digit untuk login **Staff Gate**. |
| **Nomor Invoice (`invoice_number`)** | `PWL/INV/YYYYMMDD/XXXX` | `PWL/INV/20261020/8821` | Nomor referensi unik setiap transaksi pembelian tiket yang dikirim ke *Payment Gateway*. |
| **Kode Tiket QR (`ticket_code`)** | `PWL-TIX-XXXXXXXX` | `PWL-TIX-9A8B7C6D` | Kode unik per lembar tiket di tabel `redemptions` yang dipindai di gerbang wisata. |
| **Teks *Watermark* Dokumen** | `VERIFIKASI RESMI PARIWISLOKA - [YYYY-MM-DD] - INTERNAL ONLY` | `VERIFIKASI RESMI PARIWISLOKA - 2026-10-20 - INTERNAL ONLY` | Wajib ditempelkan otomatis pada gambar KTP & NPWP sebelum disimpan ke *private cloud storage*. |

---

## 4. Matriks Hak Akses & Batasan Aktor (*Role-Based Access Control*)

| Aktor (*Role*) | Metode Masuk | Hak Akses Bisnis (*Allowed*) | Larangan Keras (*Strictly Forbidden*) |
| :--- | :--- | :--- | :--- |
| **Guest (Tamu)** | Tanpa Login | • Menjelajahi katalog wisata berdasarkan lokasi/kota.<br>• Melihat detail wisata, harga tiket, dan ketersediaan kuota. | • Membeli tiket.<br>• Mengajukan pendaftaran tempat wisata. |
| **Customer** | OTP / Google Auth | • Membeli tiket wisata via QRIS.<br>• Menyimpan QR *E-Ticket* & melihat riwayat transaksi.<br>• Mengajukan draf tempat wisata & dokumen legalitas untuk menjadi Owner. | • Membatalkan tiket yang sudah terpakai (`REDEEMED`).<br>• Mengubah status pembayaran secara sepihak dari sisi aplikasi klien. |
| **Owner Wisata** | Akun Customer yang Disetujui Admin (`APPROVED`) | • Mengelola detail lokasi wisata, jenis tiket, harga, dan kuota harian.<br>• Membuat & menonaktifkan akun/PIN **Staff Gate**.<br>• Melihat laporan omzet & menarik saldo siap tarik (*Payout*). | • Memublikasikan tempat wisata sendiri tanpa persetujuan Admin.<br>• Mengganti nomor rekening tujuan *Payout* secara manual di luar rekening yang telah diverifikasi Admin. |
| **Staff Gate** | `venue_code` (`LOKA-XXXX`) + PIN 6 Digit | • Mengunduh daftar tiket valid hari tersebut ke memori lokal (*Offline Mode*).<br>• Memindai dan memvalidasi QR *E-Ticket* pengunjung. | • Melihat saldo, laporan omzet, atau data keuangan Owner.<br>• Mengubah harga atau kuota tiket harian. |
| **Internal Admin** | Kredensial Internal (*Pariwisloka HQ*) | • Melihat berkas KTP/NPWP ber-*watermark* & nomor identitas yang didekripsi.<br>• Menyetujui (`APPROVED`) atau menolak (`REJECTED`) pengajuan Owner.<br>• Memantau arus kas *Escrow* & mutasi *Payout*. | • Mengubah angka saldo Owner secara manual tanpa melalui mutasi transaksi resmi sistem. |

---

## 5. Aturan Keuangan & Rumus Bisnis (*Escrow Financial Architecture*)

**Pariwisloka** bertindak sebagai pemegang rekening penampungan bersama (*Escrow Account*) melalui *Payment Gateway* (Midtrans / Xendit). Seluruh perhitungan uang wajib mengikuti rumus pasti berikut:

### 5.1 Alur Uang Masuk (*Pay-In*) & Pemotongan Komisi
Saat pengunjung membayar tiket via QRIS dan sistem menerima konfirmasi lunas (`PAID`) dari *Webhook Payment Gateway*:
1. Sistem memotong biaya layanan platform (*Platform Fee*) per transaksi/tiket.
2. Pendapatan bersih Owner dihitung dengan rumus:
   $$\text{Net Revenue Owner} = \text{Total Amount} - \text{Platform Fee}$$
3. Nominal $\text{Net Revenue Owner}$ **dilarang** langsung masuk ke saldo aktif, melainkan wajib masuk ke **Saldo Tertahan (`pending_balance`)** milik Owner:
   $$\text{pending\_balance}_{\text{baru}} = \text{pending\_balance}_{\text{lama}} + \text{Net Revenue Owner}$$
4. Sistem mencatat riwayat di `balance_mutations` dengan tipe `PAYIN_INFLOW`.

### 5.2 Skema Masa Tahan Dana (*Holding Period* $H+1$)
Untuk memitigasi risiko sengketa (misal: tempat wisata tutup mendadak pada hari kunjungan), dana dikunci di `pending_balance` hingga masa kunjungan selesai:
1. Pelepasan dana dilakukan oleh penjadwal otomatis (*Cron Job*) tepat pada **$H+1$ pukul 23:59 WIB** setelah tanggal kunjungan tiket (`booking_date`).
2. Rumus perpindahan saldo pada $H+1$ pukul 23:59 WIB:
   $$\text{pending\_balance}_{\text{baru}} = \text{pending\_balance}_{\text{lama}} - \text{Nominal Rilis}$$
   $$\text{available\_balance}_{\text{baru}} = \text{available\_balance}_{\text{lama}} + \text{Nominal Rilis}$$
3. Sistem mencatat riwayat di `balance_mutations` dengan tipe `HOLDING_RELEASED`.

### 5.3 Alur Uang Keluar (*Pay-Out / Disbursement*)
1. Owner hanya dapat mengajukan penarikan dana dengan syarat:
   $$\text{Nominal Penarikan} \le \text{available\_balance}$$
2. Biaya administrasi transfer antarbank (*Disbursement Fee*) ditanggung oleh Owner:
   $$\text{Dana Diterima di Rekening} = \text{Nominal Penarikan} - \text{Biaya Admin Bank}$$
3. Saat penarikan diajukan, `available_balance` langsung dipotong sebesar $\text{Nominal Penarikan}$ dan dicatat sebagai mutasi `PAYOUT_WITHDRAW`.
4. **Mitigasi Gagal Transfer:** Jika pihak bank/*Payment Gateway* mengembalikan status `FAILED`, sistem wajib mengembalikan $\text{Nominal Penarikan}$ secara utuh ke `available_balance` dan mencatat mutasi `PAYOUT_REFUND`.

---

## 6. Hukum Bisnis Mutlak (*Business Invariants / Golden Rules*)

Bagian ini adalah **aturan pengunci (*guardrails*)** yang wajib dipatuhi oleh *developer* maupun *AI Agent* saat mengembangkan sistem:

1. **Aturan Publikasi Terkunci Legalitas (*KYB Lock*):**
   * Tempat wisata tidak boleh tampil di katalog publik (`venues.is_published` harus bernilai `FALSE`) selama status legalitas Owner (`owner_legalities.verification_status`) belum berstatus `APPROVED`.
   * Persetujuan Admin (`APPROVED`) harus secara otomatis mengubah `users.role` menjadi `'OWNER'` dan `venues.is_published` menjadi `TRUE` dalam satu kesatuan transaksi database (*atomic transaction*).
2. **Aturan Satu Transaksi Satu Destinasi (*Single-Venue Checkout*):**
   * Satu nomor invoice (`transactions`) hanya boleh memuat pembelian tiket untuk **1 tempat wisata (`venue_id`)** dan **1 tanggal kunjungan (`booking_date`)**. Hal ini wajib dikunci agar perhitungan `pending_balance` dan jadwal rilis $H+1$ per Owner tidak pernah tercampur.
3. **Aturan Anti-*Overbooking* Kuota Harian:**
   * Kuota tiket (`daily_quota`) dihitung per tanggal kunjungan (`booking_date`).
   * Saat pengguna melakukan *checkout*, sistem wajib menghitung ketersediaan kuota dengan mengikutsertakan transaksi yang sudah `PAID` **ditambah** transaksi yang masih `PENDING` (belum melewati batas kedaluwarsa 15 menit):
     $$\text{Sisa Kuota Tanggal } T = \text{daily\_quota} - \left( \sum \text{Tiket}_{\text{PAID}}(T) + \sum \text{Tiket}_{\text{PENDING Aktif}}(T) \right)$$
4. **Aturan Kebenaran Pembayaran Satu Pintu (*Webhook-Only Authority*):**
   * Status transaksi `PAID`, penerbitan tiket `VALID`, dan penambahan `pending_balance` **hanya boleh dipicu oleh *Webhook* resmi dari *Payment Gateway*** yang telah terverifikasi tanda tangan kriptografinya (*signature verification*). Aplikasi klien (HP/Web pengguna) dilarang keras memiliki akses untuk mengubah status pembayaran.
5. **Aturan Anti-*Screenshot* & Mode *Offline-First* di Loket:**
   * Setiap lembar tiket (`redemptions`) hanya dapat dipindai **1 kali** (`VALID` $\rightarrow$ `REDEEMED`). Pemindaian kedua pada kode tiket yang sama wajib ditolak disertai informasi waktu pemindaian pertama.
   * Setiap QR *E-Ticket* wajib memiliki tanda tangan digital (*HMAC Signature*) yang mengikat `ticket_code`, `venue_id`, dan `booking_date` agar aplikasi **Pariwisloka Gate** tetap dapat memvalidasi tiket asli secara *offline* meskipun tiket baru dibeli pengunjung beberapa menit sebelum tiba di loket.
6. **Aturan Privasi Dokumen Legalitas (*Zero-Leak Commitment*):**
   * Nomor KTP dan NPWP wajib disimpan dalam bentuk terenkripsi (**AES-256**) di database.
   * File foto KTP dan NPWP wajib diberi *watermark* otomatis dan disimpan di dalam *private storage bucket* (tidak boleh memiliki *public URL* bebas).
7. **Kebijakan Tiket Tidak Terpakai (*No-Show Policy*):**
   * Apabila tiket berstatus `PAID` tidak dipindai oleh pengunjung hingga melewati pukul 23:59 WIB pada `booking_date`, status tiket otomatis berubah menjadi `EXPIRED`, namun dana penjualan tiket tersebut **tetap menjadi hak Owner** dan tetap dicairkan ke `available_balance` pada $H+1$.

---

## 7. Standar Status & Indikator Antarmuka (*State Machine & UI Standard*)

Untuk menjaga konsistensi komunikasi visual di seluruh aplikasi **Pariwisloka**, setiap status bisnis mengikuti panduan berikut:

| Modul Bisnis | Status Sistem | Makna Bisnis | Standar Warna UI |
| :--- | :--- | :--- | :--- |
| **Verifikasi Legalitas (KYB)** | `NOT_SUBMITTED` | Pengguna belum mengajukan berkas wisata. | Abu-abu (*Neutral*) |
| | `PENDING` | Berkas sedang diperiksa oleh Internal Admin. | **Kuning Pastel / Oranye Pastel** |
| | `APPROVED` | Berkas disetujui, wisata aktif tayang. | Hijau (*Success*) |
| | `REJECTED` | Berkas ditolak, wajib menampilkan alasan penolakan. | Merah (*Danger*) |
| **Transaksi Pembayaran** | `PENDING` | Menunggu pembayaran QRIS (Batas 15 menit). | **Kuning Pastel / Oranye Pastel** |
| | `PAID` | Pembayaran lunas via *Webhook*, QR Tiket aktif. | Hijau (*Success*) |
| | `EXPIRED` / `CANCELLED` | Melewati batas 15 menit atau dibatalkan; kuota dilepas. | Merah / Abu-abu |
| **Status Tiket (`redemptions`)** | `VALID` | Tiket siap dipindai di gerbang wisata. | Hijau (*Success*) |
| | `REDEEMED` | Tiket sudah dipindai masuk (tidak bisa dipakai ulang). | Biru / Abu-abu |
| | `EXPIRED` | Lewat tanggal kunjungan tanpa digunakan (*No-Show*). | Merah (*Danger*) |
| **Pencairan Dana (`payouts`)** | `PENDING` / `PROCESSING` | Permintaan transfer sedang diproses ke bank tujuan. | **Kuning Pastel / Oranye Pastel** |
| | `SUCCESS` | Dana berhasil masuk ke rekening bank Owner. | Hijau (*Success*) |
| | `FAILED` | Transfer gagal, saldo telah dikembalikan ke `available_balance`. | Merah (*Danger*) |

---

## 8. Batasan di Luar Ruang Lingkup (*Out-of-Scope* Tahap Awal)

Agar tim pengembang dan *AI Agent* tetap fokus dan tidak menambahkan fitur di luar rancangan (*feature creep*), fitur-fitur berikut **tidak termasuk** dalam pengembangan tahap awal:
* ❌ Keranjang belanja lintas tempat wisata (*Multi-venue shopping cart* dalam 1 invoice).
* ❌ Pemilihan nomor kursi spesifik (*Seat map selection*).
* ❌ Metode pembayaran selain QRIS (seperti Kartu Kredit, *Paylater*, atau *Virtual Account* multi-bank).
* ❌ Biaya langganan bulanan (*Monthly subscription fee*) untuk Owner Wisata (monetisasi murni dari *Platform Fee* per transaksi).
* ❌ Pengembalian dana otomatis (*Self-service refund*) oleh pengunjung melalui aplikasi.