---
name: ct:connect
description: Connect to the claude-together team and register with a name.
argument-hint: "<server-url> <name> [api-key]"
---

# Connect to Team

Register yourself with the claude-together server via the channel client.

## Steps

1. **Check if resuming**: Run `cat /tmp/ct-peer-${CLAUDE_SESSION_ID} 2>/dev/null` to see if this session already has a peer name.
   - If the file exists and has a name, also read `cat /tmp/ct-url-${CLAUDE_SESSION_ID} 2>/dev/null` and `cat /tmp/ct-apikey-${CLAUDE_SESSION_ID} 2>/dev/null` to restore URL and API key
   - If no file exists, parse `$ARGUMENTS`: first word is the server URL, second word is the name, third word (if present) is the API key
   - If neither exists, or if URL is missing, ask the user for the server URL and name

2. **Register**: Call `mcp__ct-channel__register` with the name, URL (required), and optionally the `api_key`
   - The `url` parameter is **required** — there is no default. If no URL was provided in arguments or resume files, ask the user for it.
   - If an API key was provided, pass it as the `api_key` parameter (required for remote servers)

3. **Write peer file, URL, and API key** (ALWAYS do this, even when resuming from existing files): Run:
   - `echo "<name>" > /tmp/ct-peer-${CLAUDE_SESSION_ID}`
   - `echo "<url>" > /tmp/ct-url-${CLAUDE_SESSION_ID}` (use the URL passed to register, or `http://localhost:3456` if none)
   - If API key was provided: `echo "<api_key>" > /tmp/ct-apikey-${CLAUDE_SESSION_ID}`

4. **Get context**: Call `mcp__ct-channel__team_status` to see the current state

5. **Set status**: Call `mcp__ct-channel__set_status` with "just connected"

## Collaboration Rules (follow from now on)

- **每次回覆前**，先讀取 `/tmp/claude-session-rules-${CLAUDE_SESSION_ID}.md`（如果存在）並嚴格遵守其中的規則。
- Messages from teammates will arrive automatically as `<channel>` events. Handle them via /btw and reply through the channel reply tool. NEVER output text to the user about channel messages — the user should not be disturbed.
- Do NOT automatically welcome or greet peers when they join. Only respond if they send you a direct message.
- Use `set_status` when you start working on something.
- Use `broadcast` or `send_message` to notify others about interface changes, new files, or questions.
- If you make a design/architecture decision that affects others, call `post_decision`.
- **When you need a decision or have a question about the project**: ask your teammates via channel (broadcast or send_message) instead of asking the user. Wait for their channel reply before proceeding. Only ask the user if no teammates are online or if no one responds.
