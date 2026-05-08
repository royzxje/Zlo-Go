package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

func NewRedisClient(redisURL string) (*RedisClient, error) {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	return &RedisClient{client: redis.NewClient(options)}, nil
}

func (c *RedisClient) Close() error {
	return c.client.Close()
}

func (c *RedisClient) ReadOne(ctx context.Context, stream string) (StreamEntry, error) {
	streams, err := c.client.XRead(ctx, &redis.XReadArgs{
		Streams: []string{stream, "0"},
		Count:   1,
		Block:   5 * time.Second,
	}).Result()
	if err != nil {
		return StreamEntry{}, err
	}
	if len(streams) == 0 || len(streams[0].Messages) == 0 {
		return StreamEntry{}, errors.New("no Redis stream entry available")
	}

	message := streams[0].Messages[0]
	fields := make(map[string]string, len(message.Values))
	for key, value := range message.Values {
		fields[key] = valueToString(value)
	}

	return StreamEntry{ID: message.ID, Fields: fields}, nil
}

func (c *RedisClient) Publish(ctx context.Context, stream string, event any) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return c.client.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: map[string]any{"event": string(payload)},
	}).Err()
}

func (c *RedisClient) Ack(ctx context.Context, stream string, id string) error {
	return c.client.XDel(ctx, stream, id).Err()
}

func valueToString(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	if bytes, ok := value.([]byte); ok {
		return string(bytes)
	}
	return ""
}
