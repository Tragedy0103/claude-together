---
name: session-rules
description: Add, list, or clear session-scoped rules that MUST be followed for this session only.
argument-hint: "<add|list|clear> [rule content]"
---

# Session Rules

Manage session-scoped rules stored at `/tmp/claude-session-rules-${CLAUDE_SESSION_ID}.md`. These rules are **mandatory** — they MUST be read before every response. They are discarded when the session ends.

## Usage

Parse `$ARGUMENTS` to determine the action:

### add / new (or no action keyword)
Append a rule to the session rules file.
- Example: `/session-rules add 所有 API 回傳格式統一用 camelCase`
- Example: `/session-rules 不要動 auth 模組的程式碼`
- Append the rule with a number prefix to `/tmp/claude-session-rules-${CLAUDE_SESSION_ID}.md`
- Format:
  ```
  1. <rule content>
  ```
- Confirm what was added.

### list / show
Display all current session rules.
- Example: `/session-rules list`
- Read and display the file contents.
- If empty or not exists, say "No session rules set."

### clear
Clear all session rules.
- Example: `/session-rules clear`
- Remove the file.
- Confirm it was cleared.

### remove / delete
Remove a specific rule by number.
- Example: `/session-rules remove 2`
- Remove that line and re-number remaining rules.
