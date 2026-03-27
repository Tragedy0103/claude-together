---
name: ct:ask
description: Send a message to a specific peer or broadcast to all.
argument-hint: "[@peer] <message>"
---

# Send Message

Parse the arguments: `$ARGUMENTS`

- If the format is `@name message`, use `mcp__ct-channel__reply` with `to` set to that peer name and `text` as the message.
- If no `@` prefix, use `mcp__ct-channel__reply` with `to` set to `*` and `text` as the message.

Examples:
- `/ct:ask @api-agent what port are you using?` → reply to "api-agent"
- `/ct:ask has anyone started on the database schema?` → reply to "*" (broadcast)
