# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM golang:1.27-alpine AS builder

WORKDIR /build

# Install CA certificates (needed for TLS connections to MongoDB and MQTT)
RUN apk add --no-cache ca-certificates

# Cache dependencies layer
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build a statically linked binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /gbc-server ./cmd/server

# ── Stage 2: Minimal Runtime ────────────────────────────────────────────────
FROM alpine:3.20

WORKDIR /app

# Copy the CA certificates for TLS (MQTT over TLS, MongoDB Atlas)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
# Copy the compiled binary only
COPY --from=builder /gbc-server /app/gbc-server

# Run as a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/gbc-server"]
