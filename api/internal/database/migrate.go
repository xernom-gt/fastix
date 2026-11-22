package database

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"fastix/api/migrations"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Migrate applies pending *.up.sql files in lexical order inside individual transactions.
func Migrate(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return 0, fmt.Errorf("ensure schema_migrations table: %w", err)
	}

	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return 0, fmt.Errorf("read embedded migrations: %w", err)
	}

	var upFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".up.sql") {
			upFiles = append(upFiles, entry.Name())
		}
	}
	sort.Strings(upFiles)

	appliedCount := 0
	for _, filename := range upFiles {
		var exists bool
		err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, filename).Scan(&exists)
		if err != nil {
			return appliedCount, fmt.Errorf("check migration %s: %w", filename, err)
		}
		if exists {
			continue
		}

		sqlBytes, err := fs.ReadFile(migrations.FS, filename)
		if err != nil {
			return appliedCount, fmt.Errorf("read migration %s: %w", filename, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return appliedCount, fmt.Errorf("begin tx for %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			_ = tx.Rollback(ctx)
			return appliedCount, fmt.Errorf("execute migration %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, filename); err != nil {
			_ = tx.Rollback(ctx)
			return appliedCount, fmt.Errorf("record migration %s: %w", filename, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return appliedCount, fmt.Errorf("commit migration %s: %w", filename, err)
		}

		appliedCount++
	}

	return appliedCount, nil
}
