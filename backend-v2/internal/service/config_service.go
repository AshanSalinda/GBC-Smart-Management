package service

import (
	"fmt"
	"log/slog"

	"gbc/backend/internal/domain"
)

// ConfigService manages the global venue configuration.
type ConfigService struct {
	repo   domain.ConfigRepository
	logger *slog.Logger
}

func NewConfigService(repo domain.ConfigRepository) *ConfigService {
	return &ConfigService{
		repo:   repo,
		logger: slog.Default().With("module", "CONF"),
	}
}

func (s *ConfigService) GetConfig() (*domain.VenueConfig, error) {
	cfg, err := s.repo.Get()
	if err != nil {
		return nil, fmt.Errorf("get config: %w", err)
	}
	return cfg, nil
}

func (s *ConfigService) UpdateConfig(updates map[string]any) (*domain.VenueConfig, error) {
	// Validate allowed fields
	allowed := map[string]bool{"hourlyRate": true, "workingHoursPerDay": true, "venueStartTime": true}
	for k := range updates {
		if !allowed[k] {
			return nil, &ValidationError{Code: 400, Message: fmt.Sprintf("unknown config field: %s", k)}
		}
	}
	cfg, err := s.repo.Update(updates)
	if err != nil {
		return nil, fmt.Errorf("update config: %w", err)
	}
	s.logger.Info("updated", "fields", fmt.Sprint(updates))
	return cfg, nil
}
