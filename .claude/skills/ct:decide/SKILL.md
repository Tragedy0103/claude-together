---
name: ct:decide
description: Post or list shared design/architecture decisions.
argument-hint: "[title - rationale]"
---

# Shared Decisions

Parse the arguments: `$ARGUMENTS`

- If arguments are empty or "list", call `list_decisions`
- Otherwise, parse as a decision:
  - Use the first sentence as the title
  - Use the rest as the content/rationale
  - Call `post_decision` with title and content

Example: `/decide Use PostgreSQL for the database - better JSON support and we already have experience with it`
