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

// StartScheduler runs background maintenance ticks until ctx is cancelled.
func StartScheduler(ctx context.Context, bookingSvc BookingMaintainer, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tickCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			expired, refunded, err := bookingSvc.RunMaintenanceWorkers(tickCtx)
			cancel()
			if err != nil {
				slog.Error("maintenance worker failed", "error", err)
				continue
			}
			if expired > 0 || refunded > 0 {
				slog.Info("maintenance worker completed", "expiredBookings", expired, "refundedTickets", refunded)
			}
		}
	}
}
