// Package hardware implements the MQTT client for ESP32 relay control.
//
// Dependency isolation: this package imports only the domain interfaces.
// It receives a domain.TableCoordinator (implemented by *service.TableService) at
// construction time. The MqttClient never imports the service package — preventing
// the hardware ↔ service circular dependency.
//
// Command flow:
//   TableService → mqttCmdChan → MqttClient → ESP32 (publish)
//   ESP32 (ACK)  → MqttClient → TableCoordinator.ConfirmLightStatus()
package hardware

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"gbc/backend/internal/domain"
	mqtt "github.com/eclipse/paho.mqtt.golang"
)

// MqttClient manages the persistent connection to the MQTT broker.
type MqttClient struct {
	client      mqtt.Client
	coordinator domain.TableCoordinator
	cmdChan     <-chan domain.MqttCommand
	logger      *slog.Logger

	// Pending health check requests keyed by commandId.
	healthMu      sync.Mutex
	healthPending map[string]chan any
}

// New creates and connects a new MqttClient. Call Connect() separately for retry support.
func New(
	brokerURL, username, password string,
	coordinator domain.TableCoordinator,
	cmdChan <-chan domain.MqttCommand,
) *MqttClient {
	log := slog.Default().With("module", "MQTT")
	c := &MqttClient{
		coordinator:   coordinator,
		cmdChan:       cmdChan,
		logger:        log,
		healthPending: make(map[string]chan any),
	}

	will, _ := json.Marshal(map[string]any{
		"status":    "OFFLINE",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})

	opts := mqtt.NewClientOptions().
		AddBroker(brokerURL).
		SetClientID("GBC_BACKEND_SERVER").
		SetUsername(username).
		SetPassword(password).
		SetCleanSession(false).
		SetKeepAlive(30 * time.Second).
		SetAutoReconnect(true).
		SetReconnectingHandler(func(_ mqtt.Client, _ *mqtt.ClientOptions) {
			c.logger.Warn("reconnecting to broker...")
		}).
		SetOnConnectHandler(c.onConnect).
		SetConnectionLostHandler(func(_ mqtt.Client, err error) {
			c.logger.Error("connection lost", "err", err)
		}).
		SetWill("gbc/hardware/status", string(will), 1, false)

	c.client = mqtt.NewClient(opts)
	return c
}

// Connect establishes the broker connection with a 10-second timeout.
func (c *MqttClient) Connect() error {
	token := c.client.Connect()
	if !token.WaitTimeout(10 * time.Second) {
		return fmt.Errorf("MQTT connect timed out")
	}
	return token.Error()
}

// IsConnected returns true when the MQTT connection is active.
func (c *MqttClient) IsConnected() bool {
	return c.client != nil && c.client.IsConnected()
}

// Disconnect gracefully closes the MQTT connection (called on shutdown).
func (c *MqttClient) Disconnect() {
	if c.client != nil && c.client.IsConnected() {
		// Publish offline status before disconnecting
		payload, _ := json.Marshal(map[string]any{
			"status":    "OFFLINE",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
		c.client.Publish("gbc/hardware/status", 1, false, payload)
		c.client.Disconnect(500)
	}
}

// StartCommandLoop starts a goroutine that reads from cmdChan and publishes relay commands.
// The loop exits when ctx is cancelled or cmdChan is closed.
func (c *MqttClient) StartCommandLoop(ctx context.Context) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case cmd, ok := <-c.cmdChan:
				if !ok {
					return
				}
				c.publishRelayCommand(cmd)
			}
		}
	}()
}

// RequestHardwareHealth pings the ESP32 and waits up to 5 seconds for a response.
func (c *MqttClient) RequestHardwareHealth() (any, error) {
	if !c.IsConnected() {
		return nil, fmt.Errorf("MQTT broker is disconnected")
	}
	cmdID := fmt.Sprintf("health_%d", time.Now().UnixMilli())
	ch := make(chan any, 1)

	c.healthMu.Lock()
	c.healthPending[cmdID] = ch
	c.healthMu.Unlock()

	payload, _ := json.Marshal(map[string]string{"commandId": cmdID})
	c.client.Publish("gbc/hardware/health/request", 1, false, payload)
	c.logger.Info("health request sent", "commandId", cmdID)

	timer := time.NewTimer(5 * time.Second)
	defer timer.Stop()

	select {
	case data := <-ch:
		return data, nil
	case <-timer.C:
		c.healthMu.Lock()
		delete(c.healthPending, cmdID)
		c.healthMu.Unlock()
		return nil, fmt.Errorf("hardware health request timed out — ESP32 may be offline")
	}
}

// ─── Private ──────────────────────────────────────────────────────────────────

func (c *MqttClient) onConnect(client mqtt.Client) {
	c.logger.Info("connected to broker")

	// Subscribe to all relevant topics
	subscriptions := map[string]byte{
		"gbc/hardware/table/+/ack":    1,
		"gbc/hardware/sync/request":   1,
		"gbc/hardware/sync/ack":       1,
		"gbc/hardware/status":         1,
		"gbc/hardware/health/response": 1,
	}
	for topic, qos := range subscriptions {
		client.Subscribe(topic, qos, c.handleMessage)
	}

	// Publish ONLINE status
	onlinePayload, _ := json.Marshal(map[string]any{
		"status":    "ONLINE",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	client.Publish("gbc/hardware/status", 1, false, onlinePayload)

	// Send full state sync immediately so the ESP32 knows the current truth
	c.publishFullStateSync()
}

func (c *MqttClient) handleMessage(_ mqtt.Client, msg mqtt.Message) {
	topic := msg.Topic()
	payload := msg.Payload()

	var data map[string]any
	if err := json.Unmarshal(payload, &data); err != nil {
		c.logger.Error("failed to parse message", "topic", topic, "err", err)
		return
	}

	switch {
	// ── ACK from ESP32 ────────────────────────────────────────────
	case strings.HasPrefix(topic, "gbc/hardware/table/") && strings.HasSuffix(topic, "/ack"):
		tableID := int(jsonFloat(data, "tableId"))
		lightState := jsonString(data, "lightState")
		c.logger.Info("ACK received", "tableId", tableID, "lightState", lightState)
		var ls domain.LightStatus
		if lightState == "ON" {
			ls = domain.LightOn
		} else {
			ls = domain.LightOff
		}
		c.coordinator.ConfirmLightStatus(tableID, ls)

	// ── ESP32 boot sync request ───────────────────────────────────
	case topic == "gbc/hardware/sync/request":
		c.logger.Info("ESP32 sync request received")
		c.publishFullStateSync()

	// ── Full sync ACK ─────────────────────────────────────────────
	case topic == "gbc/hardware/sync/ack":
		c.logger.Info("full sync ACK received")
		c.coordinator.ConfirmFullSync()

	// ── Hardware health response ──────────────────────────────────
	case topic == "gbc/hardware/health/response":
		cmdID := jsonString(data, "commandId")
		c.healthMu.Lock()
		ch, ok := c.healthPending[cmdID]
		if ok {
			delete(c.healthPending, cmdID)
		}
		c.healthMu.Unlock()
		if ok {
			ch <- data
		}

	// ── LWT / status ──────────────────────────────────────────────
	case topic == "gbc/hardware/status":
		status := jsonString(data, "status")
		c.logger.Warn("hardware status changed", "status", status)
	}
}

func (c *MqttClient) publishRelayCommand(cmd domain.MqttCommand) {
	if !c.IsConnected() {
		c.logger.Warn("not connected, relay command dropped", "tableId", cmd.TableID, "lightState", cmd.LightState)
		return
	}
	topic := fmt.Sprintf("gbc/hardware/table/%d/set", cmd.TableID)
	payload, _ := json.Marshal(map[string]any{
		"commandId":  cmd.CommandID,
		"tableId":    cmd.TableID,
		"lightState": cmd.LightState,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
	c.client.Publish(topic, 1, false, payload)
	c.logger.Info("relay command published", "topic", topic, "lightState", cmd.LightState)
}

func (c *MqttClient) publishFullStateSync() {
	snapshot := c.coordinator.GetCacheSnapshot()
	tables := make([]map[string]any, 0, len(snapshot))
	for _, t := range snapshot {
		lightState := "OFF"
		if t.LightStatus == domain.LightOn || t.LightStatus == domain.LightPendingOn {
			lightState = "ON"
		}
		tables = append(tables, map[string]any{
			"tableId":    t.TableID,
			"lightState": lightState,
		})
	}
	payload, _ := json.Marshal(map[string]any{
		"commandId": fmt.Sprintf("sync_%d", time.Now().UnixMilli()),
		"tables":    tables,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	c.client.Publish("gbc/hardware/sync/response", 1, false, payload)
	c.logger.Info("full state sync published")
}

func jsonFloat(m map[string]any, key string) float64 {
	v, _ := m[key].(float64)
	return v
}

func jsonString(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return v
}
