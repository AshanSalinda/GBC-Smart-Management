package handler

import (
	"gbc/backend/internal/domain"
	"gbc/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// BookingHandler handles all /api/bookings routes.
type BookingHandler struct {
	svc *service.BookingService
}

func NewBookingHandler(svc *service.BookingService) *BookingHandler {
	return &BookingHandler{svc: svc}
}

// POST /api/bookings
func (h *BookingHandler) Create(c *fiber.Ctx) error {
	user := c.Locals("user").(domain.AuthUser)

	var body struct {
		TableID      int     `json:"tableId"`
		BookerName   string  `json:"bookerName"`
		BookerMobile string  `json:"bookerMobile"`
		CheckInTime  string  `json:"checkInTime"`
		CheckOutTime string  `json:"checkOutTime"`
		Amount       float64 `json:"amount"`
		IsPaid       bool    `json:"isPaid"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if body.TableID < 1 || body.TableID > 4 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tableId must be 1–4"})
	}
	if body.BookerName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bookerName is required"})
	}
	if body.CheckInTime == "" || body.CheckOutTime == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "checkInTime and checkOutTime are required"})
	}

	booking, err := h.svc.CreateBooking(service.CreateBookingInput{
		TableID:      body.TableID,
		BookerName:   body.BookerName,
		BookerMobile: body.BookerMobile,
		CheckInTime:  body.CheckInTime,
		CheckOutTime: body.CheckOutTime,
		Amount:       body.Amount,
		IsPaid:       body.IsPaid,
	}, user.Email, user.Role)
	if err != nil {
		return handleSvcError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(booking)
}

// GET /api/bookings/timeline?date=YYYY-MM-DD
func (h *BookingHandler) GetTimeline(c *fiber.Ctx) error {
	date := c.Query("date")
	if date == "" {
		date = timeNowDate()
	}
	bookings, err := h.svc.GetTimeline(date)
	if err != nil {
		return handleSvcError(c, err)
	}
	return c.JSON(bookings)
}

// PATCH /api/bookings/:id
func (h *BookingHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")

	var body struct {
		BookerName   *string  `json:"bookerName"`
		BookerMobile *string  `json:"bookerMobile"`
		CheckInTime  string   `json:"checkInTime"`
		CheckOutTime string   `json:"checkOutTime"`
		Amount       *float64 `json:"amount"`
		IsPaid       *bool    `json:"isPaid"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	booking, err := h.svc.UpdateBooking(id, service.UpdateBookingInput{
		BookerName:   body.BookerName,
		BookerMobile: body.BookerMobile,
		CheckInTime:  body.CheckInTime,
		CheckOutTime: body.CheckOutTime,
		Amount:       body.Amount,
		IsPaid:       body.IsPaid,
	})
	if err != nil {
		return handleSvcError(c, err)
	}
	return c.JSON(booking)
}

// DELETE /api/bookings/:id
func (h *BookingHandler) Cancel(c *fiber.Ctx) error {
	id := c.Params("id")
	booking, err := h.svc.CancelBooking(id)
	if err != nil {
		return handleSvcError(c, err)
	}
	return c.JSON(booking)
}
