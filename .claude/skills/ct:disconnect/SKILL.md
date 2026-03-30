---
name: ct:disconnect
description: Disconnect from the claude-together team.
argument-hint: "[url]"
---

# Disconnect from Team

Disconnect from claude-together server(s) and sync rules back to profile.

## Steps

1. **Parse arguments**:
   - If `$ARGUMENTS` has a URL, disconnect from that specific server.
   - If `$ARGUMENTS` is empty, disconnect from all servers.

2. **Disconnect**: Call `mcp__ct-channel__disconnect` with `session_id: ${CLAUDE_SESSION_ID}` and optionally `url`.
   - The client will sync current session rules back to the connection profile before disconnecting.

3. **Confirm**: Tell the user which server(s) they have been disconnected from.
