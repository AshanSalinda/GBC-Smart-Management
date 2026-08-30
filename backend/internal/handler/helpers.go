package handler

import (
	"time"

	"gbc/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// handleSvcError converts a service error to a Fiber HTTP response.
func handleSvcError(c *fiber.Ctx, err error) error {
	if ve, ok := err.(*service.ValidationError); ok {
		return c.Status(ve.Code).JSON(fiber.Map{"error": ve.Message})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
}

// timeNowDate returns today's date as "YYYY-MM-DD" in UTC.
func timeNowDate() string {
	return time.Now().UTC().Format("2006-01-02")
}
