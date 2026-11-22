package migrations

import "embed"

// FS embeds SQL migration files into the binary for deterministic startup migrations.
//go:embed *.sql
var FS embed.FS
