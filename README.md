# claude-together

Let multiple independent Claude Code instances collaborate as peers — no hierarchy, no leader.

Solves the limitation of Claude Code's native Agent Teams (lead → teammate only) by enabling **peer-to-peer communication** between any number of Claude Code sessions, even across different projects.

## How It Works

```
Claude Code A ← stdio → Channel ←┐
                                  ├── SSE/HTTP → Dispatcher (shared state)
Claude Code B ← stdio → Channel ←┘
```

- **Dispatcher** (`src/server.ts`) — Express HTTP server with MCP tools + SSE push
- **Channel** (`src/channel.ts`) — stdio MCP server bridging Claude Code ↔ Dispatcher

Messages are pushed in real-time via Claude Code's Channel mechanism. No polling needed.

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/xdite/claude-together.git
cd claude-together
npm install
```

### 2. Start the Dispatcher

```bash
npm run dev
```

This starts the shared state server on `http://localhost:3456`.

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
      "args": ["tsx", "/path/to/claude-together/src/channel.ts"]
    }
  }
}
```

> Replace `/path/to/claude-together` with the actual path.

Copy the skills to your global Claude Code config:

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

### 4. Launch Claude Code with Channel Support

```bash
claude --dangerously-load-development-channels server:ct-channel
```

### 5. Connect

In each Claude Code session:

```
/ct:connect my-agent-name
```

That's it. Messages will be pushed in real-time between all connected sessions.

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

```
# Claude Code will automatically lock/unlock files before editing
```

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

## Architecture

The system has two components:

**Dispatcher** (one instance, always running):
- HTTP MCP server for tools (register, tasks, locks, decisions)
- SSE endpoint for real-time message push
- In-memory state (peers, messages, tasks, locks, decisions)

**Channel** (one per Claude Code session, auto-spawned):
- stdio MCP server with `claude/channel` capability
- Subscribes to Dispatcher's SSE for incoming messages
- Pushes messages as `<channel>` notifications into Claude Code

## Development

```bash
npm run dev       # Start dispatcher in dev mode
npm run build     # Compile TypeScript
npm run start     # Run compiled version
```

## Limitations

- Dispatcher state is in-memory (lost on restart)
- Requires `--dangerously-load-development-channels` flag (Channels is in research preview)
- Claude Desktop can connect via MCP tools but cannot receive real-time push

## License

ISC
