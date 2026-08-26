package handler

import (
	"time"

	"gbc/backend/internal/hardware"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

// HealthHandler handles GET /health (public, no auth required).
type HealthHandler struct {
	mongoClient *mongo.Client
	mqttClient  *hardware.MqttClient
}

func NewHealthHandler(mongoClient *mongo.Client, mqttClient *hardware.MqttClient) *HealthHandler {
	return &HealthHandler{mongoClient: mongoClient, mqttClient: mqttClient}
}

// GET /health
func (h *HealthHandler) Check(c *fiber.Ctx) error {
	mongoStatus := "disconnected"
	if err := h.mongoClient.Ping(c.Context(), nil); err == nil {
		mongoStatus = "connected"
	}

	mqttStatus := "disconnected"
	if h.mqttClient.IsConnected() {
		mqttStatus = "connected"
	}

	isHealthy := mongoStatus == "connected" && mqttStatus == "connected"
	statusText := "ok"
	if !isHealthy {
		statusText = "degraded"
	}

	code := fiber.StatusOK
	if !isHealthy {
		code = fiber.StatusServiceUnavailable
	}

	return c.Status(code).JSON(fiber.Map{
		"status":    statusText,
		"mongo":     mongoStatus,
		"mqtt":      mqttStatus,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
