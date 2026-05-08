package zalo

import (
	"context"
	"errors"
	"fmt"
	"strings"

	zago "github.com/tranhaonguyendev/za-go"
)

type Config struct {
	Phone          string
	Password       string
	IMEI           string
	SessionCookies any
	UserAgent      string
	AutoLogin      bool
}

type ZagoClient struct {
	sender messageSender
}

type messageSender interface {
	SendMessage(zago.Message, string, zago.ThreadType) (any, error)
}

func NewZagoClient(config Config) (*ZagoClient, error) {
	if strings.TrimSpace(config.IMEI) == "" {
		return nil, errors.New("imei is required")
	}

	api, err := zago.Zalo(config.Phone, config.Password, config.IMEI, config.SessionCookies, config.UserAgent, config.AutoLogin, 0)
	if err != nil {
		return nil, err
	}

	return &ZagoClient{sender: api}, nil
}

func (c *ZagoClient) SendText(ctx context.Context, threadID string, threadType string, text string) (string, error) {
	if c == nil || c.sender == nil {
		return "", errors.New("zago client is not initialized")
	}

	select {
	case <-ctx.Done():
		return "", ctx.Err()
	default:
	}

	typeValue, err := zagoThreadType(threadType)
	if err != nil {
		return "", err
	}

	type sendResult struct {
		response any
		err      error
	}
	resultCh := make(chan sendResult, 1)
	go func() {
		response, err := c.sender.SendMessage(zago.Message{Text: text}, threadID, typeValue)
		resultCh <- sendResult{response: response, err: err}
	}()

	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case result := <-resultCh:
		if result.err != nil {
			return "", result.err
		}
		return extractMessageID(result.response)
	}
}

func zagoThreadType(threadType string) (zago.ThreadType, error) {
	switch strings.ToLower(strings.TrimSpace(threadType)) {
	case "user", "threadtypeuser":
		return zago.ThreadTypeUSER, nil
	case "group", "threadtypegroup":
		return zago.ThreadTypeGROUP, nil
	default:
		return 0, fmt.Errorf("unsupported thread type %q", threadType)
	}
}

func extractMessageID(response any) (string, error) {
	if response == nil {
		return "", errors.New("zago send response does not include a stable message ID")
	}
	if value, ok := lookupMessageID(response); ok {
		id := strings.TrimSpace(fmt.Sprint(value))
		if id != "" && id != "<nil>" {
			return id, nil
		}
	}
	return "", errors.New("zago send response does not include a stable message ID")
}

func lookupMessageID(value any) (any, bool) {
	object, ok := value.(interface{ ToMap() map[string]any })
	if ok {
		value = object.ToMap()
	}

	data, ok := value.(map[string]any)
	if !ok {
		return nil, false
	}

	for _, key := range []string{"msgId", "msg_id", "messageId", "message_id", "id", "cliMsgId", "cli_msg_id", "clientId", "client_id", "zaloMessageId", "zalo_message_id"} {
		if found, ok := data[key]; ok {
			return found, true
		}
	}
	return nil, false
}
