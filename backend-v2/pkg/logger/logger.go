// Package logger provides a thin, structured logging wrapper around Go's standard slog.
package logger

import (
	"log/slog"
	"os"
)

// Init configures the global slog logger.
// In production, use JSON format for structured log ingestion.
func Init(env string) {
	var handler slog.Handler
	if env == "production" {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		})
	} else {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelDebug,
		})
	}
	slog.SetDefault(slog.New(handler))
}
