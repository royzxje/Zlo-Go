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
	api *zago.ZaloAPI
}

func NewZagoClient(config Config) (*ZagoClient, error) {
	if strings.TrimSpace(config.IMEI) == "" {
		return nil, errors.New("imei is required")
	}

	api, err := zago.Zalo(config.Phone, config.Password, config.IMEI, config.SessionCookies, config.UserAgent, config.AutoLogin, 0)
	if err != nil {
		return nil, err
	}

	return &ZagoClient{api: api}, nil
}

func (c *ZagoClient) SendText(ctx context.Context, threadID string, threadType string, text string) (string, error) {
	if c == nil || c.api == nil {
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

	response, err := c.api.SendMessage(zago.Message{Text: text}, threadID, typeValue)
	if err != nil {
		return "", err
	}

	return messageID(response), nil
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

func messageID(response any) string {
	if response == nil {
		return ""
	}
	if value, ok := lookupMessageID(response); ok {
		return strings.TrimSpace(fmt.Sprint(value))
	}
	return strings.TrimSpace(fmt.Sprint(response))
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

	for _, key := range []string{"msgId", "msgID", "messageId", "messageID", "id"} {
		if found, ok := data[key]; ok {
			return found, true
		}
	}
	return nil, false
}
