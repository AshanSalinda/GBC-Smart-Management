package handler

import (
	"fmt"
	"strconv"

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
		TableID     any    `json:"tableId"`
		TargetState string `json:"targetState"` // "ON" | "OFF"
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	var tableID int

	strID := fmt.Sprintf("%v", body.TableID)
	if strID == "ALL" {
		tableID = 0
	} else {
		parsed, err := strconv.Atoi(strID)
		if err != nil || parsed < 1 || parsed > 4 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tableId must be 1–4 or 'ALL'"})
		}
		tableID = parsed
	}

	if body.TargetState != "ON" && body.TargetState != "OFF" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "targetState must be ON or OFF"})
	}

	if tableID != 0 {
		if _, ok := h.tableSvc.GetTable(tableID); !ok {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "table not found"})
		}
	}

	var ls domain.LightStatus
	if body.TargetState == "ON" {
		ls = domain.LightOn
	} else {
		ls = domain.LightOff
	}
	h.tableSvc.SetLightStatus(tableID, ls, "manual-toggle")

	return c.JSON(fiber.Map{
		"message":     "light toggle requested",
		"tableId":     body.TableID,
		"targetState": body.TargetState,
	})
}
