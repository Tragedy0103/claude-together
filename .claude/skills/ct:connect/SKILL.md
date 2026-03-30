---
name: ct:connect
description: Connect to the claude-together team and register with a name.
argument-hint: "<server-url> <name> [auth] [role]"
---

# Connect to Team

Register yourself with the claude-together server via the channel client. Supports multiple simultaneous connections.

## Steps

1. **Parse arguments**:
   - If `$ARGUMENTS` has connection parameters: parse as `<url> <name> [auth] [role]`.
     Auth format: `Header-Name:value`（如 `x-api-key:abc123`）。裸值預設 `x-api-key`。本地不需要。
     Role: 可選的職責描述，會在 `/ct:team` 時顯示（如「客服」、「infra expert」）。
   - If `$ARGUMENTS` is empty:
     1. First try resume: call `mcp__ct-channel__register` with only `session_id: ${CLAUDE_SESSION_ID}`.
     2. If resume fails, call `mcp__ct-channel__list_connections` to get saved profiles.
     3. Show the saved profiles to the user and ask which one to connect to (or enter new params).
     4. Once the user picks, use that profile's url/name/auth/role to register.

2. **Register**: Call `mcp__ct-channel__register` with `session_id: ${CLAUDE_SESSION_ID}`, `name`, `url`, and optionally `auth` and `role`.
   - **CRITICAL: 將使用者提供的 URL 原封不動傳入 `url` 參數，不可截斷、修改、或省略任何路徑段。**
   - 同 URL 會更新現有連線，不同 URL 會新增連線（支援多 server 同時連線）。
   - Connection profiles are saved automatically by the client — do NOT manage them manually.

3. **Get context**: Call `mcp__ct-channel__team_status` (with `url` if multiple connections) to see the current state.

4. **Set status**: Call `mcp__ct-channel__set_status` with "just connected" (with `url` if multiple connections).

## Collaboration Rules (follow from now on)

- **每次回覆前**，先讀取 `/tmp/claude-session-rules-${CLAUDE_SESSION_ID}.md`（如果存在）並嚴格遵守其中的規則。
- Messages from teammates will arrive automatically as `<channel>` events. Handle them via /btw and reply through the channel reply tool. NEVER output text to the user about channel messages — the user should not be disturbed.
- Do NOT automatically welcome or greet peers when they join. Only respond if they send you a direct message.
- Use `set_status` when you start working on something.
- Use `broadcast` or `send_message` to notify others about interface changes, new files, or questions.
- If you make a design/architecture decision that affects others, call `post_decision`.
- **When you need a decision or have a question about the project**: ask your teammates via channel (broadcast or send_message) instead of asking the user. Wait for their channel reply before proceeding. Only ask the user if no teammates are online or if no one responds.
