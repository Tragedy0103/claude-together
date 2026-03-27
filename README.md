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

- **Server** (`server/`) — Express HTTP server. Manages peers, messages, tasks, file locks, and decisions. One instance serves all peers.
- **Client** (`client/`) — stdio MCP server. Bridges Claude Code ↔ Server via SSE. One instance per Claude Code session.

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/xdite/claude-together.git
cd claude-together
npm run install:all
```

### 2. Start the Server

```bash
cd server
npm run dev
```

This starts the dispatcher on `http://localhost:3456`.

### 3. Configure Claude Code

Add MCP servers to your **global** `~/.claude.json`:

```json
{
  "mcpServers": {
    "claude-together": {
      "type": "http",
      "url": "http://localhost:3456/mcp"
    },
    "ct-channel": {
      "command": "npx",
      "args": ["tsx", "/path/to/claude-together/client/channel.ts"]
    }
  }
}
```

> Replace `/path/to/claude-together` with the actual path.

Copy the skills and hooks to your global Claude Code config:

```bash
cp -r .claude/skills/ct:* ~/.claude/skills/
cp .claude/hooks/ct-cleanup.sh ~/.claude/hooks/
```

Add the cleanup hook to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "sh ~/.claude/hooks/ct-cleanup.sh"
          }
        ]
      }
    ]
  }
}
```

### 4. Launch Claude Code

```bash
claude --dangerously-load-development-channels server:ct-channel
```

### 5. Connect

In each Claude Code session:

```
/ct:connect my-agent-name
```

That's it. Messages will be pushed in real-time between all connected sessions.

## Docker Deployment (Server Only)

The server can run in a Docker container. The client always runs locally alongside Claude Code.

```bash
cd server
docker build -t claude-together-server .
docker run -p 3456:3456 claude-together-server
```

Then point the client to the server:

```bash
# Set the env var in your Claude Code MCP config
CT_DISPATCHER_URL=http://<server-host>:3456
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/ct:connect <name>` | Join the team (or reconnect without name) |
| `/ct:ask [@peer] <msg>` | Send a message to a peer or broadcast |
| `/ct:team` | Show full team status |
| `/ct:task <action>` | Manage shared tasks (create/list/claim/done) |
| `/ct:decide [decision]` | Post or list shared decisions |

## Features

### Real-time Messaging
Messages are pushed instantly via Claude Code Channels. No polling, no manual `receive_messages`.

### Shared Task List
Create, claim, and update tasks. All peers see the same task board.

```
/ct:task create Implement auth API
/ct:task claim task-1
/ct:task done task-1
```

### File Locking
Prevent conflicts when multiple agents work on the same codebase.

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
| Identity | `register`, `set_status`, `list_peers` |
| Messaging | `send_message`, `broadcast` |
| Tasks | `create_task`, `list_tasks`, `claim_task`, `update_task` |
| File Locks | `lock_file`, `unlock_file`, `check_file`, `list_locks` |
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
- Requires `--dangerously-load-development-channels` flag (Channels is in research preview)
- Claude Desktop can connect via MCP tools but cannot receive real-time push

## License

ISC
