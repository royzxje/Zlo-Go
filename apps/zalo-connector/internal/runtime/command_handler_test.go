package runtime

import (
	"context"
	"testing"

	"github.com/royzxje/zlo-go/apps/zalo-connector/internal/events"
)

type fakeZalo struct {
	threadID      string
	threadType    string
	sentText      string
	zaloMessageID string
}

func (f *fakeZalo) SendText(_ context.Context, threadID string, threadType string, text string) (string, error) {
	f.threadID = threadID
	f.threadType = threadType
	f.sentText = text
	return f.zaloMessageID, nil
}

func TestHandleSendTextSendsPayloadTextAndReturnsSucceededEvent(t *testing.T) {
	zalo := &fakeZalo{zaloMessageID: "zalo-789"}
	handler := NewCommandHandler(zalo)

	cmd := Command{
		Type:       "command.send_text",
		CommandID:  "cmd-123",
		MessageID:  "msg-456",
		ThreadID:   "thread-abc",
		ThreadType: "user",
		Payload: map[string]string{
			"text": "hello zalo",
		},
	}

	got, err := handler.Handle(context.Background(), cmd)
	if err != nil {
		t.Fatalf("Handle() error = %v", err)
	}

	want := events.NewSendSucceeded("cmd-123", "msg-456", "zalo-789")
	if got != want {
		t.Fatalf("Handle() event = %#v, want %#v", got, want)
	}

	if zalo.threadID != "thread-abc" {
		t.Fatalf("thread ID = %q, want %q", zalo.threadID, "thread-abc")
	}

	if zalo.threadType != "user" {
		t.Fatalf("thread type = %q, want %q", zalo.threadType, "user")
	}

	if zalo.sentText != "hello zalo" {
		t.Fatalf("sent text = %q, want %q", zalo.sentText, "hello zalo")
	}
}

func TestHandleUnsupportedCommandTypeReturnsError(t *testing.T) {
	handler := NewCommandHandler(&fakeZalo{})

	got, err := handler.Handle(context.Background(), Command{Type: "command.unsupported"})
	if err == nil {
		t.Fatal("Handle() error = nil, want error")
	}

	if got != (events.SendSucceededEvent{}) {
		t.Fatalf("Handle() event = %#v, want zero event", got)
	}
}

func TestHandleSendTextMissingTextReturnsError(t *testing.T) {
	handler := NewCommandHandler(&fakeZalo{})

	got, err := handler.Handle(context.Background(), Command{Type: "command.send_text"})
	if err == nil {
		t.Fatal("Handle() error = nil, want error")
	}

	if got != (events.SendSucceededEvent{}) {
		t.Fatalf("Handle() event = %#v, want zero event", got)
	}
}

func TestHandleSendTextEmptyTextReturnsError(t *testing.T) {
	handler := NewCommandHandler(&fakeZalo{})

	got, err := handler.Handle(context.Background(), Command{
		Type: "command.send_text",
		Payload: map[string]string{
			"text": "",
		},
	})
	if err == nil {
		t.Fatal("Handle() error = nil, want error")
	}

	if got != (events.SendSucceededEvent{}) {
		t.Fatalf("Handle() event = %#v, want zero event", got)
	}
}
