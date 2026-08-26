package handler

import (
	"gbc/backend/internal/domain"
	"gbc/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// LightsHandler handles POST /api/lights/toggle.
type LightsHandler struct {
	tableSvc *service.TableService
}

func NewLightsHandler(tableSvc *service.TableService) *LightsHandler {
	return &LightsHandler{tableSvc: tableSvc}
}

// POST /api/lights/toggle
func (h *LightsHandler) Toggle(c *fiber.Ctx) error {
	var body struct {
		TableID     int    `json:"tableId"`
		TargetState string `json:"targetState"` // "ON" | "OFF"
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if body.TableID < 1 || body.TableID > 4 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tableId must be 1–4"})
	}
	if body.TargetState != "ON" && body.TargetState != "OFF" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "targetState must be ON or OFF"})
	}

	if _, ok := h.tableSvc.GetTable(body.TableID); !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "table not found"})
	}

	var ls domain.LightStatus
	if body.TargetState == "ON" {
		ls = domain.LightOn
	} else {
		ls = domain.LightOff
	}
	h.tableSvc.SetLightStatus(body.TableID, ls, "manual-toggle")

	return c.JSON(fiber.Map{
		"message":     "light toggle requested",
		"tableId":     body.TableID,
		"targetState": body.TargetState,
	})
}
