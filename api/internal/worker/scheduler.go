package worker

import (
	"context"
	"log/slog"
	"time"
)

// BookingMaintainer runs periodic expiry (15m) and auto-refund (7d) sweeps.
type BookingMaintainer interface {
	RunMaintenanceWorkers(ctx context.Context) (expiredCount, refundedCount int64, err error)
}

// EscrowReleaser moves H+1 redeemed ticket funds from pending_balance to available_balance.
type EscrowReleaser interface {
	ReleaseEscrowHPlusOne(ctx context.Context) (int64, error)
}

// StartScheduler runs background maintenance ticks until ctx is cancelled.
func StartScheduler(ctx context.Context, bookingSvc BookingMaintainer, opsSvc EscrowReleaser, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tickCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			expired, refunded, err := bookingSvc.RunMaintenanceWorkers(tickCtx)
			if err != nil {
				slog.Error("booking maintenance worker failed", "error", err)
			}

			var released int64
			if opsSvc != nil {
				released, err = opsSvc.ReleaseEscrowHPlusOne(tickCtx)
				if err != nil {
					slog.Error("escrow release worker failed", "error", err)
				}
			}
			cancel()

			if expired > 0 || refunded > 0 || released > 0 {
				slog.Info("maintenance worker completed", "expiredBookings", expired, "refundedTickets", refunded, "releasedEscrowItems", released)
			}
		}
	}
}
