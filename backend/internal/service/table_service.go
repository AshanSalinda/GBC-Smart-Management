// Package service contains the core business logic for the GBC Smart Management system.
package service

import (
	"fmt"
	"log/slog"
	"time"

	"gbc/backend/internal/domain"
)

// TableService is the single coordinator for all table state transitions.
// It is the ONLY component allowed to mutate the cache.
// It bridges the cache (which broadcasts to WS) and the MQTT client (via mqttCmdChan).
//
// Dependency graph:
//
//	handler/scheduler → TableService → Cache → broadcastChan → WS Hub
//	                                 → mqttCmdChan          → MQTT Client
//	MQTT Client (ACK) → TableService.ConfirmLightStatus() → Cache → broadcastChan
type TableService struct {
	cache       domain.TableCache
	mqttCmdChan chan<- domain.MqttCommand
	logger      *slog.Logger
}

// NewTableService creates a new TableService.
func NewTableService(cache domain.TableCache, mqttCmdChan chan<- domain.MqttCommand) *TableService {
	return &TableService{
		cache:       cache,
		mqttCmdChan: mqttCmdChan,
		logger:      slog.Default().With("module", "TABL"),
	}
}

// ActivateTable transitions a table to BUSY and queues a relay ON command for the ESP32.
func (s *TableService) ActivateTable(tableID int, booking domain.CurrentBooking, source string) {
	s.cache.ActivateTable(tableID, booking)
	s.sendMqttCommand(tableID, "ON")
	s.logger.Info("activated", "tableId", tableID, "source", source)
}

// DeactivateTable transitions a table to AVAILABLE and queues a relay OFF command.
func (s *TableService) DeactivateTable(tableID int, source string) {
	s.cache.DeactivateTable(tableID)
	s.sendMqttCommand(tableID, "OFF")
	s.logger.Info("deactivated", "tableId", tableID, "source", source)
}

// SetLightStatus applies a manual light override and queues the relay command.
func (s *TableService) SetLightStatus(tableID int, targetState domain.LightStatus, source string) {
	s.cache.SetLightStatus(tableID, targetState)
	lightCmd := "OFF"
	if targetState == domain.LightOn {
		lightCmd = "ON"
	}
	s.sendMqttCommand(tableID, lightCmd)
	s.logger.Info("light override", "tableId", tableID, "state", lightCmd, "source", source)
}

// UpdateCurrentBooking patches live booking metadata in the cache (used by PATCH booking).
func (s *TableService) UpdateCurrentBooking(tableID int, partial domain.CurrentBooking) {
	s.cache.UpdateCurrentBooking(tableID, partial)
}

// ─── domain.TableCoordinator implementation (called by MQTT client on ACK/sync) ───

// ConfirmLightStatus resolves PENDING-ON/PENDING-OFF in the cache after hardware ACK.
func (s *TableService) ConfirmLightStatus(tableID int, state domain.LightStatus) {
	s.cache.ConfirmLightStatus(tableID, state)
}

// ConfirmFullSync resolves all pending states after hardware sends a sync ACK.
func (s *TableService) ConfirmFullSync() {
	s.cache.ConfirmFullSync()
}

// GetCacheSnapshot returns the full current state (used by MQTT for full sync publish).
func (s *TableService) GetCacheSnapshot() []domain.TableState {
	return s.cache.GetAll()
}

// ─── Cache read passthrough ────────────────────────────────────────────────────

// GetTable returns a single table's state.
func (s *TableService) GetTable(tableID int) (domain.TableState, bool) {
	return s.cache.GetTable(tableID)
}

// ─── Private ──────────────────────────────────────────────────────────────────

func (s *TableService) sendMqttCommand(tableID int, lightState string) {
	cmd := domain.MqttCommand{
		CommandID:  fmt.Sprintf("cmd_%d_%d", time.Now().UnixMilli(), tableID),
		TableID:    tableID,
		LightState: lightState,
	}
	select {
	case s.mqttCmdChan <- cmd:
	default:
		s.logger.Warn("mqttCmdChan full, MQTT command dropped", "tableId", tableID, "lightState", lightState)
	}
}
