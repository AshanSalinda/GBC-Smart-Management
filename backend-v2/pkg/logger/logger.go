// Package logger provides a thin, structured logging wrapper around Go's standard slog.
package logger

import (
	"context"
	"fmt"
	"log/slog"
	"os"
)

// Init configures the global slog logger.
func Init(env string) {
	// Use our custom handler for both dev and prod,
	// but omit time/level in prod since the cloud provider adds them.
	handler := &customHandler{
		level: slog.LevelDebug,
		env:   env,
	}
	if env == "production" {
		handler.level = slog.LevelInfo
	}
	slog.SetDefault(slog.New(handler))
}

// customHandler implements slog.Handler to provide a clean, readable console format
type customHandler struct {
	level slog.Level
	env   string
	attrs []slog.Attr
}

func (h *customHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return level >= h.level
}

func (h *customHandler) Handle(ctx context.Context, r slog.Record) error {
	// 1. Time (only in dev)
	timeStr := ""
	if h.env != "production" {
		timeStr = r.Time.Format("2006-01-02 15:04:05") + "  "
	}

	// 2. Level (only in dev, padded to 5 characters)
	levelStr := ""
	if h.env != "production" {
		levelStr = fmt.Sprintf("%-5s  ", r.Level.String())
	}

	// 3. Collect attributes to find "module" and gather the rest
	var module string
	var otherAttrs []string

	for _, attr := range h.attrs {
		if attr.Key == "module" {
			module = attr.Value.String()
		} else {
			otherAttrs = append(otherAttrs, attr.Key+"="+attr.Value.String())
		}
	}

	r.Attrs(func(a slog.Attr) bool {
		if a.Key == "module" {
			module = a.Value.String()
		} else {
			otherAttrs = append(otherAttrs, a.Key+"="+a.Value.String())
		}
		return true
	})

	// Pad the module string to 10 characters
	moduleStr := ""
	if module != "" {
		moduleStr = fmt.Sprintf("[%s]  ", module)
	} else {
		moduleStr = "            " // 12 spaces to match the bracketed module + padding
	}

	// Combine into final string
	logLine := timeStr + levelStr + moduleStr + r.Message
	if len(otherAttrs) > 0 {
		for _, attr := range otherAttrs {
			logLine += "  " + attr
		}
	}

	os.Stdout.WriteString(logLine + "\n")
	return nil
}

func (h *customHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	newHandler := &customHandler{
		level: h.level,
		env:   h.env,
		attrs: append([]slog.Attr{}, h.attrs...),
	}
	newHandler.attrs = append(newHandler.attrs, attrs...)
	return newHandler
}

func (h *customHandler) WithGroup(name string) slog.Handler {
	return h
}
