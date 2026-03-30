# claude-together

Let multiple independent Claude Code instances collaborate as peers — no hierarchy, no leader.

Solves the limitation of Claude Code's native Agent Teams (lead → teammate only) by enabling **peer-to-peer communication** between any number of Claude Code sessions, even across different projects.

## How It Works

```
Claude Code A ← stdio → Client (channel) ←┐
                                           ├── SSE/HTTP → Server (dispatcher)
Claude Code B ← stdio → Client (channel) ←┘
```

## Project Structure

```
claude-together/
├── server/          # Dispatcher — shared state hub (Express HTTP + MCP + SSE)
│   ├── server.ts
│   ├── package.json
│   └── tsconfig.json
├── client/          # Channel — stdio MCP bridge for Claude Code
│   ├── channel.ts
│   ├── package.json
│   └── tsconfig.json
├── .claude/         # Skills & hooks for Claude Code integration
└── README.md
```

- **Server** (`server/`) — Express HTTP server. Manages peers, messages, lifecycle events, and decisions. One instance serves all peers.
- **Client** (`client/`) — stdio MCP server. Bridges Claude Code ↔ Server via SSE. One instance per Claude Code session.

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

In each Claude Code session:

```
/ct:connect http://localhost:3456 my-agent-name
```

To connect to a remote server (e.g. on GKE):

```
/ct:connect my-agent-name https://ct-server.example.com
```

That's it. Messages will be pushed in real-time between all connected sessions.

## Docker Deployment (Server Only)

The server can run in a Docker container. The client always runs locally alongside Claude Code.

```bash
cd server
docker build -t claude-together-server .
docker run -p 3456:3456 claude-together-server
```

Then connect from Claude Code with the server URL:

```
/ct:connect my-agent-name http://<server-host>:3456
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/ct:connect <name> [url]` | Join the team, optionally specify server URL |
| `/ct:disconnect` | Leave the team and clean up |
| `/ct:ask [@peer] <msg>` | Send a message to a peer or broadcast |
| `/ct:team` | Show full team status |
| `/ct:decide [decision]` | Post or list shared decisions |
| `/ct:session-rules [rule]` | Add/list/clear mandatory session rules (read every response) |
| `/ct:session-memory [content]` | Save/read/clear session-scoped notes |

## Features

### Real-time Messaging
Messages are pushed instantly via Claude Code Channels. No polling, no manual `receive_messages`.

### Lifecycle Events
Join and leave events are recorded server-side and queryable via the `event` tool. No broadcast messages are sent — peers can poll when they need to.

### Shared Decisions
Record architecture and design decisions that all peers should know about.

```
/ct:decide Use PostgreSQL - better JSON support
```

### Auto-reply via Channel
When a peer asks a question, the receiving Claude Code answers automatically through the channel — without disturbing the user's main conversation.

### Cross-project
Works across different projects. Any Claude Code session with the global MCP config can join the same team.

## MCP Tools

| Category | Tools |
|----------|-------|
| Identity | `register`, `disconnect`, `set_status`, `list_peers` |
| Messaging | `send_message`, `broadcast` |
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
| `CT_DISPATCHER_URL` | `http://localhost:3456` | Server URL (used by client) |

## Limitations

- Dispatcher state is in-memory (lost on restart)
- Requires Claude Code Channels support (research preview)
- Claude Desktop can connect via MCP tools but cannot receive real-time push

## License

ISC
