---
name: session-memory
description: Save or read session-scoped notes that persist within this session only.
argument-hint: "<save|read|clear> [content]"
---

# Session Memory

Manage session-scoped notes stored at `/tmp/claude-session-${CLAUDE_SESSION_ID}.md`. These notes survive context compression but are discarded when the session ends.

## Usage

Parse `$ARGUMENTS` to determine the action:

### save / add / write
Append content to the session memory file.
- Example: `/session-memory save The auth API uses JWT with RS256`
- Append the content with a timestamp header to `/tmp/claude-session-${CLAUDE_SESSION_ID}.md`
- Format each entry as:
  ```
  ## [HH:MM] <content>
  ```
- Confirm what was saved.

### read / show / list
Read and display the current session memory.
- Example: `/session-memory read`
- Read `/tmp/claude-session-${CLAUDE_SESSION_ID}.md` and display its contents.
- If the file doesn't exist or is empty, say "No session memory yet."

### clear
Clear all session memory.
- Example: `/session-memory clear`
- Remove `/tmp/claude-session-${CLAUDE_SESSION_ID}.md`
- Confirm it was cleared.

### No arguments or just content
If no action keyword is recognized, treat the entire argument as content to save.
- Example: `/session-memory database schema uses UUID primary keys`
- Same behavior as `save`.
