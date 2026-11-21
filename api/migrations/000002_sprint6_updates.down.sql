DROP INDEX IF EXISTS idx_auth_otps_email_created;
DROP TABLE IF EXISTS auth_otps;

ALTER TABLE users
    DROP COLUMN IF EXISTS is_verified,
    DROP COLUMN IF EXISTS password_hash;

-- PostgreSQL does not support dropping individual ENUM values without recreating the type.
