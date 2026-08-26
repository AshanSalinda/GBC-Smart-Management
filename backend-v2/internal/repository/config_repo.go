package repository

import (
	"context"
	"fmt"
	"time"

	"gbc/backend/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type configDoc struct {
	Key                string    `bson:"key"`
	HourlyRate         float64   `bson:"hourlyRate"`
	WorkingHoursPerDay int       `bson:"workingHoursPerDay"`
	VenueStartTime     string    `bson:"venueStartTime"`
	UpdatedAt          time.Time `bson:"updatedAt"`
}

// MongoConfigRepository implements domain.ConfigRepository.
type MongoConfigRepository struct {
	col *mongo.Collection
}

func NewMongoConfigRepository(db *mongo.Database) *MongoConfigRepository {
	return &MongoConfigRepository{col: db.Collection("configs")}
}

func (r *MongoConfigRepository) EnsureDefault() error {
	count, err := r.col.CountDocuments(context.Background(), bson.M{"key": "GLOBAL_CONFIG"})
	if err != nil {
		return fmt.Errorf("config ensureDefault count: %w", err)
	}
	if count > 0 {
		return nil
	}
	_, err = r.col.InsertOne(context.Background(), configDoc{
		Key:                "GLOBAL_CONFIG",
		HourlyRate:         1500,
		WorkingHoursPerDay: 16,
		VenueStartTime:     "09:00",
		UpdatedAt:          time.Now().UTC(),
	})
	if err != nil {
		return fmt.Errorf("config ensureDefault insert: %w", err)
	}
	return nil
}

func (r *MongoConfigRepository) Get() (*domain.VenueConfig, error) {
	var doc configDoc
	err := r.col.FindOne(context.Background(), bson.M{"key": "GLOBAL_CONFIG"}).Decode(&doc)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("config get: %w", err)
	}
	cfg := domain.VenueConfig{
		HourlyRate:         doc.HourlyRate,
		WorkingHoursPerDay: doc.WorkingHoursPerDay,
		VenueStartTime:     doc.VenueStartTime,
		UpdatedAt:          doc.UpdatedAt,
	}
	return &cfg, nil
}

func (r *MongoConfigRepository) Update(updates map[string]any) (*domain.VenueConfig, error) {
	updates["updatedAt"] = time.Now().UTC()
	after := options.After
	var doc configDoc
	err := r.col.FindOneAndUpdate(
		context.Background(),
		bson.M{"key": "GLOBAL_CONFIG"},
		bson.M{"$set": updates},
		options.FindOneAndUpdate().SetReturnDocument(after).SetUpsert(true),
	).Decode(&doc)
	if err != nil {
		return nil, fmt.Errorf("config update: %w", err)
	}
	cfg := domain.VenueConfig{
		HourlyRate:         doc.HourlyRate,
		WorkingHoursPerDay: doc.WorkingHoursPerDay,
		VenueStartTime:     doc.VenueStartTime,
		UpdatedAt:          doc.UpdatedAt,
	}
	return &cfg, nil
}
