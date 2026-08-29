// Package repository provides MongoDB implementations of the domain repository interfaces.
package repository

import (
	"context"
	"fmt"
	"time"

	"gbc/backend/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// bookingDoc is the internal MongoDB document shape for a booking.
type bookingDoc struct {
	ID              primitive.ObjectID `bson:"_id,omitempty"`
	TableID         int                `bson:"tableId"`
	BookerName      string             `bson:"bookerName"`
	BookerMobile    string             `bson:"bookerMobile"`
	CheckInTime     time.Time          `bson:"checkInTime"`
	CheckOutTime    time.Time          `bson:"checkOutTime"`
	DurationMinutes int                `bson:"durationMinutes"`
	Amount          float64            `bson:"amount"`
	IsPaid          bool               `bson:"isPaid"`
	Status          string             `bson:"status"`
	CreatedBy       string             `bson:"createdBy"`
	CreatedAt       time.Time          `bson:"createdAt"`
}

func docToBooking(d bookingDoc) domain.Booking {
	return domain.Booking{
		ID:              d.ID.Hex(),
		TableID:         d.TableID,
		BookerName:      d.BookerName,
		BookerMobile:    d.BookerMobile,
		CheckInTime:     d.CheckInTime,
		CheckOutTime:    d.CheckOutTime,
		DurationMinutes: d.DurationMinutes,
		Amount:          d.Amount,
		IsPaid:          d.IsPaid,
		Status:          d.Status,
		CreatedBy:       d.CreatedBy,
		CreatedAt:       d.CreatedAt,
	}
}

func bookingToDoc(b *domain.Booking) (bookingDoc, error) {
	doc := bookingDoc{
		TableID:         b.TableID,
		BookerName:      b.BookerName,
		BookerMobile:    b.BookerMobile,
		CheckInTime:     b.CheckInTime,
		CheckOutTime:    b.CheckOutTime,
		DurationMinutes: b.DurationMinutes,
		Amount:          b.Amount,
		IsPaid:          b.IsPaid,
		Status:          b.Status,
		CreatedBy:       b.CreatedBy,
		CreatedAt:       b.CreatedAt,
	}
	if b.ID != "" {
		oid, err := primitive.ObjectIDFromHex(b.ID)
		if err != nil {
			return doc, fmt.Errorf("bookingToDoc: invalid id %q: %w", b.ID, err)
		}
		doc.ID = oid
	}
	return doc, nil
}

// MongoBookingRepository implements domain.BookingRepository against MongoDB.
type MongoBookingRepository struct {
	col *mongo.Collection
}

// NewMongoBookingRepository creates a new booking repository.
func NewMongoBookingRepository(db *mongo.Database) *MongoBookingRepository {
	col := db.Collection("bookings")
	// Ensure compound index for fast overlap checks and timeline queries
	col.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys: bson.D{
			{Key: "tableId", Value: 1},
			{Key: "checkInTime", Value: 1},
			{Key: "checkOutTime", Value: 1},
		},
	})
	return &MongoBookingRepository{col: col}
}

func (r *MongoBookingRepository) Create(b *domain.Booking) error {
	doc, err := bookingToDoc(b)
	if err != nil {
		return err
	}
	doc.ID = primitive.NewObjectID()
	if doc.CreatedAt.IsZero() {
		doc.CreatedAt = time.Now().UTC()
	}
	res, err := r.col.InsertOne(context.Background(), doc)
	if err != nil {
		return fmt.Errorf("booking create: %w", err)
	}
	b.ID = res.InsertedID.(primitive.ObjectID).Hex()
	return nil
}

func (r *MongoBookingRepository) FindByID(id string) (*domain.Booking, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, fmt.Errorf("invalid booking id %q: %w", id, err)
	}
	var doc bookingDoc
	err = r.col.FindOne(context.Background(), bson.M{"_id": oid}).Decode(&doc)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("booking find: %w", err)
	}
	b := docToBooking(doc)
	return &b, nil
}

func (r *MongoBookingRepository) Save(b *domain.Booking) error {
	oid, err := primitive.ObjectIDFromHex(b.ID)
	if err != nil {
		return fmt.Errorf("invalid booking id %q: %w", b.ID, err)
	}
	doc, err := bookingToDoc(b)
	if err != nil {
		return err
	}
	_, err = r.col.ReplaceOne(context.Background(), bson.M{"_id": oid}, doc)
	return err
}

func (r *MongoBookingRepository) FindTimeline(start, end time.Time) ([]domain.Booking, error) {
	filter := bson.M{
		"status":      bson.M{"$ne": "CANCELLED"},
		"checkInTime": bson.M{"$lt": end},
		"checkOutTime": bson.M{"$gt": start},
	}
	opts := options.Find().SetSort(bson.D{{Key: "tableId", Value: 1}, {Key: "checkInTime", Value: 1}})
	cur, err := r.col.Find(context.Background(), filter, opts)
	if err != nil {
		return nil, fmt.Errorf("booking timeline: %w", err)
	}
	defer cur.Close(context.Background())
	var docs []bookingDoc
	if err = cur.All(context.Background(), &docs); err != nil {
		return nil, err
	}
	bookings := make([]domain.Booking, len(docs))
	for i, d := range docs {
		bookings[i] = docToBooking(d)
	}
	return bookings, nil
}

func (r *MongoBookingRepository) FindCurrentForTable(tableID int, now time.Time) (*domain.Booking, error) {
	filter := bson.M{
		"tableId":      tableID,
		"status":       bson.M{"$ne": "CANCELLED"},
		"checkInTime":  bson.M{"$lte": now},
		"checkOutTime": bson.M{"$gt": now},
	}
	var doc bookingDoc
	err := r.col.FindOne(context.Background(), filter).Decode(&doc)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("findCurrentForTable: %w", err)
	}
	b := docToBooking(doc)
	return &b, nil
}

func (r *MongoBookingRepository) FindNextUpcoming(tableID int, after time.Time) (*domain.Booking, error) {
	filter := bson.M{
		"tableId":     tableID,
		"status":      bson.M{"$ne": "CANCELLED"},
		"checkInTime": bson.M{"$gt": after},
	}
	opts := options.FindOne().SetSort(bson.D{{Key: "checkInTime", Value: 1}})
	var doc bookingDoc
	err := r.col.FindOne(context.Background(), filter, opts).Decode(&doc)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("findNextUpcoming: %w", err)
	}
	b := docToBooking(doc)
	return &b, nil
}

func (r *MongoBookingRepository) FindAllActiveNow(now time.Time) ([]domain.Booking, error) {
	filter := bson.M{
		"status":      bson.M{"$ne": "CANCELLED"},
		"checkInTime": bson.M{"$lte": now},
		"checkOutTime": bson.M{"$gt": now},
	}
	cur, err := r.col.Find(context.Background(), filter)
	if err != nil {
		return nil, fmt.Errorf("findAllActiveNow: %w", err)
	}
	defer cur.Close(context.Background())
	var docs []bookingDoc
	if err = cur.All(context.Background(), &docs); err != nil {
		return nil, err
	}
	bookings := make([]domain.Booking, len(docs))
	for i, d := range docs {
		bookings[i] = docToBooking(d)
	}
	return bookings, nil
}

func (r *MongoBookingRepository) HasOverlap(tableID int, checkIn, checkOut time.Time, excludeID string) (bool, error) {
	filter := bson.M{
		"tableId":      tableID,
		"status":       bson.M{"$ne": "CANCELLED"},
		"checkInTime":  bson.M{"$lt": checkOut},
		"checkOutTime": bson.M{"$gt": checkIn},
	}
	if excludeID != "" {
		oid, err := primitive.ObjectIDFromHex(excludeID)
		if err == nil {
			filter["_id"] = bson.M{"$ne": oid}
		}
	}
	count, err := r.col.CountDocuments(context.Background(), filter, options.Count().SetLimit(1))
	if err != nil {
		return false, fmt.Errorf("hasOverlap: %w", err)
	}
	return count > 0, nil
}
