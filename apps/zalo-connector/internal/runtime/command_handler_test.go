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
		ThreadType: "USER",
		Payload: map[string]any{
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

	if zalo.threadType != "USER" {
		t.Fatalf("thread type = %q, want %q", zalo.threadType, "USER")
	}

	if zalo.sentText != "hello zalo" {
		t.Fatalf("sent text = %q, want %q", zalo.sentText, "hello zalo")
	}
}

func TestHandleUnsupportedCommandTypeReturnsError(t *testing.T) {
	handler := NewCommandHandler(&fakeZalo{})

	got, err := handler.Handle(context.Background(), validSendTextCommand(func(cmd *Command) {
		cmd.Type = "command.unsupported"
	}))
	if err == nil {
		t.Fatal("Handle() error = nil, want error")
	}

	if got != (events.SendSucceededEvent{}) {
		t.Fatalf("Handle() event = %#v, want zero event", got)
	}
}

func TestHandleSendTextMissingTextReturnsError(t *testing.T) {
	handler := NewCommandHandler(&fakeZalo{})

	got, err := handler.Handle(context.Background(), validSendTextCommand(func(cmd *Command) {
		delete(cmd.Payload, "text")
	}))
	if err == nil {
		t.Fatal("Handle() error = nil, want error")
	}

	if got != (events.SendSucceededEvent{}) {
		t.Fatalf("Handle() event = %#v, want zero event", got)
	}
}

func TestHandleSendTextEmptyTextReturnsError(t *testing.T) {
	handler := NewCommandHandler(&fakeZalo{})

	got, err := handler.Handle(context.Background(), validSendTextCommand(func(cmd *Command) {
		cmd.Payload["text"] = ""
	}))
	if err == nil {
		t.Fatal("Handle() error = nil, want error")
	}

	if got != (events.SendSucceededEvent{}) {
		t.Fatalf("Handle() event = %#v, want zero event", got)
	}
}

func TestHandleValidatesRequiredEnvelopeFields(t *testing.T) {
	tests := []struct {
		name string
		edit func(*Command)
	}{
		{name: "missing command_id", edit: func(cmd *Command) { cmd.CommandID = "" }},
		{name: "missing message_id", edit: func(cmd *Command) { cmd.MessageID = "" }},
		{name: "missing thread_id", edit: func(cmd *Command) { cmd.ThreadID = "" }},
		{name: "missing thread_type", edit: func(cmd *Command) { cmd.ThreadType = "" }},
		{name: "invalid thread_type", edit: func(cmd *Command) { cmd.ThreadType = "PAGE" }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewCommandHandler(&fakeZalo{})

			got, err := handler.Handle(context.Background(), validSendTextCommand(tt.edit))
			if err == nil {
				t.Fatal("Handle() error = nil, want error")
			}

			if got != (events.SendSucceededEvent{}) {
				t.Fatalf("Handle() event = %#v, want zero event", got)
			}
		})
	}
}

func TestHandleSendTextNonStringTextReturnsError(t *testing.T) {
	handler := NewCommandHandler(&fakeZalo{})

	got, err := handler.Handle(context.Background(), validSendTextCommand(func(cmd *Command) {
		cmd.Payload["text"] = 42
	}))
	if err == nil {
		t.Fatal("Handle() error = nil, want error")
	}

	if got != (events.SendSucceededEvent{}) {
		t.Fatalf("Handle() event = %#v, want zero event", got)
	}
}

func validSendTextCommand(edit func(*Command)) Command {
	cmd := Command{
		Type:       "command.send_text",
		CommandID:  "cmd-123",
		MessageID:  "msg-456",
		ThreadID:   "thread-abc",
		ThreadType: "USER",
		Payload: map[string]any{
			"text": "hello zalo",
		},
	}
	if edit != nil {
		edit(&cmd)
	}
	return cmd
}
