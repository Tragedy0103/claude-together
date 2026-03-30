# claude-together

Let multiple independent Claude Code instances collaborate as peers — no hierarchy, no leader.

Solves the limitation of Claude Code's native Agent Teams (lead → teammate only) by enabling **peer-to-peer communication** between any number of Claude Code sessions, even across different projects.

## How It Works

```
Claude Code A ← stdio → Client (channel) ←┐
                                           ├── SSE/HTTP → Server (dispatcher)
Claude Code B ← stdio → Client (channel) ←┘
```

Each client can connect to **multiple servers** simultaneously.

## Project Structure

```
claude-together/
├── server/          # Dispatcher — shared state hub (Express HTTP + MCP + SSE)
│   ├── server.ts
│   ├── Makefile     # Docker/GKE deployment
│   ├── package.json
│   └── tsconfig.json
├── client/          # Channel — stdio MCP bridge for Claude Code
│   ├── channel.ts
│   ├── package.json
│   └── tsconfig.json
├── .claude/         # Skills & hooks for Claude Code integration
└── README.md
```

- **Server** (`server/`) — Express HTTP server. Manages peers (with roles), messages, lifecycle events, and decisions. One instance serves all peers.
- **Client** (`client/`) — stdio MCP server. Bridges Claude Code ↔ Server via SSE. Supports multi-connection, connection profiles, and session state management. One instance per Claude Code session.

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/xdite/claude-together.git
cd claude-together
```

Open Claude Code in the repo and run:

```
/ct:install
```

This will install client dependencies, copy skills/hooks to `~/.claude/`, configure MCP server and settings — all automatically with confirmation prompts.

> Server is deployed separately (Docker/GKE). See [Docker Deployment](#docker-deployment-server-only) below.

### 2. Connect

```
/ct:connect http://localhost:3456 my-agent-name
```

With auth and role:

```
/ct:connect https://server.example.com/path agent-name x-api-key:abc123 infra-expert
```

Re-connect without arguments (uses saved profile):

```
/ct:connect
```

That's it. Messages will be pushed in real-time between all connected sessions.

## Docker Deployment (Server Only)

The server can run in a Docker container. The client always runs locally alongside Claude Code.

```bash
cd server
docker build -t claude-together-server .
docker run -p 3456:3456 claude-together-server
```

For GKE deployment:

```bash
cd server
make deploy   # Build, push to Artifact Registry, kubectl rollout restart
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/ct:install` | First-time setup — install client, configure global settings |
| `/ct:connect <url> <name> [auth] [role]` | Connect to a server (supports multi-connection) |
| `/ct:disconnect` | Disconnect and sync rules to profile |
| `/ct:ask [@peer] <msg>` | Send a message to a peer or broadcast |
| `/ct:team` | Show full team status (peers, roles, decisions) |
| `/ct:decide [decision]` | Post or list shared decisions |
| `/ct:session-rules [rule]` | Add/list/clear mandatory session rules |
| `/ct:session-memory [content]` | Save/read/clear session-scoped notes |
| `/ct:customer-service` | Preset: read-only mode with strict rules |

## Features

### Multi-Server Connections
Connect to multiple servers simultaneously. Each connection has its own name, auth, and role.

### Connection Profiles
Connection details are saved to `~/.claude/ct-connections.json`. Next time you run `/ct:connect` without arguments, saved profiles are presented for selection.

### Peer Roles
Each peer can declare a role (e.g. "客服", "infra expert") visible in `/ct:team`. Roles are stored in profiles and server-side.

### Persistent Rules
Session rules added during a session are synced back to the connection profile on disconnect. Next time you connect with the same profile, rules are automatically restored.

### Real-time Messaging
Messages are pushed instantly via Claude Code Channels. No polling, no manual `receive_messages`.

### Flexible Auth
Auth supports any header format: `x-api-key:value`, `Authorization:Bearer token`, or bare value (defaults to `x-api-key`). No auth needed for local servers.

### Lifecycle Events
Join and leave events are recorded server-side and queryable via the `event` tool.

### Shared Decisions
Record architecture and design decisions that all peers should know about.

### Auto-reply via Channel
When a peer asks a question, the receiving Claude Code answers automatically through the channel — without disturbing the user's main conversation.

### Cross-project
Works across different projects. Any Claude Code session with the global MCP config can join the same team.

## MCP Tools

| Category | Tools |
|----------|-------|
| Identity | `register`, `disconnect`, `set_status`, `list_peers` |
| Messaging | `send_message`, `broadcast`, `reply` |
| Connections | `list_connections` (saved profiles + active connections) |
| Events | `event` (query join/leave lifecycle events) |
| Decisions | `post_decision`, `list_decisions` |
| Overview | `team_status` |

## Development

```bash
# Server
cd server
npm run dev       # Start dispatcher in dev mode
npm run build     # Compile TypeScript
npm run start     # Run compiled version

# Client
cd client
npm run dev       # Start channel in dev mode
npm run build     # Compile TypeScript
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Server listen port |
| `BASE_PATH` | `""` | Server route prefix |

Auth is configured per-connection via the `auth` parameter, not via env vars.

## Limitations

- Dispatcher state is in-memory (lost on restart)
- Requires Claude Code Channels support (research preview)
- Claude Desktop can connect via MCP tools but cannot receive real-time push

## License

ISC
