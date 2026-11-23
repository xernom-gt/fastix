package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// SeedDev populates initial demo accounts, venues, tickets, and gate staff in development.
func SeedDev(ctx context.Context, pool *pgxpool.Pool) (bool, error) {
	customerSeeded, err := seedDefaultCustomer(ctx, pool)
	if err != nil {
		return false, err
	}

	var hasVenues bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM venues LIMIT 1)`).Scan(&hasVenues); err != nil {
		return customerSeeded, fmt.Errorf("check existing venues: %w", err)
	}
	if hasVenues {
		return customerSeeded, nil
	}

	ownerPasswordHash, err := bcrypt.GenerateFromPassword([]byte("fastixdev123"), bcrypt.DefaultCost)
	if err != nil {
		return false, fmt.Errorf("hash demo owner password: %w", err)
	}
	pinBaliHash, err := bcrypt.GenerateFromPassword([]byte("482910"), bcrypt.DefaultCost)
	if err != nil {
		return false, fmt.Errorf("hash bali staff pin: %w", err)
	}
	pinJogjaHash, err := bcrypt.GenerateFromPassword([]byte("731920"), bcrypt.DefaultCost)
	if err != nil {
		return false, fmt.Errorf("hash jogja staff pin: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin dev seed tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var ownerID string
	err = tx.QueryRow(ctx, `
		INSERT INTO users (phone_number, full_name, email, password_hash, role, is_verified)
		VALUES ('081234567001', 'Bagus Mahendra', 'bagus@tirtagangga.id', $1, 'MITRA', TRUE)
		ON CONFLICT (email) DO UPDATE SET
			role = 'MITRA',
			is_verified = TRUE,
			updated_at = NOW()
		RETURNING id::text
	`, string(ownerPasswordHash)).Scan(&ownerID)
	if err != nil {
		return false, fmt.Errorf("seed demo owner: %w", err)
	}

	var legalityID string
	err = tx.QueryRow(ctx, `
		INSERT INTO owner_legalities (
			user_id, ktp_number, ktp_photo_url, npwp_number, npwp_photo_url,
			nib_number, bank_code, bank_account_number, bank_account_name,
			verification_status, verified_at
		)
		VALUES (
			$1::uuid, 'dev-enc-ktp', 'https://example.com/ktp-demo.jpg',
			'dev-enc-npwp', 'https://example.com/npwp-demo.jpg',
			'1234567890123', 'BCA', '0401234567', 'Bagus Mahendra',
			'APPROVED', NOW()
		)
		ON CONFLICT (user_id) DO UPDATE SET
			verification_status = 'APPROVED',
			updated_at = NOW()
		RETURNING id::text
	`, ownerID).Scan(&legalityID)
	if err != nil {
		return false, fmt.Errorf("seed demo owner legality: %w", err)
	}

	type seedVenue struct {
		venueCode   string
		name        string
		kotaKode    string
		city        string
		lokasi      string
		address     string
		jamBuka     string
		kategori    string
		hargaMulai  int64
		rating      float64
		ulasan      int
		fasilitas   []string
		gambarURL   string
		gambarAlt   string
		lat         float64
		lng         float64
		description string
		staffName   string
		staffPin    string
		tickets     []struct {
			title string
			desc  string
			price int64
			quota int
		}
	}

	venues := []seedVenue{
		{
			venueCode:   "LOKA-0142",
			name:        "Tirta Gangga Water Palace",
			kotaKode:    "bali",
			city:        "Karangasem",
			lokasi:      "Karangasem, Bali",
			address:     "Jl. Raya Abang Desa Adat, Ababi, Karangasem, Bali 80852",
			jamBuka:     "08:00 - 17:00 WITA",
			kategori:    "candi_sejarah",
			hargaMulai:  50000,
			rating:      4.9,
			ulasan:      840,
			fasilitas:   []string{"Area Parkir", "Toilet", "Spot Foto", "Kafe Taman"},
			gambarURL:   "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
			gambarAlt:   "Kolam taman air Tirta Gangga di Karangasem Bali",
			lat:         -8.4123,
			lng:         115.5873,
			description: "Taman air kerajaan bersejarah di Bali Timur dengan kolam batu pijakan ikonik dan mata air pegunungan.",
			staffName:   "Made Wirawan",
			staffPin:    string(pinBaliHash),
			tickets: []struct {
				title string
				desc  string
				price int64
				quota int
			}{
				{title: "Tiket Masuk Reguler", desc: "Akses seluruh area taman air pukul 08:00-17:00 WITA", price: 50000, quota: 300},
				{title: "Paket Foto & Feeding Ikan", desc: "Tiket masuk plus pakan ikan koi di kolam utama", price: 85000, quota: 120},
			},
		},
		{
			venueCode:   "LOKA-0315",
			name:        "Candi Prambanan Heritage",
			kotaKode:    "jogja",
			city:        "Sleman",
			lokasi:      "Sleman, D.I. Yogyakarta",
			address:     "Jl. Raya Solo - Yogyakarta No.16, Kranggan, Bokoharjo, Sleman, DIY 55571",
			jamBuka:     "06:30 - 17:00 WIB",
			kategori:    "candi_sejarah",
			hargaMulai:  50000,
			rating:      4.9,
			ulasan:      1520,
			fasilitas:   []string{"Area Parkir", "Museum", "Toilet", "Pusat Kuliner", "Mushola"},
			gambarURL:   "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1200&q=80",
			gambarAlt:   "Kompleks Candi Prambanan di Sleman Yogyakarta",
			lat:         -7.7520,
			lng:         110.4915,
			description: "Kompleks candi Hindu terbesar di Indonesia yang diakui sebagai situs warisan dunia UNESCO.",
			staffName:   "Nadia Kusuma",
			staffPin:    string(pinJogjaHash),
			tickets: []struct {
				title string
				desc  string
				price int64
				quota int
			}{
				{title: "Tiket Masuk Reguler", desc: "Akses pelataran kompleks candi pukul 06:30-17:00 WIB", price: 50000, quota: 500},
				{title: "Tiket Sunrise Pelataran", desc: "Akses masuk pagi pukul 05:30-08:00 WIB", price: 125000, quota: 100},
			},
		},
	}

	for _, v := range venues {
		var venueID string
		err := tx.QueryRow(ctx, `
			INSERT INTO venues (
				owner_id, legality_id, venue_code, name, kota_kode, city, lokasi, address,
				jam_buka, kategori, harga_mulai, rating, jumlah_ulasan, fasilitas,
				gambar_url, gambar_alt, latitude, longitude, description, is_published, approved_at
			)
			VALUES (
				$1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8,
				$9, $10::kategori_wisata, $11, $12, $13, $14,
				$15, $16, $17, $18, $19, TRUE, NOW()
			)
			RETURNING id::text
		`,
			ownerID, legalityID, v.venueCode, v.name, v.kotaKode, v.city, v.lokasi, v.address,
			v.jamBuka, v.kategori, v.hargaMulai, v.rating, v.ulasan, v.fasilitas,
			v.gambarURL, v.gambarAlt, v.lat, v.lng, v.description,
		).Scan(&venueID)
		if err != nil {
			return false, fmt.Errorf("seed venue %s: %w", v.venueCode, err)
		}

		for _, tkt := range v.tickets {
			if _, err := tx.Exec(ctx, `
				INSERT INTO tickets (venue_id, title, description, price, daily_quota, is_active)
				VALUES ($1::uuid, $2, $3, $4, $5, TRUE)
			`, venueID, tkt.title, tkt.desc, tkt.price, tkt.quota); err != nil {
				return false, fmt.Errorf("seed ticket %s: %w", tkt.title, err)
			}
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO staffs (venue_id, staff_name, pin_hash, is_active)
			VALUES ($1::uuid, $2, $3, TRUE)
		`, venueID, v.staffName, v.staffPin); err != nil {
			return false, fmt.Errorf("seed staff %s: %w", v.staffName, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("commit dev seed tx: %w", err)
	}
	return true, nil
}

func seedDefaultCustomer(ctx context.Context, pool *pgxpool.Pool) (bool, error) {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("fastixdev123"), bcrypt.DefaultCost)
	if err != nil {
		return false, fmt.Errorf("hash demo customer password: %w", err)
	}

	tag, err := pool.Exec(ctx, `
		INSERT INTO users (phone_number, full_name, email, password_hash, role, is_verified)
		VALUES ('081234567890', 'Raka Pratama', 'raka.pratama@gmail.com', $1, 'TOURIST', TRUE)
		ON CONFLICT DO NOTHING
	`, string(passwordHash))
	if err != nil {
		return false, fmt.Errorf("seed demo customer: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}
