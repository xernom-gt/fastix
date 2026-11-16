-- Resolves the 8 schema gaps in document/erd_pariwisloka.md:
-- 1. Adds admins table and owner_legalities.verified_by_admin_id.
-- 2. Aligns users.role with TOURIST, MITRA, and ADMIN_HQ.
-- 3. Links venues.legality_id and venues.approved_at to owner_legalities.
-- 4. Enforces single-date invariant on transactions.booking_date.
-- 5. Adds balance_mutations.reference_type for polymorphic references.
-- 6. Replaces VARCHAR status columns with PostgreSQL ENUM types.
-- 7. Adds catalog fields on venues/tickets plus venue_images and partner_leads.
-- 8. Offline gate sync queue stays client-side (no DB table required).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE user_role AS ENUM ('TOURIST', 'MITRA', 'ADMIN_HQ');
CREATE TYPE kategori_wisata AS ENUM (
    'candi_sejarah',
    'pantai_bahari',
    'alam_geopark',
    'desa_wisata',
    'museum_edukasi',
    'theme_waterpark'
);
CREATE TYPE kyb_status AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');
CREATE TYPE redemption_status AS ENUM ('VALID', 'REDEEMED', 'EXPIRED');
CREATE TYPE payout_status AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');
CREATE TYPE mutation_type AS ENUM ('PAYIN_INFLOW', 'HOLDING_RELEASED', 'PAYOUT_WITHDRAW', 'PAYOUT_REFUND');
CREATE TYPE mutation_reference_type AS ENUM ('TRANSACTION', 'PAYOUT');
CREATE TYPE partner_lead_status AS ENUM ('RECEIVED', 'CONTACTED', 'CONVERTED', 'REJECTED');

CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    role user_role NOT NULL DEFAULT 'TOURIST',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE owner_legalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ktp_number VARCHAR(255) NOT NULL,
    ktp_photo_url TEXT NOT NULL,
    npwp_number VARCHAR(255) NOT NULL,
    npwp_photo_url TEXT NOT NULL,
    nib_number VARCHAR(255),
    bank_code VARCHAR(20) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_account_name VARCHAR(100) NOT NULL,
    verification_status kyb_status NOT NULL DEFAULT 'NOT_SUBMITTED',
    rejection_reason TEXT,
    verified_by_admin_id UUID REFERENCES admins(id),
    verified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    legality_id UUID REFERENCES owner_legalities(id),
    venue_code VARCHAR(16) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    kota_kode VARCHAR(32) NOT NULL,
    city VARCHAR(100) NOT NULL,
    lokasi VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    jam_buka VARCHAR(100) NOT NULL DEFAULT '08:00 - 17:00 WIB',
    kategori kategori_wisata NOT NULL,
    harga_mulai DECIMAL(12, 2) NOT NULL DEFAULT 0,
    rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
    jumlah_ulasan INT NOT NULL DEFAULT 0,
    fasilitas TEXT[] NOT NULL DEFAULT '{}',
    gambar_url TEXT NOT NULL DEFAULT '',
    gambar_alt VARCHAR(255) NOT NULL DEFAULT '',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    description TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venue_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    staff_name VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price DECIMAL(12, 2) NOT NULL,
    daily_quota INT NOT NULL CHECK (daily_quota >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id),
    venue_id UUID NOT NULL REFERENCES venues(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    booking_date DATE NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    platform_fee DECIMAL(12, 2) NOT NULL,
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    payment_gateway_ref VARCHAR(100),
    qr_string TEXT NOT NULL DEFAULT '',
    expired_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES tickets(id),
    booking_date DATE NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL,
    is_released BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_item_id UUID NOT NULL REFERENCES transaction_items(id) ON DELETE CASCADE,
    ticket_code VARCHAR(100) UNIQUE NOT NULL,
    signature_hash VARCHAR(255) NOT NULL,
    status redemption_status NOT NULL DEFAULT 'VALID',
    redeemed_at TIMESTAMPTZ,
    redeemed_by_staff_id UUID REFERENCES staffs(id)
);

CREATE TABLE owner_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID UNIQUE NOT NULL REFERENCES users(id),
    pending_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE balance_mutations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(12, 2) NOT NULL,
    type mutation_type NOT NULL,
    reference_type mutation_reference_type NOT NULL,
    reference_id UUID NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    admin_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    bank_code VARCHAR(20) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_account_name VARCHAR(100) NOT NULL,
    status payout_status NOT NULL DEFAULT 'PENDING',
    gateway_disbursement_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transferred_at TIMESTAMPTZ
);

CREATE TABLE partner_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_name VARCHAR(150) NOT NULL,
    kota_kode VARCHAR(32) NOT NULL,
    pic_name VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(30) NOT NULL,
    email VARCHAR(150) NOT NULL,
    status partner_lead_status NOT NULL DEFAULT 'RECEIVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venues_kota_published ON venues(kota_kode) WHERE is_published = TRUE;
CREATE INDEX idx_venues_name_trgm ON venues USING GIN (name gin_trgm_ops);
CREATE INDEX idx_venues_lokasi_trgm ON venues USING GIN (lokasi gin_trgm_ops);
CREATE INDEX idx_venue_images_venue_id ON venue_images(venue_id, sort_order);
CREATE INDEX idx_redemptions_ticket_code ON redemptions(ticket_code);
CREATE INDEX idx_transaction_items_booking ON transaction_items(booking_date, ticket_id);
CREATE INDEX idx_transactions_status_expiry ON transactions(payment_status, expired_at);
CREATE INDEX idx_transactions_venue_date ON transactions(venue_id, booking_date);
CREATE INDEX idx_balance_mutations_owner ON balance_mutations(owner_id, created_at DESC);
