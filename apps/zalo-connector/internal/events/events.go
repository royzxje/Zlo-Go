package events

type SendSucceededEvent struct {
	Type          string `json:"type"`
	CommandID     string `json:"command_id"`
	MessageID     string `json:"message_id"`
	ZaloMessageID string `json:"zalo_message_id"`
}

func NewSendSucceeded(commandID string, messageID string, zaloMessageID string) SendSucceededEvent {
	return SendSucceededEvent{
		Type:          "message.send_succeeded",
		CommandID:     commandID,
		MessageID:     messageID,
		ZaloMessageID: zaloMessageID,
	}
}
