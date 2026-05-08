package runtime

import (
	"context"
	"errors"
	"fmt"

	"github.com/royzxje/zlo-go/apps/zalo-connector/internal/zalo"
)

type Command struct {
	Type    string            `json:"type"`
	Payload map[string]string `json:"payload"`
}

type CommandHandler struct {
	zalo zalo.Client
}

func NewCommandHandler(zaloClient zalo.Client) CommandHandler {
	return CommandHandler{zalo: zaloClient}
}

func (h CommandHandler) Handle(ctx context.Context, cmd Command) error {
	switch cmd.Type {
	case "command.send_text":
		text := cmd.Payload["text"]
		if text == "" {
			return errors.New("command.send_text payload text is required")
		}

		return h.zalo.SendText(ctx, text)
	default:
		return fmt.Errorf("unsupported command type %q", cmd.Type)
	}
}
