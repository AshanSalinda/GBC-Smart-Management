// Package hub manages all active WebSocket connections and broadcasts state updates.
//
// Architecture:
//   - Each connection gets its own *Client with a buffered send channel.
//   - A single Hub.Run() goroutine routes broadcasts from domain channels to clients.
//   - Each client runs its own writePump and readPump goroutines.
//   - No shared state is accessed without a mutex or via a single-writer goroutine.
package hub

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"gbc/backend/internal/domain"
	"gbc/backend/pkg/timeutil"

	"github.com/gofiber/websocket/v2"
)

const (
	writeWait   = 10 * time.Second
	pongWait    = 60 * time.Second
	pingPeriod  = (pongWait * 9) / 10
	sendBufSize = 32
)

// Client wraps a single WebSocket connection with an outbound message channel.
type Client struct {
	conn   *websocket.Conn
	info   clientInfo
	send   chan []byte
	ctx    context.Context
	cancel context.CancelFunc
}

type clientInfo struct {
	Role  string
	Email string
}

// Hub manages all connected WebSocket clients.
type Hub struct {
	mu         sync.RWMutex
	clients    map[*Client]struct{}
	tablesCh   <-chan []domain.TableState
	timelineCh <-chan []domain.Booking
	logger     *slog.Logger

	// Dependencies for INITIAL_STATE
	cache    domain.TableCache
	timeline domain.TimelineProvider
}

// New creates a Hub. Call Run() in a separate goroutine.
func New(
	tablesCh <-chan []domain.TableState,
	timelineCh <-chan []domain.Booking,
	cache domain.TableCache,
	timeline domain.TimelineProvider,
) *Hub {
	return &Hub{
		clients:    make(map[*Client]struct{}),
		tablesCh:   tablesCh,
		timelineCh: timelineCh,
		logger:     slog.Default().With("module", "WEBS"),
		cache:      cache,
		timeline:   timeline,
	}
}

// Run starts the broadcast loops. Must be called in a separate goroutine.
func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case tables, ok := <-h.tablesCh:
			if !ok {
				return
			}
			h.broadcastToAll(tables)
		case tl, ok := <-h.timelineCh:
			if !ok {
				return
			}
			h.broadcastTimeline(tl)
		}
	}
}

// HandleConn processes a new, already-authenticated WebSocket connection.
// Blocks until the connection is closed.
func (h *Hub) HandleConn(c *websocket.Conn, user domain.AuthUser) {
	ctx, cancel := context.WithCancel(context.Background())
	client := &Client{
		conn:   c,
		info:   clientInfo{Role: user.Role, Email: user.Email},
		send:   make(chan []byte, sendBufSize),
		ctx:    ctx,
		cancel: cancel,
	}

	h.register(client)

	// Send INITIAL_STATE asynchronously so it goes through the client's writePump
	go h.sendInitialState(client)

	// Write pump delivers from send channel to the wire
	go client.writePump()

	// Read pump detects disconnection (blocks here)
	client.readPump()

	// Connection is gone — clean up
	h.unregister(client)
	cancel()
}

// ─── Registration ─────────────────────────────────────────────────────────────

func (h *Hub) register(c *Client) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	h.logger.Info("client connected", "role", c.info.Role, "email", c.info.Email)
}

func (h *Hub) unregister(c *Client) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
	}
	h.mu.Unlock()
	h.logger.Info("client disconnected", "role", c.info.Role)
}

// ─── Initial State ────────────────────────────────────────────────────────────

func (h *Hub) sendInitialState(c *Client) {
	tables := h.cache.GetAll()
	payload := map[string]any{
		"event":      "INITIAL_STATE",
		"serverTime": time.Now().UTC().Format(time.RFC3339),
		"tables":     tables,
	}

	if c.info.Role == "admin" || c.info.Role == "staff" {
		tl, err := h.timeline.GetTimeline(timeutil.TodayVenueString())
		if err == nil {
			payload["timeline"] = tl
		} else {
			h.logger.Error("failed to fetch timeline for INITIAL_STATE", "err", err)
		}
	}

	data, err := json.Marshal(payload)
	if err != nil {
		h.logger.Error("failed to marshal INITIAL_STATE", "err", err)
		return
	}

	select {
	case c.send <- data:
	case <-c.ctx.Done():
		// Client already disconnected
	}
}

// ─── Broadcasting ─────────────────────────────────────────────────────────────

func (h *Hub) broadcastToAll(tables []domain.TableState) {
	payload := map[string]any{
		"event":  "TABLES_UPDATED",
		"tables": tables,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		// Only admin and staff receive timeline updates.
		if c.info.Role != "admin" && c.info.Role != "staff" {
			continue
		}
		select {
		case c.send <- data:
		case <-c.ctx.Done():
			// Skip — will be cleaned up by readPump
		default:
			h.logger.Warn("send buffer full, TABLES_UPDATED dropped", "role", c.info.Role)
		}
	}
}

func (h *Hub) broadcastTimeline(tl []domain.Booking) {
	payload := map[string]any{
		"event":    "TIMELINE_UPDATED",
		"timeline": tl,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if c.info.Role != "admin" && c.info.Role != "staff" {
			continue
		}
		select {
		case c.send <- data:
		case <-c.ctx.Done():
		default:
			h.logger.Warn("send buffer full, TIMELINE_UPDATED dropped", "role", c.info.Role)
		}
	}
}

// ─── Client I/O Pumps ─────────────────────────────────────────────────────────

// writePump sends from the client's channel to the WebSocket wire.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case <-c.ctx.Done():
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			c.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads from the wire to detect client disconnection.
func (c *Client) readPump() {
	defer c.conn.Close()
	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			break
		}
	}
}
