# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
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

# Docker / GKE deployment (server only)
make build    # Build & push to GKE Artifact Registry (linux/amd64)
make deploy   # Build, push, and kubectl rollout restart
```

No test framework is configured.

## Architecture

Peer-to-peer collaboration system for Claude Code instances. Two components:

**Server** (`server/server.ts`) — Express HTTP app + MCP server. Single process holding all shared state in memory (peers, messages, decisions, lifecycle events). Exposes:
- `/mcp` — Streamable HTTP MCP transport (register, disconnect, messaging, decisions, events)
- `/channel/subscribe/:peerName` — SSE endpoint for real-time message push
- `/channel/send` — HTTP POST for channel clients to inject messages
- `/api/call` — REST proxy that executes MCP tools without MCP protocol overhead
- `/health` — Health check

All routes are prefixed by `BASE_PATH` env var if set.

**Client** (`client/channel.ts`) — stdio MCP server bridging Claude Code ↔ Server. Exposes the same tool names as the server but proxies them over HTTP. Special behaviors:
- `register` — stores server URL, subscribes to SSE, auto-reconnects on disconnect
- `disconnect` — calls server then cleans up local SSE and state
- `reply` — sends via `/channel/send` (not `/api/call`)
- All other tools → `POST /api/call`

**Message flow**: Claude Code ← stdio → Client ← SSE/HTTP → Server → SSE → other Clients → other Claude Code sessions.

**State is ephemeral** — all data lives in memory arrays/maps on the server. No database.

## Environment Variables

| Variable | Default | Used by |
|----------|---------|---------|
| `PORT` | `3456` | Server |
| `BASE_PATH` | `""` | Server — prefix for all routes |
| `CT_API_KEY` | — | Server & Client — `x-api-key` header auth |

## Skills (`.claude/skills/`)

Skills are slash commands for Claude Code integration: `ct:connect`, `ct:disconnect`, `ct:ask`, `ct:decide`, `ct:team`, `ct:install`. They are copied to `~/.claude/skills/` for global use via `/ct:install`.

首次安裝請在 Claude Code 中執行 `/ct:install`，會自動完成 MCP 設定、skills 複製、hooks 註冊等全域配置。

## Deployment

Server deploys to GKE (`asia-east1-docker.pkg.dev/xlab-435802/xlab-registry/claude-together`). Client always runs locally alongside Claude Code.
