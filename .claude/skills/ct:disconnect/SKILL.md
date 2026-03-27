---
name: ct:disconnect
description: Disconnect from the claude-together team.
---

# Disconnect from Team

Leave the claude-together team and clean up local state.

## Steps

1. **Check connection**: Run `cat /tmp/ct-peer-${CLAUDE_SESSION_ID} 2>/dev/null` to get the current peer name.
   - If no file exists, tell the user they are not connected and stop.

2. **Disconnect**: Call `mcp__ct-channel__disconnect` to leave the team (records a leave event and removes from peer list)

3. **Clean up temp files**: Run `rm -f /tmp/ct-peer-${CLAUDE_SESSION_ID} /tmp/ct-url-${CLAUDE_SESSION_ID} /tmp/ct-apikey-${CLAUDE_SESSION_ID}`

4. **Confirm**: Tell the user they have been disconnected.
