package runtime

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/royzxje/zlo-go/apps/zalo-connector/internal/events"
)

const (
	CommandsStream = "zalo.commands"
	EventsStream   = "zalo.events"
)

type StreamEntry struct {
	ID     string
	Fields map[string]string
}

type PublishedStreamEntry struct {
	Stream string
	Event  any
}

type StreamClient interface {
	ReadOne(ctx context.Context, stream string) (StreamEntry, error)
	Publish(ctx context.Context, stream string, event any) error
	Ack(ctx context.Context, stream string, id string) error
}

type CommandProcessor interface {
	Handle(ctx context.Context, cmd Command) (events.SendSucceededEvent, error)
}

type RedisStreamRunner struct {
	client  StreamClient
	handler CommandProcessor
}

func NewRedisStreamRunner(client StreamClient, handler CommandProcessor) *RedisStreamRunner {
	return &RedisStreamRunner{client: client, handler: handler}
}

func (r *RedisStreamRunner) ProcessOne(ctx context.Context) error {
	entry, err := r.client.ReadOne(ctx, CommandsStream)
	if err != nil {
		return err
	}

	rawEvent, ok := entry.Fields["event"]
	if !ok {
		return errors.New("Redis stream entry is missing event field")
	}

	var cmd Command
	if err := json.Unmarshal([]byte(rawEvent), &cmd); err != nil {
		return err
	}

	event, err := r.handler.Handle(ctx, cmd)
	if err != nil {
		return err
	}

	if err := r.client.Publish(ctx, EventsStream, event); err != nil {
		return err
	}

	return r.client.Ack(ctx, CommandsStream, entry.ID)
}
