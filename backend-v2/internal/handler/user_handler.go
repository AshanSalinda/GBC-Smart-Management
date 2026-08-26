package handler

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"

	"firebase.google.com/go/v4/auth"
	"gbc/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"google.golang.org/api/iterator"
)

// UserHandler handles /api/users routes (admin only).
type UserHandler struct {
	authClient *auth.Client
}

func NewUserHandler(authClient *auth.Client) *UserHandler {
	return &UserHandler{authClient: authClient}
}

// GET /api/users?maxResults=100&pageToken=...
func (h *UserHandler) ListUsers(c *fiber.Ctx) error {
	maxResultsStr := c.Query("maxResults", "100")
	maxResults, err := strconv.Atoi(maxResultsStr)
	if err != nil || maxResults <= 0 {
		maxResults = 100
	}
	pageToken := c.Query("pageToken", "")

	iter := h.authClient.Users(context.Background(), pageToken)

	var users []fiber.Map
	count := 0
	for count < maxResults {
		u, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			slog.Error("UserHandler: list users error", "err", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fmt.Sprintf("failed to list users: %v", err),
			})
		}
		role := ""
		if u.CustomClaims != nil {
			role, _ = u.CustomClaims["role"].(string)
		}
		users = append(users, fiber.Map{
			"uid":         u.UID,
			"email":       u.Email,
			"displayName": u.DisplayName,
			"photoURL":    u.PhotoURL,
			"disabled":    u.Disabled,
			"role":        role,
		})
		count++
	}

	if users == nil {
		users = []fiber.Map{}
	}

	// Peek for next page token
	nextToken := ""
	nextUser, err := iter.Next()
	if err == nil && nextUser != nil {
		// There are more users; provide the last user's email as a cursor
		// The Firebase iterator.PageInfo().Token is the proper way
		nextToken = iter.PageInfo().Token
	}

	return c.JSON(fiber.Map{
		"users":     users,
		"pageToken": nextToken,
	})
}

// PATCH /api/users/:uid/role
func (h *UserHandler) SetRole(c *fiber.Ctx) error {
	uid := c.Params("uid")
	if uid == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "uid is required"})
	}

	var body struct {
		Role string `json:"role"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	validRoles := map[string]bool{"admin": true, "staff": true, "tv": true, "": true}
	if !validRoles[body.Role] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "role must be admin, staff, tv, or empty"})
	}

	if err := h.authClient.SetCustomUserClaims(context.Background(), uid, map[string]any{"role": body.Role}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("role '%s' assigned to user %s", body.Role, uid),
		"uid":     uid,
		"role":    body.Role,
	})
}

// DELETE /api/users/:uid
func (h *UserHandler) DeleteUser(c *fiber.Ctx) error {
	caller := c.Locals("user").(domain.AuthUser)
	uid := c.Params("uid")
	if uid == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "uid is required"})
	}
	if uid == caller.UID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "you cannot delete your own account"})
	}

	if err := h.authClient.DeleteUser(context.Background(), uid); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("user %s deleted", uid),
		"uid":     uid,
	})
}
