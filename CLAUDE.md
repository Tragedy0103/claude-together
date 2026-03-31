# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Install client only (most users)
npm run install:client

# Install all dependencies (server + client)
npm run install:all

# Development (uses tsx, no build step)
npm run dev:server    # Start server on :3456
npm run dev:client    # Start channel client (stdio MCP)

# Build both components (TypeScript → dist/)
npm run build

# Production
cd server && npm start   # Runs compiled dist/server.js
cd client && npm start   # Runs compiled dist/channel.js

# Docker / GKE deployment (server only, run from server/)
cd server
make build    # Build & push to GKE Artifact Registry (linux/amd64)
make deploy   # Build, push, and kubectl rollout restart
```

No test framework is configured.

## Architecture

Peer-to-peer collaboration system for Claude Code instances. Two components:

**Server** (`server/server.ts`) — Express HTTP app + MCP server. Single process holding all shared state in memory (peers, messages, decisions, lifecycle events). Peers have `name`, `status`, and optional `role` fields. Exposes:
- `/mcp` — Streamable HTTP MCP transport (register, disconnect, messaging, decisions, events)
- `/channel/subscribe/:peerName` — SSE endpoint for real-time message push
- `/channel/send` — HTTP POST for channel clients to inject messages
- `/api/call` — REST proxy that executes MCP tools without MCP protocol overhead
- `/health` — Health check (includes peer roles)

All routes are prefixed by `BASE_PATH` env var if set.

**Client** (`client/channel.ts`) — stdio MCP server bridging Claude Code ↔ Server. Supports **multiple simultaneous connections** via `Map<url, Connection>`. Key behaviors:
- `register` — supports `session_id` for session state, `role` for peer description, `auth` for flexible auth headers. Same URL updates existing connection, different URL opens new one. Resumes from session file or shows saved profiles when no args given.
- `disconnect` — syncs session rules back to profile before disconnecting
- `reply` — sends via `/channel/send` (not `/api/call`)
- `list_connections` — shows active connections and saved profiles
- `block_peer` / `unblock_peer` — client-side blocklist per connection. Blocked peers' messages are auto-rejected with a reply, never forwarded to Claude
- Multi-server tools (reply, set_status, broadcast, post_decision) require `url` param when multiple servers connected
- All other tools → `POST /api/call`

**Connection Profiles** (`~/.claude/ct-connections.json`) — persistent across sessions. Stores url, name, auth, role, and rules for each server. Auto-saved on register, rules synced back on disconnect.

**Session State** (`/tmp/ct-session-{session_id}.json`) — per-session active connections, managed by client.

**Message flow**: Claude Code ← stdio → Client ← SSE/HTTP → Server → SSE → other Clients → other Claude Code sessions.

**State is ephemeral** — server data lives in memory (lost on restart). Client profiles are persistent.

## Environment Variables

| Variable | Default | Used by |
|----------|---------|---------|
| `PORT` | `3456` | Server |
| `BASE_PATH` | `""` | Server — prefix for all routes |

Auth is configured per-connection via the `auth` parameter (format: `Header-Name:value`), not via env vars.

## Skills (`.claude/skills/`)

| Skill | Description |
|-------|-------------|
| `ct:install` | First-time setup — installs client, copies skills/hooks, configures global settings |
| `ct:connect` | Connect to server(s). Supports multi-connection, resume, saved profiles |
| `ct:disconnect` | Disconnect and sync rules back to profile |
| `ct:ask` | Send message to peer or broadcast |
| `ct:decide` | Post or list shared decisions |
| `ct:team` | Show team status (peers, roles, decisions) |
| `ct:session-rules` | Mandatory per-session rules (read every response) |
| `ct:session-memory` | Optional per-session notes |
| `ct:block` | Block/unblock peers or list blocked peers |
| `ct:rules-init-cs` | Preset: read-only customer service mode with strict rules |
| `ct:rules-init-pm` | Preset: PM mode for architecture guidance and team coordination |
| `ct:rules-init-rd` | Preset: RD mode for collaborative development workflow |

首次安裝請在 Claude Code 中執行 `/ct:install`，會自動完成 MCP 設定、skills 複製、hooks 註冊等全域配置。

## Deployment

Server deploys to GKE (`asia-east1-docker.pkg.dev/xlab-435802/xlab-registry/claude-together`). Makefile is in `server/`. Client always runs locally alongside Claude Code.
