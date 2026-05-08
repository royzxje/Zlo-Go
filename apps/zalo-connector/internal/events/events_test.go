package events

import "testing"

func TestSendSucceededEvent(t *testing.T) {
	event := NewSendSucceeded("cmd-1", "msg-1", "zalo-msg-1")
	if event.Type != "message.send_succeeded" {
		t.Fatalf("expected message.send_succeeded, got %s", event.Type)
	}
	if event.CommandID != "cmd-1" || event.MessageID != "msg-1" || event.ZaloMessageID != "zalo-msg-1" {
		t.Fatalf("unexpected event: %#v", event)
	}
}
