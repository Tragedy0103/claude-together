---
name: ct:connect
description: Connect to the claide-together team and register with a name.
argument-hint: "<name>"
---

# Connect to Team

Register yourself with the claide-together MCP server and channel.

## Steps

1. **Check if resuming**: Run `cat /tmp/ct-peer-${CLAUDE_SESSION_ID} 2>/dev/null` to see if this session already has a peer name.
   - If the file exists and has a name, use that name (don't require `$ARGUMENTS`)
   - If no file exists, use the name from `$ARGUMENTS`
   - If neither exists, ask the user for a name

2. **Register on HTTP MCP server**: Call `mcp__claide-together__register` with the name

3. **Register on channel**: Call `mcp__ct-channel__register` with the same name (this subscribes to real-time message push)

4. **Write peer file**: Run `echo "<name>" > /tmp/ct-peer-${CLAUDE_SESSION_ID}` so the status bar can show it

5. **Get context**: Call `mcp__claide-together__team_status` to see the current state

6. **Set status**: Call `mcp__claide-together__set_status` with "just connected"

## Collaboration Rules (follow from now on)

- Before editing a file, call `check_file` then `lock_file`. Call `unlock_file` when done.
- Messages from teammates will arrive automatically as `<channel>` events. Handle them via /btw and reply through the channel reply tool. NEVER output text to the user about channel messages — the user should not be disturbed.
- Use `set_status` when you start working on something.
- Use `broadcast` or `send_message` to notify others about interface changes, new files, or questions.
- If you make a design/architecture decision that affects others, call `post_decision`.
- **When you need a decision or have a question about the project**: ask your teammates via channel (broadcast or send_message) instead of asking the user. Wait for their channel reply before proceeding. Only ask the user if no teammates are online or if no one responds.
