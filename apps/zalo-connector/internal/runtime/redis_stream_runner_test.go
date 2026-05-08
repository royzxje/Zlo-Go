package runtime

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/royzxje/zlo-go/apps/zalo-connector/internal/events"
)

type fakeStreamClient struct {
	entry StreamEntry
	added []PublishedStreamEntry
	acked []string
}

func (f *fakeStreamClient) ReadOne(ctx context.Context, stream string) (StreamEntry, error) {
	return f.entry, nil
}

func (f *fakeStreamClient) Publish(ctx context.Context, stream string, event any) error {
	f.added = append(f.added, PublishedStreamEntry{Stream: stream, Event: event})
	return nil
}

func (f *fakeStreamClient) Ack(ctx context.Context, stream string, id string) error {
	f.acked = append(f.acked, id)
	return nil
}

type fakeCommandProcessor struct{}

func (fakeCommandProcessor) Handle(ctx context.Context, cmd Command) (events.SendSucceededEvent, error) {
	return events.NewSendSucceeded(cmd.CommandID, cmd.MessageID, "zalo-msg-1"), nil
}

func TestRedisStreamRunnerProcessesCommandPublishesEventThenAcks(t *testing.T) {
	command := Command{
		Type:       "command.send_text",
		CommandID:  "cmd-1",
		MessageID:  "msg-1",
		ThreadID:   "thread-1",
		ThreadType: "USER",
		Payload:    map[string]any{"text": "Hello"},
	}
	rawCommand, err := json.Marshal(command)
	if err != nil {
		t.Fatal(err)
	}
	client := &fakeStreamClient{entry: StreamEntry{
		ID:     "1746700000000-0",
		Fields: map[string]string{"event": string(rawCommand)},
	}}
	runner := NewRedisStreamRunner(client, fakeCommandProcessor{})

	if err := runner.ProcessOne(context.Background()); err != nil {
		t.Fatalf("ProcessOne returned error: %v", err)
	}

	if len(client.added) != 1 {
		t.Fatalf("expected one published event, got %d", len(client.added))
	}
	if client.added[0].Stream != "zalo.events" {
		t.Fatalf("published stream = %q, want zalo.events", client.added[0].Stream)
	}
	if got := client.added[0].Event.(events.SendSucceededEvent); got.MessageID != "msg-1" || got.ZaloMessageID != "zalo-msg-1" {
		t.Fatalf("published event = %#v", got)
	}
	if len(client.acked) != 1 || client.acked[0] != "1746700000000-0" {
		t.Fatalf("acked IDs = %#v", client.acked)
	}
}
