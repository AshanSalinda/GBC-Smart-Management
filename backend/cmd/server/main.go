// Package main is the entrypoint for the GBC Smart Management Go backend.
// It wires all layers together using constructor injection (no reflection-based DI).
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	firebase "firebase.google.com/go/v4"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/api/option"

	"gbc/backend/internal/cache"
	"gbc/backend/internal/domain"
	"gbc/backend/internal/handler"
	"gbc/backend/internal/handler/middleware"
	"gbc/backend/internal/hardware"
	"gbc/backend/internal/hub"
	"gbc/backend/internal/repository"
	"gbc/backend/internal/scheduler"
	"gbc/backend/internal/service"
	"gbc/backend/pkg/logger"
)

func main() {
	// ─── 1. Load Environment ─────────────────────────────────────
	_ = godotenv.Load() // OK if .env doesn't exist in production
	logger.Init(os.Getenv("NODE_ENV"))

	port := getEnv("PORT", "8000")
	mongoURI := mustGetEnv("MONGODB_URI")
	firebaseSAJSON := mustGetEnv("FIREBASE_SERVICE_ACCOUNT")
	mqttURL := mustGetEnv("MQTT_URL")
	mqttUser := mustGetEnv("MQTT_USERNAME")
	mqttPass := mustGetEnv("MQTT_PASSWORD")

	slog.Info("GBC Backend starting", "port", port)

	// ─── 2. Connect MongoDB ───────────────────────────────────────
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	mongoClient, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	cancel()
	if err != nil {
		slog.Error("MongoDB connect failed", "err", err)
		os.Exit(1)
	}
	defer func() {
		mongoClient.Disconnect(context.Background())
		slog.Info("MongoDB disconnected")
	}()

	pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := mongoClient.Ping(pingCtx, nil); err != nil {
		pingCancel()
		slog.Error("MongoDB ping failed", "err", err)
		os.Exit(1)
	}
	pingCancel()
	slog.Info("MongoDB connected")

	db := mongoClient.Database("gbc")

	// ─── 3. Init Firebase Admin ───────────────────────────────────
	firebaseApp, err := firebase.NewApp(
		context.Background(),
		nil,
		option.WithCredentialsJSON([]byte(firebaseSAJSON)),
	)
	if err != nil {
		slog.Error("Firebase init failed", "err", err)
		os.Exit(1)
	}
	authClient, err := firebaseApp.Auth(context.Background())
	if err != nil {
		slog.Error("Firebase auth client failed", "err", err)
		os.Exit(1)
	}
	slog.Info("Firebase Admin SDK initialized")

	// ─── 4. Create Channels ───────────────────────────────────────
	broadcastChan := make(chan []domain.TableState, 16)
	mqttCmdChan := make(chan domain.MqttCommand, 16)
	timelineChan := make(chan []domain.Booking, 8)

	// ─── 5. Repositories ─────────────────────────────────────────
	bookingRepo := repository.NewMongoBookingRepository(db)
	configRepo := repository.NewMongoConfigRepository(db)

	if err := configRepo.EnsureDefault(); err != nil {
		slog.Error("Config ensure default failed", "err", err)
		os.Exit(1)
	}

	// ─── 6. Cache (all tables start AVAILABLE) ────────────────────
	venueCache := cache.New(broadcastChan)

	// ─── 7. Services ──────────────────────────────────────────────
	tableSvc := service.NewTableService(venueCache, mqttCmdChan)
	bookingSvc := service.NewBookingService(bookingRepo, configRepo, tableSvc, timelineChan)
	configSvc := service.NewConfigService(configRepo)

	// ─── 8. Boot Hydration (silent — before hub goroutine starts) ─
	hydrateCache(venueCache, bookingRepo)

	// ─── 9. MQTT Client ───────────────────────────────────────────
	mqttClient := hardware.New(mqttURL, mqttUser, mqttPass, tableSvc, mqttCmdChan)
	if err := mqttClient.Connect(); err != nil {
		slog.Error("MQTT connect failed", "err", err)
		// Non-fatal: app can run without hardware connected
	}

	// ─── 10. Scheduler ────────────────────────────────────────────
	sched := scheduler.New(bookingRepo, tableSvc)
	sched.InitAll()

	// ─── 11. WS Hub ───────────────────────────────────────────────
	wsHub := hub.New(broadcastChan, timelineChan, venueCache, bookingSvc)

	// ─── 12. Background goroutines ────────────────────────────────
	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()

	go wsHub.Run(appCtx)
	mqttClient.StartCommandLoop(appCtx)
	sched.StartReconcileLoop(appCtx)

	// ─── 13. Fiber HTTP Application ───────────────────────────────
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PATCH,DELETE,OPTIONS",
		AllowHeaders: "Content-Type,Authorization",
	}))

	// ─── 14. Handlers ─────────────────────────────────────────────
	bookingH := handler.NewBookingHandler(bookingSvc)
	lightsH := handler.NewLightsHandler(tableSvc)
	hardwareH := handler.NewHardwareHandler(mqttClient, tableSvc)
	configH := handler.NewConfigHandler(configSvc)
	userH := handler.NewUserHandler(authClient)
	healthH := handler.NewHealthHandler(mongoClient, mqttClient)

	// ─── 15. Routes ───────────────────────────────────────────────

	// Public
	app.Get("/health", healthH.Check)

	// WebSocket (authenticated)
	app.Use("/ws", middleware.WSRequireAuth(authClient))
	app.Get("/ws", fiberws.New(func(c *fiberws.Conn) {
		user := c.Locals("user").(domain.AuthUser)
		wsHub.HandleConn(c, user)
	}))

	// Authenticated API routes
	api := app.Group("/api", middleware.RequireAuth(authClient))

	// Bookings
	bookings := api.Group("/bookings", middleware.RequireRole("admin", "staff"))
	bookings.Post("/", bookingH.Create)
	bookings.Get("/timeline", bookingH.GetTimeline)
	bookings.Patch("/:id", bookingH.Update)
	bookings.Delete("/:id", bookingH.Cancel)

	// Lights
	api.Post("/lights/toggle", middleware.RequireRole("admin", "staff"), lightsH.Toggle)

	// Hardware
	api.Get("/hardware/health", middleware.RequireRole("admin", "staff"), hardwareH.Health)

	// Configs
	api.Get("/configs", configH.Get)
	api.Patch("/configs", middleware.RequireRole("admin"), configH.Update)

	// Users (admin only)
	users := api.Group("/users", middleware.RequireRole("admin"))
	users.Get("/", userH.ListUsers)
	users.Patch("/:uid/role", userH.SetRole)
	users.Delete("/:uid", userH.DeleteUser)

	// ─── 16. Start server (non-blocking) ──────────────────────────
	serverErrChan := make(chan error, 1)
	go func() {
		slog.Info("Server listening", "port", port)
		if err := app.Listen(fmt.Sprintf(":%s", port)); err != nil {
			serverErrChan <- err
		}
	}()

	// ─── 17. Graceful Shutdown ────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		slog.Info("Shutdown signal received", "signal", sig)
	case err := <-serverErrChan:
		slog.Error("Server error", "err", err)
	}

	// Cancel background goroutines
	appCancel()
	sched.StopAll()

	// Stop accepting new requests (5-second timeout)
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		slog.Error("HTTP shutdown error", "err", err)
	}

	// Disconnect MQTT (publishes OFFLINE LWT before closing)
	mqttClient.Disconnect()

	slog.Info("GBC Backend stopped cleanly")
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// hydrateCache queries all currently active bookings from MongoDB and populates
// the in-memory cache silently (no broadcasts, no MQTT commands).
func hydrateCache(venueCache *cache.VenueCache, bookingRepo domain.BookingRepository) {
	activeBookings, err := bookingRepo.FindAllActiveNow(time.Now().UTC())
	if err != nil {
		slog.Error("Boot hydration failed", "err", err)
		return
	}
	for _, b := range activeBookings {
		cb := &domain.CurrentBooking{
			BookingID:       b.ID,
			BookerName:      b.BookerName,
			BookerMobile:    b.BookerMobile,
			CheckInTime:     b.CheckInTime.UTC().Format(time.RFC3339),
			CheckOutTime:    b.CheckOutTime.UTC().Format(time.RFC3339),
			DurationMinutes: b.DurationMinutes,
			Amount:          b.Amount,
			IsPaid:          b.IsPaid,
		}
		venueCache.HydrateTable(b.TableID, cb)
	}
	slog.Info("In-memory cache hydrated", "activeTables", len(activeBookings))
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		slog.Error("required environment variable not set", "key", key)
		os.Exit(1)
	}
	return v
}
