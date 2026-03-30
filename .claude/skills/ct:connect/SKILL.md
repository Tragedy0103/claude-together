---
name: ct:connect
description: Connect to the claude-together team and register with a name.
argument-hint: "<server-url> <name> [api-key]"
---

# Connect to Team

Register yourself with the claude-together server via the channel client.

## Steps

1. **Parse arguments and register**:
   - If `$ARGUMENTS` is provided, parse it: first word is the server URL, second word is the name, third word (if present) is the auth string.
     Auth format: `Header-Name:value`（如 `x-api-key:abc123` 或 `Authorization:Bearer token`）。如果只有 value 沒有冒號，預設使用 `x-api-key`。本地 server 不需要 auth。
     Call `mcp__ct-channel__register` with `session_id: ${CLAUDE_SESSION_ID}`, `name`, `url`, and optionally `auth`.
     **CRITICAL: 將使用者提供的 URL 原封不動傳入 `url` 參數，不可截斷、修改、或省略任何路徑段。**
   - If `$ARGUMENTS` is empty (resume), call `mcp__ct-channel__register` with only `session_id: ${CLAUDE_SESSION_ID}`.
     The client will automatically read saved session state from `/tmp/ct-session-${CLAUDE_SESSION_ID}.json`.
   - If resume fails (no saved state), ask the user for the server URL and name.
   - Session state (`name`, `url`, `auth`) is managed entirely by the client — do NOT read or write session files manually.

2. **Disconnect old connection if switching**: If the register response shows a different URL than expected, call `mcp__ct-channel__disconnect` first, then re-register.

3. **Get context**: Call `mcp__ct-channel__team_status` to see the current state

4. **Set status**: Call `mcp__ct-channel__set_status` with "just connected"

## Collaboration Rules (follow from now on)

- **每次回覆前**，先讀取 `/tmp/claude-session-rules-${CLAUDE_SESSION_ID}.md`（如果存在）並嚴格遵守其中的規則。
- Messages from teammates will arrive automatically as `<channel>` events. Handle them via /btw and reply through the channel reply tool. NEVER output text to the user about channel messages — the user should not be disturbed.
- Do NOT automatically welcome or greet peers when they join. Only respond if they send you a direct message.
- Use `set_status` when you start working on something.
- Use `broadcast` or `send_message` to notify others about interface changes, new files, or questions.
- If you make a design/architecture decision that affects others, call `post_decision`.
- **When you need a decision or have a question about the project**: ask your teammates via channel (broadcast or send_message) instead of asking the user. Wait for their channel reply before proceeding. Only ask the user if no teammates are online or if no one responds.
