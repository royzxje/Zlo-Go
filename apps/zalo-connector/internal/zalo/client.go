package zalo

import "context"

type Client interface {
	SendText(ctx context.Context, threadID string, threadType string, text string) (string, error)
}
