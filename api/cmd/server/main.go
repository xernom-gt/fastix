package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"fastix/api/internal/config"
	"fastix/api/internal/database"
	"fastix/api/internal/handler"
	"fastix/api/internal/middleware"
	"fastix/api/internal/response"

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

	healthHandler := handler.NewHealthHandler(pool, cfg.AppEnv)
	v1 := app.Group("/api/v1")
	v1.Get("/health", healthHandler.Check)

	shutdownCh := make(chan os.Signal, 1)
	signal.Notify(shutdownCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-shutdownCh
		logger.Info("shutting down server")
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
