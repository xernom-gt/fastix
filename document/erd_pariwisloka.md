# 🗂️ Analisis ERD — Pariwisloka

Sumber: `brd_pariwisloka.md` + `prd_pariwisloka.md` (Skema PostgreSQL 11 tabel).
File diagram siap import draw.io: `erd_pariwisloka.mmd`.

## Cara Import ke draw.io
1. Buka https://app.diagrams.net
2. Menu **Arrange → Insert → Advanced → Mermaid…**
3. Paste seluruh isi `erd_pariwisloka.mmd` → **Insert**.
4. Atur ulang posisi tabel (drag) sesuai kebutuhan.

> Alternatif tanpa relasi: **Arrange → Insert → Advanced → SQL** lalu paste blok `CREATE TABLE` dari PRD (draw.io hanya membuat tabel, garis relasi digambar manual).

## Entitas & Pengelompokan

| Domain | Tabel | Keterangan |
|---|---|---|
| Identitas & KYB | `users`, `owner_legalities` | 1 user punya maks 1 berkas legalitas (`user_id` UNIQUE) |
| Venue | `venues`, `staffs`, `tickets` | Venue milik owner; staff & jenis tiket per venue |
| Transaksi | `transactions`, `transaction_items`, `redemptions` | 1 invoice = 1 venue; tiap qty → 1 redemption (QR) |
| Keuangan (Escrow) | `owner_balances`, `balance_mutations`, `payouts` | Saldo pending/available, buku mutasi, tarik dana |

## Relasi (Kardinalitas)

| Dari | Ke | Kardinalitas | FK |
|---|---|---|---|
| users | owner_legalities | 1 : 0..1 | `owner_legalities.user_id` |
| users | venues | 1 : 0..N | `venues.owner_id` |
| users | transactions | 1 : 0..N | `transactions.customer_id` |
| users | owner_balances | 1 : 0..1 | `owner_balances.owner_id` |
| users | balance_mutations | 1 : 0..N | `balance_mutations.owner_id` |
| users | payouts | 1 : 0..N | `payouts.owner_id` |
| venues | staffs | 1 : 0..N | `staffs.venue_id` |
| venues | tickets | 1 : 0..N | `tickets.venue_id` |
| venues | transactions | 1 : 0..N | `transactions.venue_id` |
| transactions | transaction_items | 1 : 1..N | `transaction_items.transaction_id` |
| tickets | transaction_items | 1 : 0..N | `transaction_items.ticket_id` |
| transaction_items | redemptions | 1 : 0..N | `redemptions.transaction_item_id` |
| staffs | redemptions | 1 : 0..N | `redemptions.redeemed_by_staff_id` |
| balance_mutations | transactions / payouts | polimorfik | `reference_id` (tanpa FK) |

## Catatan / Celah yang Ditemukan

> [!WARNING]
> Hal-hal ini tidak tercakup skema PRD — putuskan sebelum migrasi:

1. **Tabel Internal Admin tidak ada.** BRD menyebut aktor *Internal Admin* (HQ), tapi tidak ada tabel `admins`. Saran: tabel `admins` (id, email, password_hash, name) + kolom `owner_legalities.verified_by_admin_id`.
2. **`users.role` belum ada `ADMIN`.** Hanya `CUSTOMER | OWNER`.
3. **Relasi legalitas ↔ venue tidak eksplisit.** KYB per user, publikasi per venue. Jika owner punya >1 venue, venue baru otomatis ikut APPROVED — perlu dipastikan sesuai bisnis.
4. **`booking_date` ada di `transaction_items`**, padahal aturan *1 invoice = 1 tanggal*. Lebih aman dipindah/ditambah ke `transactions.booking_date`.
5. **`balance_mutations.reference_id` polimorfik** tanpa FK. Saran: tambah `reference_type` (`TRANSACTION|PAYOUT`).
6. **Status pakai `VARCHAR`.** Saran: PostgreSQL `ENUM` atau `CHECK` constraint agar sesuai state machine.
7. **Data katalog minim** untuk FE: belum ada `category`, `image_url`/galeri, jam buka, rating. Perlu tabel `venue_images` / kolom tambahan jika landing menampilkannya.
8. **Antrian offline sync** di Gate tersimpan di HP, bukan DB — tidak perlu tabel.
