package runtime

import (
	"context"
	"errors"
	"fmt"

	"github.com/royzxje/zlo-go/apps/zalo-connector/internal/events"
	"github.com/royzxje/zlo-go/apps/zalo-connector/internal/zalo"
)

type Command struct {
	Type       string            `json:"type"`
	CommandID  string            `json:"command_id"`
	MessageID  string            `json:"message_id"`
	ThreadID   string            `json:"thread_id"`
	ThreadType string            `json:"thread_type"`
	Payload    map[string]string `json:"payload"`
}

type CommandHandler struct {
	zalo zalo.Client
}

func NewCommandHandler(zaloClient zalo.Client) CommandHandler {
	return CommandHandler{zalo: zaloClient}
}

func (h CommandHandler) Handle(ctx context.Context, cmd Command) (events.SendSucceededEvent, error) {
	switch cmd.Type {
	case "command.send_text":
		text := cmd.Payload["text"]
		if text == "" {
			return events.SendSucceededEvent{}, errors.New("command.send_text payload text is required")
		}

		zaloMessageID, err := h.zalo.SendText(ctx, cmd.ThreadID, cmd.ThreadType, text)
		if err != nil {
			return events.SendSucceededEvent{}, err
		}

		return events.NewSendSucceeded(cmd.CommandID, cmd.MessageID, zaloMessageID), nil
	default:
		return events.SendSucceededEvent{}, fmt.Errorf("unsupported command type %q", cmd.Type)
	}
}
