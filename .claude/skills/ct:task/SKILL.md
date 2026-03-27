---
name: ct:task
description: Create, list, claim, or update team tasks.
argument-hint: "<create|list|claim|done|block> [details]"
---

# Team Task Management

Parse the arguments: `$ARGUMENTS`

Determine the action:

- **create** / **new** → Call `create_task` with title and description
  - Example: `/task create 實作登入 API - 需要 JWT token 驗證`
- **list** / **ls** → Call `list_tasks`
  - Example: `/task list` or `/task list open`
- **claim** / **take** → Call `claim_task` with the task ID
  - Example: `/task claim task-1`
- **done** / **complete** → Call `update_task` with status "done"
  - Example: `/task done task-1`
- **block** / **blocked** → Call `update_task` with status "blocked"
  - Example: `/task block task-3`

After any action, briefly show the updated task list.
