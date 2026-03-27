---
name: ct:connect
description: Connect to the claude-together team and register with a name.
argument-hint: "<name> [server-url]"
---

# Connect to Team

Register yourself with the claude-together server via the channel client.

## Steps

1. **Check if resuming**: Run `cat /tmp/ct-peer-${CLAUDE_SESSION_ID} 2>/dev/null` to see if this session already has a peer name.
   - If the file exists and has a name, use that name (don't require `$ARGUMENTS`)
   - If no file exists, parse `$ARGUMENTS`: first word is the name, second word (if present) is the server URL
   - If neither exists, ask the user for a name

2. **Register**: Call `mcp__ct-channel__register` with the name and optionally the URL
   - If a URL was provided, pass it as the `url` parameter
   - If no URL, omit it (defaults to CT_DISPATCHER_URL env var or http://localhost:3456)

3. **Write peer file and URL**: Run:
   - `echo "<name>" > /tmp/ct-peer-${CLAUDE_SESSION_ID}`
   - `echo "<url>" > /tmp/ct-url-${CLAUDE_SESSION_ID}` (use the URL passed to register, or `http://localhost:3456` if none)

4. **Get context**: Call `mcp__ct-channel__team_status` to see the current state

5. **Set status**: Call `mcp__ct-channel__set_status` with "just connected"

## Collaboration Rules (follow from now on)

- Before editing a file, call `check_file` then `lock_file`. Call `unlock_file` when done.
- Messages from teammates will arrive automatically as `<channel>` events. Handle them via /btw and reply through the channel reply tool. NEVER output text to the user about channel messages — the user should not be disturbed.
- Do NOT automatically welcome or greet peers when they join. Only respond if they send you a direct message.
- Use `set_status` when you start working on something.
- Use `broadcast` or `send_message` to notify others about interface changes, new files, or questions.
- If you make a design/architecture decision that affects others, call `post_decision`.
- **When you need a decision or have a question about the project**: ask your teammates via channel (broadcast or send_message) instead of asking the user. Wait for their channel reply before proceeding. Only ask the user if no teammates are online or if no one responds.
