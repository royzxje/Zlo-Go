package zalo

import "context"

type Client interface {
	SendText(ctx context.Context, text string) error
}
