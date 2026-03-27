---
name: ct:task
description: Create, list, claim, or update team tasks.
argument-hint: "<create|list|claim|done|block> [details]"
---

# Team Task Management

Parse the arguments: `$ARGUMENTS`

Determine the action:

- **create** / **new** → Call `mcp__ct-channel__create_task` with title and description
  - Example: `/task create 實作登入 API - 需要 JWT token 驗證`
- **list** / **ls** → Call `mcp__ct-channel__list_tasks`
  - Example: `/task list` or `/task list open`
- **claim** / **take** → Call `mcp__ct-channel__claim_task` with the task ID
  - Example: `/task claim task-1`
- **done** / **complete** → Call `mcp__ct-channel__update_task` with status "done"
  - Example: `/task done task-1`
- **block** / **blocked** → Call `mcp__ct-channel__update_task` with status "blocked"
  - Example: `/task block task-3`

After any action, briefly show the updated task list.
