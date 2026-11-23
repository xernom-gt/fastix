ALTER TABLE transactions
    DROP COLUMN IF EXISTS snap_redirect_url,
    DROP COLUMN IF EXISTS snap_token;
