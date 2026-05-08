package runtime

import (
	"context"
	"testing"
)

type fakeZalo struct {
	sentText string
}

func (f *fakeZalo) SendText(_ context.Context, text string) error {
	f.sentText = text
	return nil
}

func TestHandleSendTextSendsPayloadText(t *testing.T) {
	zalo := &fakeZalo{}
	handler := NewCommandHandler(zalo)

	cmd := Command{
		Type: "command.send_text",
		Payload: map[string]string{
			"text": "hello zalo",
		},
	}

	if err := handler.Handle(context.Background(), cmd); err != nil {
		t.Fatalf("Handle() error = %v", err)
	}

	if zalo.sentText != "hello zalo" {
		t.Fatalf("sent text = %q, want %q", zalo.sentText, "hello zalo")
	}
}

func TestHandleUnsupportedCommandTypeReturnsError(t *testing.T) {
	handler := NewCommandHandler(&fakeZalo{})

	err := handler.Handle(context.Background(), Command{Type: "command.unsupported"})
	if err == nil {
		t.Fatal("Handle() error = nil, want error")
	}
}

func TestHandleSendTextMissingTextReturnsError(t *testing.T) {
	handler := NewCommandHandler(&fakeZalo{})

	err := handler.Handle(context.Background(), Command{Type: "command.send_text"})
	if err == nil {
		t.Fatal("Handle() error = nil, want error")
	}
}
