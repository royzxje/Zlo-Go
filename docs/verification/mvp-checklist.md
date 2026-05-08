# MVP Verification Checklist

- [ ] Owner can login to the system.
- [ ] Owner can connect Zalo via QR.
- [ ] Connector reaches `listening` state.
- [ ] USER messages arrive realtime in UI.
- [ ] GROUP messages arrive realtime in UI.
- [ ] Agent can claim a conversation.
- [ ] Agent can send text.
- [ ] Agent can send image/file.
- [ ] Outbound messages transition through queued/sending/sent or failed.
- [ ] Delivered/seen updates appear if Za-go emits them.
- [ ] Typing appears realtime when supported.
- [ ] Media is archived into MinIO.
- [ ] Restarting `api` does not lose unprocessed Redis events.
- [ ] Restarting `zalo-connector` restores session and reconnects when the session is still valid.
- [ ] Session expiry shows a clear QR-required state.
- [ ] Agent cannot send in a thread assigned to another agent.
- [ ] Owner and Manager can view all threads.
