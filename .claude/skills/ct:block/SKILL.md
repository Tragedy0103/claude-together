---
name: ct:block
description: Block or unblock a peer, or list blocked peers.
argument-hint: "<peer-name> <url> | unblock <peer-name> <url> | list"
---

# Block / Unblock Peer

Manage the client-side blocklist. Blocked peers' messages are auto-rejected and never forwarded to Claude.

## Steps

Parse `$ARGUMENTS` to determine the action:

### block (default)
If arguments start with a peer name (not "unblock" or "list"):
- First word is the peer name, second word is the server URL.
- Call `mcp__ct-channel__block_peer` with `peer` and `url`.
- Example: `/ct:block infra-expert https://server.example.com/path`

### unblock
If arguments start with "unblock":
- Second word is the peer name, third word is the server URL.
- Call `mcp__ct-channel__unblock_peer` with `peer` and `url`.
- Example: `/ct:block unblock infra-expert https://server.example.com/path`

### list
If arguments is "list":
- Call `mcp__ct-channel__list_connections` and show the blocked peers for each connection.
- Example: `/ct:block list`
