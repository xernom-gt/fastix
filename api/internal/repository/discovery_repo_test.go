package repository

import (
	"regexp"
	"strconv"
	"testing"

	"fastix/api/internal/domain"
)

func maxPlaceholderIndex(sqlText string) int {
	re := regexp.MustCompile(`\$(\d+)`)
	matches := re.FindAllStringSubmatch(sqlText, -1)
	maxIdx := 0
	for _, m := range matches {
		idx, err := strconv.Atoi(m[1])
		if err == nil && idx > maxIdx {
			maxIdx = idx
		}
	}
	return maxIdx
}

func TestBuildSearchVenuesQueriesParamAlignment(t *testing.T) {
	cases := []struct {
		name            string
		filter          domain.VenueListFilter
		normalizedQuery string
		useTrigram      bool
		wantCountArgs   int
		wantListArgs    int
	}{
		{
			name:          "empty filters",
			filter:        domain.VenueListFilter{Kota: "all", Kategori: "all", Tanggal: "2026-11-23", Limit: 20, Offset: 0},
			wantCountArgs: 0,
			wantListArgs:  3,
		},
		{
			name:            "all filters exact",
			filter:          domain.VenueListFilter{Kota: "jogja", Kategori: "candi_sejarah", Tanggal: "2026-11-23", SortBy: "harga_asc", Limit: 10, Offset: 5},
			normalizedQuery: "candi prambanan",
			useTrigram:      false,
			wantCountArgs:   3,
			wantListArgs:    6,
		},
		{
			name:            "trigram fallback",
			filter:          domain.VenueListFilter{Kota: "bali", Kategori: "all", Tanggal: "2026-11-23", Limit: 20, Offset: 0},
			normalizedQuery: "tirta ganga",
			useTrigram:      true,
			wantCountArgs:   2,
			wantListArgs:    5,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			countSQL, countArgs, listSQL, listArgs := buildSearchVenuesQueries(tc.filter, tc.normalizedQuery, tc.useTrigram)
			if len(countArgs) != tc.wantCountArgs {
				t.Fatalf("expected %d countArgs, got %d", tc.wantCountArgs, len(countArgs))
			}
			if maxPlaceholderIndex(countSQL) != len(countArgs) {
				t.Fatalf("countSQL max placeholder $%d != len(countArgs) %d", maxPlaceholderIndex(countSQL), len(countArgs))
			}
			if len(listArgs) != tc.wantListArgs {
				t.Fatalf("expected %d listArgs, got %d", tc.wantListArgs, len(listArgs))
			}
			if maxPlaceholderIndex(listSQL) != len(listArgs) {
				t.Fatalf("listSQL max placeholder $%d != len(listArgs) %d", maxPlaceholderIndex(listSQL), len(listArgs))
			}
		})
	}
}
