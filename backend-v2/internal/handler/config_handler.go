package handler

import (
	"gbc/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// ConfigHandler handles /api/configs routes.
type ConfigHandler struct {
	svc *service.ConfigService
}

func NewConfigHandler(svc *service.ConfigService) *ConfigHandler {
	return &ConfigHandler{svc: svc}
}

// GET /api/configs
func (h *ConfigHandler) Get(c *fiber.Ctx) error {
	cfg, err := h.svc.GetConfig()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(cfg)
}

// PATCH /api/configs
func (h *ConfigHandler) Update(c *fiber.Ctx) error {
	var body map[string]any
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	cfg, err := h.svc.UpdateConfig(body)
	if err != nil {
		return handleSvcError(c, err)
	}
	return c.JSON(cfg)
}
