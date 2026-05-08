# Za-go Session Export Risk

Za-go currently exposes `(*ZaloAPI).SetSession(sessionCookies any) bool`, but no clear public `ZaloAPI` session export method was found in the installed module version.

The module has an internal auth `GetSession()` helper, but it is not reachable from connector code because it lives behind Za-go internals. This means the connector can accept restored cookies at startup, but cannot safely persist a newly refreshed session through a public API yet.

Plan:

1. Treat Za-go session persistence as a known integration risk for the MVP.
2. Keep session input plumbing typed as `any` so the connector can pass operator-provided exported cookies into `SetSession`.
3. Before production operation, either confirm an upstream public export method, request one upstream, or maintain a small fork that exposes a stable session-export API.
4. Do not rely on reflection or internal-package access for session export; that would be fragile across Za-go updates.
