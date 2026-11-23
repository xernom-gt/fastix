package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"fastix/api/internal/config"
	"fastix/api/internal/database"
	"fastix/api/internal/domain"
	"fastix/api/internal/handler"
	"fastix/api/internal/middleware"
	"fastix/api/internal/repository"
	"fastix/api/internal/response"
	"fastix/api/internal/service"
	"fastix/api/internal/worker"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	migrateOnly := flag.Bool("migrate-only", false, "run database migrations and exit")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	rootCtx := context.Background()
	pool, err := database.NewPool(rootCtx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("failed to connect database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	applied, err := database.Migrate(rootCtx, pool)
	if err != nil {
		logger.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}
	logger.Info("database migrations checked", "applied", applied)

	if strings.EqualFold(cfg.AppEnv, "development") {
		seeded, err := database.SeedDev(rootCtx, pool)
		if err != nil {
			logger.Error("failed to run dev seeder", "error", err)
			os.Exit(1)
		}
		if seeded {
			logger.Info("development seed data applied")
		}
	}

	if *migrateOnly {
		return
	}

	app := fiber.New(fiber.Config{
		AppName:      "Fastix API",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  30 * time.Second,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			status := fiber.StatusInternalServerError
			code := "INTERNAL_ERROR"
			msg := "Terjadi kesalahan pada server."

			var fiberErr *fiber.Error
			if errors.As(err, &fiberErr) {
				status = fiberErr.Code
				code = "HTTP_ERROR"
				msg = fiberErr.Message
			}

			return response.Fail(c, status, code, msg, nil)
		},
	})

	app.Use(recover.New())
	app.Use(middleware.NewCORS(cfg.CORSAllowedOrigins))

	authRepo := repository.NewPgxAuthRepository(pool)
	authSvc := service.NewAuthService(authRepo, cfg.JWTSecret, cfg.AppEnv, cfg.GoogleClientID, service.NewHTTPGoogleTokenVerifier())
	authHandler := handler.NewAuthHandler(authSvc)

	discoveryRepo := repository.NewPgxDiscoveryRepository(pool)
	discoverySvc := service.NewDiscoveryService(discoveryRepo)
	discoveryHandler := handler.NewDiscoveryHandler(discoverySvc)

	bookingRepo := repository.NewPgxBookingRepository(pool)
	snapClient := service.NewHTTPMidtransSnapClient(cfg.MidtransEnv, cfg.MidtransServerKey)
	bookingSvc := service.NewBookingService(bookingRepo, cfg.QRHMACSecret, cfg.MidtransServerKey, cfg.AppEnv, snapClient)
	bookingHandler := handler.NewBookingHandler(bookingSvc)

	opsRepo := repository.NewPgxOperationsRepository(pool)
	opsSvc := service.NewOperationsService(opsRepo, cfg.QRHMACSecret, cfg.KYBEncryptionKey)
	opsHandler := handler.NewOperationsHandler(opsSvc)

	workerCtx, cancelWorkers := context.WithCancel(rootCtx)
	defer cancelWorkers()
	go worker.StartScheduler(workerCtx, bookingSvc, opsSvc, time.Minute)

	authLimiter := middleware.NewRateLimiter(20, time.Minute)
	requireAuth := middleware.RequireAuth(cfg.JWTSecret)

	healthHandler := handler.NewHealthHandler(pool, cfg.AppEnv)
	v1 := app.Group("/api/v1")
	v1.Get("/health", healthHandler.Check)

	v1.Get("/regions", discoveryHandler.ListRegions)
	v1.Post("/partner-leads", discoveryHandler.CreatePartnerLead)
	v1.Get("/venues", discoveryHandler.ListVenues)
	v1.Get("/venues/:id", discoveryHandler.GetVenueDetail)

	authGroup := v1.Group("/auth", authLimiter)
	authGroup.Post("/register", authHandler.Register)
	authGroup.Post("/register/verify-otp", authHandler.VerifyRegistrationOTP)
	authGroup.Post("/login", authHandler.Login)
	authGroup.Post("/google", authHandler.GoogleLogin)

	v1.Get("/auth/me", requireAuth, middleware.RequireRoles(domain.RoleTourist, domain.RoleMitra, domain.RoleAdminHQ), authHandler.Me)
	v1.Patch("/auth/profile", requireAuth, middleware.RequireRoles(domain.RoleTourist, domain.RoleMitra, domain.RoleAdminHQ), authHandler.UpdateProfile)

	v1.Post("/bookings", requireAuth, middleware.RequireRoles(domain.RoleTourist), bookingHandler.CreateBooking)
	v1.Get("/bookings/:invoiceId", requireAuth, middleware.RequireRoles(domain.RoleTourist), bookingHandler.GetBooking)
	v1.Post("/bookings/:invoiceId/simulate-pay", requireAuth, middleware.RequireRoles(domain.RoleTourist), bookingHandler.SimulatePay)
	v1.Post("/webhooks/qris", bookingHandler.QRISWebhook)
	v1.Get("/tickets", requireAuth, middleware.RequireRoles(domain.RoleTourist), bookingHandler.ListTickets)
	v1.Get("/tickets/:ticketCode", requireAuth, middleware.RequireRoles(domain.RoleTourist), bookingHandler.GetTicket)

	v1.Post("/gate/auth/login", authLimiter, authHandler.GateLogin)
	v1.Get("/gate/tickets/today", requireAuth, middleware.RequireRoles(domain.RoleGateStaff, domain.RoleMitra), opsHandler.ListTodayGateTickets)
	v1.Post("/gate/redeem", authLimiter, requireAuth, middleware.RequireRoles(domain.RoleGateStaff, domain.RoleMitra), opsHandler.GateRedeem)
	v1.Post("/gate/sync", requireAuth, middleware.RequireRoles(domain.RoleGateStaff, domain.RoleMitra), opsHandler.GateSync)

	v1.Post("/mitra/kyb", requireAuth, middleware.RequireRoles(domain.RoleTourist, domain.RoleMitra), opsHandler.SubmitKYB)
	mitraGroup := v1.Group("/mitra", requireAuth, middleware.RequireRoles(domain.RoleMitra))
	mitraGroup.Get("/venues", opsHandler.ListMitraVenues)
	mitraGroup.Post("/tickets", opsHandler.CreateMitraTicket)
	mitraGroup.Patch("/tickets/:id", opsHandler.UpdateMitraTicket)
	mitraGroup.Get("/staffs", opsHandler.ListMitraStaffs)
	mitraGroup.Post("/staffs", opsHandler.CreateMitraStaff)
	mitraGroup.Patch("/staffs/:id", opsHandler.UpdateMitraStaff)
	mitraGroup.Get("/finance", opsHandler.GetMitraFinance)
	mitraGroup.Post("/payouts", opsHandler.CreatePayout)

	shutdownCh := make(chan os.Signal, 1)
	signal.Notify(shutdownCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-shutdownCh
		logger.Info("shutting down server")
		cancelWorkers()
		if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
			logger.Error("server shutdown error", "error", err)
		}
	}()

	addr := ":" + cfg.AppPort
	logger.Info("starting fastix api", "addr", addr, "env", cfg.AppEnv)
	if err := app.Listen(addr); err != nil {
		logger.Error("server stopped with error", "error", err)
		os.Exit(1)
	}
}
