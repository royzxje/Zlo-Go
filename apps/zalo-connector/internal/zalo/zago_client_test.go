package zalo

import (
	"context"
	"errors"
	"testing"
	"time"

	zago "github.com/tranhaonguyendev/za-go"
)

func TestNewZagoClientRequiresIMEI(t *testing.T) {
	client, err := NewZagoClient(Config{IMEI: ""})
	if err == nil {
		t.Fatal("expected missing IMEI to return an error")
	}
	if client != nil {
		t.Fatalf("expected nil client on error, got %#v", client)
	}
}

func TestZagoClientSatisfiesClientInterface(t *testing.T) {
	var _ Client = (*ZagoClient)(nil)
}

func TestSendTextReturnsWhenContextAlreadyCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	client := &ZagoClient{sender: blockingSender{}}

	_, err := client.SendText(ctx, "thread", "user", "hello")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context canceled error, got %v", err)
	}
}

func TestExtractMessageIDCommonKeys(t *testing.T) {
	keys := []string{
		"msgId",
		"msg_id",
		"messageId",
		"message_id",
		"id",
		"cliMsgId",
		"cli_msg_id",
		"clientId",
		"client_id",
		"zaloMessageId",
		"zalo_message_id",
	}

	for _, key := range keys {
		t.Run(key, func(t *testing.T) {
			id, err := extractMessageID(map[string]any{key: " message-123 "})
			if err != nil {
				t.Fatalf("expected ID for key %q, got error %v", key, err)
			}
			if id != "message-123" {
				t.Fatalf("expected trimmed message ID, got %q", id)
			}
		})
	}
}

func TestExtractMessageIDReturnsErrorWhenNoStableIDExists(t *testing.T) {
	id, err := extractMessageID(map[string]any{"status": "ok"})
	if err == nil {
		t.Fatal("expected error when response has no stable message ID")
	}
	if id != "" {
		t.Fatalf("expected empty ID on error, got %q", id)
	}
}

type blockingSender struct{}

func (blockingSender) SendMessage(zago.Message, string, zago.ThreadType) (any, error) {
	time.Sleep(time.Hour)
	return nil, nil
}
