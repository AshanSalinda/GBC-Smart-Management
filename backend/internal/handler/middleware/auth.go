// Package middleware provides Fiber middleware for the GBC backend.
package middleware

import (
	"strings"

	"firebase.google.com/go/v4/auth"
	"github.com/gofiber/fiber/v2"
	"gbc/backend/internal/domain"
)

// RequireAuth returns a Fiber middleware that verifies a Firebase JWT Bearer token.
// On success it stores domain.AuthUser in c.Locals("user").
// On failure it returns 401 Unauthorized.
func RequireAuth(authClient *auth.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing or malformed Authorization header",
			})
		}
		idToken := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := authClient.VerifyIDToken(c.Context(), idToken)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid or expired token",
			})
		}

		role, _ := token.Claims["role"].(string)
		email, _ := token.Claims["email"].(string)

		if role == "" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "no role assigned to this account",
			})
		}

		c.Locals("user", domain.AuthUser{
			UID:   token.UID,
			Email: email,
			Role:  role,
		})
		return c.Next()
	}
}

// RequireRole returns a Fiber middleware that checks the user has one of the allowed roles.
// Must be used after RequireAuth.
func RequireRole(roles ...string) fiber.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(domain.AuthUser)
		if !ok || !allowed[user.Role] {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "insufficient permissions",
			})
		}
		return c.Next()
	}
}

// WSRequireAuth returns a Fiber middleware that verifies the Firebase token for WebSocket upgrades.
// The token is expected in the ?token= query parameter (since WS handshakes cannot set headers in browsers).
// On success it stores domain.AuthUser in c.Locals("user").
func WSRequireAuth(authClient *auth.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Accept token from query param or Authorization header
		idToken := c.Query("token")
		if idToken == "" {
			authHeader := c.Get("Authorization")
			idToken = strings.TrimPrefix(authHeader, "Bearer ")
		}
		if idToken == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing token",
			})
		}

		token, err := authClient.VerifyIDToken(c.Context(), idToken)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid token",
			})
		}

		role, _ := token.Claims["role"].(string)
		email, _ := token.Claims["email"].(string)

		if role == "" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "no role assigned",
			})
		}

		c.Locals("user", domain.AuthUser{
			UID:   token.UID,
			Email: email,
			Role:  role,
		})
		return c.Next()
	}
}
