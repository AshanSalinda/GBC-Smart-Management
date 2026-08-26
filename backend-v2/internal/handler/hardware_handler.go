package handler

import (
	"fmt"

	"gbc/backend/internal/domain"
	"gbc/backend/internal/hardware"
	"gbc/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// HardwareHandler handles hardware-related HTTP endpoints.
type HardwareHandler struct {
	mqttClient *hardware.MqttClient
	tableSvc   *service.TableService
}

func NewHardwareHandler(mqttClient *hardware.MqttClient, tableSvc *service.TableService) *HardwareHandler {
	return &HardwareHandler{mqttClient: mqttClient, tableSvc: tableSvc}
}

// Health godoc
// @Summary Health Check
// @Description Sends a health ping to the ESP32 and waits up to 5 seconds for a response.
// @Tags Public
// @Success 200 {object} map[string]interface{}
// @Failure 503 {object} map[string]interface{}
// @Router /health [get]
func (h *HardwareHandler) Health(c *fiber.Ctx) error {
	data, err := h.mqttClient.RequestHardwareHealth()
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"status": "OFFLINE",
			"error":  err.Error(),
		})
	}

	hwData, ok := data.(map[string]any)
	if !ok {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ONLINE", "metadata": data})
	}

	metadata := fiber.Map{
		"deviceName":   hwData["deviceName"],
		"macAddress":   hwData["mac"],
		"uptimeMillis": hwData["uptime"],
		"freeHeap":     hwData["freeHeap"],
		"heapSize":     hwData["heapSize"],
		"temperature":  hwData["temperature"],
		"ssid":         hwData["ssid"],
		"rssi":         hwData["rssi"],
		"ipAddress":    hwData["ipAddress"],
	}

	// Reconcile ESP32-reported relay states against the backend cache.
	// The ESP32 health response has "tables": { "1": "ON", "2": "OFF", ... }
	hwTables, _ := hwData["tables"].(map[string]any)
	tables := h.tableSvc.GetCacheSnapshot()
	tableReconcile := make([]fiber.Map, 0, len(tables))
	for _, t := range tables {
		backendState := "OFF"
		if t.LightStatus == domain.LightOn || t.LightStatus == domain.LightPendingOn {
			backendState = "ON"
		}
		hwState := "UNKNOWN"
		if hwTables != nil {
			key := fmt.Sprintf("%d", t.TableID)
			if v, ok := hwTables[key]; ok {
				hwState, _ = v.(string)
			}
		}
		tableReconcile = append(tableReconcile, fiber.Map{
			"tableId":       t.TableID,
			"backendState":  backendState,
			"hardwareState": hwState,
			"isSynced":      backendState == hwState,
		})
	}

	return c.JSON(fiber.Map{
		"status":   "ONLINE",
		"metadata": metadata,
		"tables":   tableReconcile,
	})
}
