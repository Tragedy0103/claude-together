import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "crypto";
import { z } from "zod";

// ============================================================
// State
// ============================================================

interface Peer {
  name: string;
  sessionId: string;
  status: string; // what this peer is currently doing
  role: string;   // agent role/description, e.g. "客服" or "infra expert"
  registeredAt: Date;
}

interface Message {
  id: string;
  from: string;
  to: string; // peer name or "*" for broadcast
  content: string;
  timestamp: Date;
  readBy: Set<string>; // peer names that have read this
}


interface Decision {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: Date;
}

interface Event {
  id: string;
  type: string; // e.g. "joined", "left"
  peer: string;
  message: string;
  timestamp: Date;
}

const peers = new Map<string, Peer>(); // sessionId -> Peer
const messages: Message[] = [];
const decisions: Decision[] = [];
const events: Event[] = [];

function getPeerBySession(sessionId: string): Peer | undefined {
  return peers.get(sessionId);
}

function getPeerByName(name: string): Peer | undefined {
  for (const peer of peers.values()) {
    if (peer.name === name) return peer;
  }
  return undefined;
}

function requirePeer(sessionId: string): { peer: Peer } | { error: string } {
  const peer = getPeerBySession(sessionId);
  if (!peer) return { error: "You must call `register` first." };
  return { peer };
}

class PeerNotFoundError extends Error {
  constructor() { super("Not registered."); }
}

function err(text: string) {
  return { content: [{ type: "text" as const, text: `Error: ${text}` }] };
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ============================================================
// MCP Server
// ============================================================

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "claude-together",
    version: "1.0.0",
  });

  // ----------------------------------------------------------
  // Identity
  // ----------------------------------------------------------

  server.tool(
    "register",
    "Register yourself with a name. Call this first before using any other tool.",
    {
      name: z.string().describe("Your display name, e.g. 'auth-agent' or 'api-agent'"),
      role: z.string().optional().describe("Your role or responsibility, e.g. '客服' or 'infra expert'"),
    },
    async (args, extra) => {
      const sessionId = extra.sessionId ?? "unknown";
      // Allow re-registration: remove old session with same name
      const existing = getPeerByName(args.name);
      if (existing && existing.sessionId !== sessionId) {
        peers.delete(existing.sessionId);
      }
      peers.set(sessionId, {
        name: args.name,
        sessionId,
        status: "idle",
        role: args.role || existing?.role || "",
        registeredAt: new Date(),
      });
      // Record join event (no broadcast — peers can query via `event` tool)
      events.push({
        id: randomUUID(),
        type: "joined",
        peer: args.name,
        message: `${args.name} joined the team.`,
        timestamp: new Date(),
      });
      // Return current team state so the new peer has context
      const peerList = Array.from(peers.values()).map((p) => `${p.name} (${p.status})`);
      const summary = [
        `Registered as "${args.name}".`,
        `\nOnline peers: ${peerList.join(", ")}`,
        decisions.length > 0
          ? `\nRecent decisions:\n${decisions.slice(-5).map((d) => `  - ${d.title}: ${d.content}`).join("\n")}`
          : "",
      ];
      return ok(summary.join(""));
    }
  );

  server.tool(
    "set_status",
    "Update your current status so others know what you are working on.",
    { status: z.string().describe("What you are currently doing, e.g. 'implementing login API'") },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      r.peer.status = args.status;
      return ok(`Status updated to: "${args.status}"`);
    }
  );

  server.tool(
    "disconnect",
    "Disconnect yourself from the team. Records a leave event and removes you from the peer list.",
    {},
    async (_args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      const name = r.peer.name;
      events.push({
        id: randomUUID(),
        type: "left",
        peer: name,
        message: `${name} left the team.`,
        timestamp: new Date(),
      });
      peers.delete(extra.sessionId ?? "");
      return ok(`Disconnected "${name}" from the team.`);
    }
  );

  server.tool(
    "list_peers",
    "List all online peers and their current status.",
    {},
    async () => {
      const list = Array.from(peers.values());
      if (list.length === 0) return ok("No peers online.");
      const lines = list.map((p) => `  ${p.name}: ${p.status}${p.role ? ` — ${p.role}` : ""}`);
      return ok(`Online peers:\n${lines.join("\n")}`);
    }
  );

  // ----------------------------------------------------------
  // Messaging
  // ----------------------------------------------------------

  server.tool(
    "send_message",
    "Send a message to a specific peer.",
    {
      to: z.string().describe("Peer name to send to"),
      message: z.string().describe("Message content"),
    },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      if (!getPeerByName(args.to)) return err(`Peer "${args.to}" not found.`);
      messages.push({
        id: randomUUID(),
        from: r.peer.name,
        to: args.to,
        content: args.message,
        timestamp: new Date(),
        readBy: new Set([r.peer.name]),
      });
      return ok(`Message sent to "${args.to}".`);
    }
  );

  server.tool(
    "broadcast",
    "Send a message to all peers.",
    { message: z.string().describe("Message content") },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      messages.push({
        id: randomUUID(),
        from: r.peer.name,
        to: "*",
        content: args.message,
        timestamp: new Date(),
        readBy: new Set([r.peer.name]),
      });
      return ok("Message broadcast to all peers.");
    }
  );

  server.tool(
    "event",
    "List lifecycle events (e.g. joined, left). Optionally filter by type.",
    {
      type: z.string().optional().describe("Filter by event type, e.g. 'joined' or 'left'. Omit for all."),
      limit: z.number().optional().describe("Max number of events to return (default: 20)"),
    },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      let list = [...events];
      if (args.type) list = list.filter((e) => e.type === args.type);
      const max = args.limit ?? 20;
      list = list.slice(-max);
      if (list.length === 0) return ok("No events.");
      const lines = list.map(
        (e) => `  [${e.timestamp.toISOString()}] ${e.type}: ${e.message}`
      );
      return ok(`Events:\n${lines.join("\n")}`);
    }
  );

  // ----------------------------------------------------------
  // Shared Decisions / Context
  // ----------------------------------------------------------

  server.tool(
    "post_decision",
    "Post an architectural or design decision that all peers should know about.",
    {
      title: z.string().describe("Short title, e.g. 'Use JWT for auth'"),
      content: z.string().describe("Details of the decision and rationale"),
    },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      const decision: Decision = {
        id: randomUUID(),
        title: args.title,
        content: args.content,
        createdBy: r.peer.name,
        createdAt: new Date(),
      };
      decisions.push(decision);
      // Auto-broadcast
      messages.push({
        id: randomUUID(),
        from: "system",
        to: "*",
        content: `New decision: "${args.title}" — ${args.content}`,
        timestamp: new Date(),
        readBy: new Set([r.peer.name]),
      });
      return ok(`Decision posted: "${args.title}"`);
    }
  );

  server.tool(
    "list_decisions",
    "List all shared decisions.",
    {},
    async () => {
      if (decisions.length === 0) return ok("No decisions recorded.");
      const lines = decisions.map(
        (d) => `  [${d.createdAt.toISOString()}] ${d.createdBy}: ${d.title}\n    ${d.content}`
      );
      return ok(`Decisions:\n${lines.join("\n")}`);
    }
  );

  // ----------------------------------------------------------
  // Team Overview
  // ----------------------------------------------------------

  server.tool(
    "team_status",
    "Get a full overview: who is online, what they are doing, and recent decisions.",
    {},
    async (_args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);

      const sections: string[] = [];

      // Peers
      const peerList = Array.from(peers.values());
      sections.push("## Peers");
      if (peerList.length === 0) {
        sections.push("  (none)");
      } else {
        for (const p of peerList) sections.push(`  ${p.name}: ${p.status}${p.role ? ` — ${p.role}` : ""}`);
      }

      // Recent decisions
      sections.push("\n## Recent Decisions");
      const recent = decisions.slice(-5);
      if (recent.length === 0) {
        sections.push("  (none)");
      } else {
        for (const d of recent) sections.push(`  - ${d.title} (${d.createdBy})`);
      }

      return ok(sections.join("\n"));
    }
  );

  return server;
}

// ============================================================
// HTTP Server
// ============================================================

const app = express();
const BASE_PATH = (process.env.BASE_PATH ?? "").replace(/\/+$/, ""); // e.g. "/api/v1"
const router = express.Router();
app.use(express.json());

const transports = new Map<string, StreamableHTTPServerTransport>();

router.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId)!.handleRequest(req, res, req.body);
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      transports.set(id, transport);
      console.log(`[+] Session connected: ${id}`);
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      const peer = peers.get(sid);
      if (peer) {
        console.log(`[-] Peer disconnected: ${peer.name}`);
        // Record leave event (no broadcast)
        events.push({
          id: randomUUID(),
          type: "left",
          peer: peer.name,
          message: `${peer.name} left the team.`,
          timestamp: new Date(),
        });
        peers.delete(sid);
      }
      transports.delete(sid);
    }
  };

  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

router.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId)!.handleRequest(req, res);
    return;
  }
  res.status(400).json({ error: "Missing or invalid session ID" });
});

router.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId)!.handleRequest(req, res, req.body);
    return;
  }
  res.status(400).json({ error: "Missing or invalid session ID" });
});

// SSE endpoint for channel processes to subscribe to messages
interface ChannelSubscriber {
  peerName: string;
  res: express.Response;
}
const channelSubscribers = new Map<string, ChannelSubscriber>(); // peerName -> subscriber

router.get("/channel/subscribe/:peerName", (req, res) => {
  const peerName = req.params.peerName;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("data: connected\n\n");

  channelSubscribers.set(peerName, { peerName, res });
  console.log(`[channel] ${peerName} subscribed to events`);

  req.on("close", () => {
    channelSubscribers.delete(peerName);
    console.log(`[channel] ${peerName} unsubscribed`);
  });
});

// Internal function: push a message to channel subscribers
function pushToChannel(targetPeer: string, from: string, content: string) {
  // Push to specific peer
  const sub = channelSubscribers.get(targetPeer);
  if (sub) {
    const event = JSON.stringify({ from, content, timestamp: new Date().toISOString() });
    sub.res.write(`data: ${event}\n\n`);
  }
}

function broadcastToChannels(from: string, content: string) {
  for (const [peerName, sub] of channelSubscribers.entries()) {
    if (peerName !== from) {
      const event = JSON.stringify({ from, content, timestamp: new Date().toISOString() });
      sub.res.write(`data: ${event}\n\n`);
    }
  }
}

// POST endpoint for sending messages via channel (used by the channel stdio process)
router.post("/channel/send", (req, res) => {
  const { from, to, content } = req.body as { from: string; to: string; content: string };
  if (!from || !content) {
    res.status(400).json({ error: "Missing from or content" });
    return;
  }

  // Store message — the messages.push override handles channel push
  messages.push({
    id: randomUUID(),
    from,
    to: to || "*",
    content,
    timestamp: new Date(),
    readBy: new Set([from]),
  });

  res.json({ ok: true });
});

// Also push when messages are sent via MCP tools - patch into existing message flow
// We override the message push to also notify channel subscribers
const originalPush = messages.push.bind(messages);
messages.push = (...items: Message[]) => {
  const result = originalPush(...items);
  for (const msg of items) {
    if (msg.to === "*") {
      broadcastToChannels(msg.from, msg.content);
    } else {
      pushToChannel(msg.to, msg.from, msg.content);
    }
  }
  return result;
};

// REST proxy endpoint — allows channel clients to call MCP tools via HTTP
router.post("/api/call", async (req, res) => {
  const { peer, tool, args } = req.body as { peer: string; tool: string; args: Record<string, unknown> };
  if (!peer || !tool) {
    res.status(400).json({ error: "Missing peer or tool" });
    return;
  }

  // Find or create a virtual session for this peer
  let sessionId: string | null = null;
  for (const [sid, p] of peers.entries()) {
    if (p.name === peer) {
      sessionId = sid;
      break;
    }
  }
  if (!sessionId) {
    // Auto-register the peer with a virtual session
    sessionId = `api-${peer}-${randomUUID()}`;
    peers.set(sessionId, {
      name: peer,
      sessionId,
      status: "idle",
      role: "",
      registeredAt: new Date(),
    });
  }

  // Execute the tool logic directly
  try {
    const result = await executeToolDirect(sessionId, tool, args ?? {});
    res.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

// Direct tool execution (bypasses MCP transport)
async function executeToolDirect(sessionId: string, tool: string, args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[] }> {
  const requirePeerDirect = (): Peer => {
    const peer = peers.get(sessionId);
    if (!peer) throw new PeerNotFoundError();
    return peer;
  };

  try { switch (tool) {
    case "register": {
      const name = args.name as string;
      const role = (args.role as string) || "";
      const existing = getPeerByName(name);
      if (existing && existing.sessionId !== sessionId) {
        peers.delete(existing.sessionId);
      }
      peers.set(sessionId, {
        name,
        sessionId,
        status: "idle",
        role: role || existing?.role || "",
        registeredAt: new Date(),
      });
      // Record join event (no broadcast)
      events.push({
        id: randomUUID(),
        type: "joined",
        peer: name,
        message: `${name} joined the team.`,
        timestamp: new Date(),
      });
      const peerList = Array.from(peers.values()).map((p) => `${p.name} (${p.status})`);
      const summary = [
        `Registered as "${name}".`,
        `\nOnline peers: ${peerList.join(", ")}`,
      ];
      return ok(summary.join(""));
    }
    case "disconnect": {
      const peer = requirePeerDirect();
      const dName = peer.name;
      events.push({
        id: randomUUID(),
        type: "left",
        peer: dName,
        message: `${dName} left the team.`,
        timestamp: new Date(),
      });
      peers.delete(sessionId);
      return ok(`Disconnected "${dName}" from the team.`);
    }
    case "set_status": {
      const peer = requirePeerDirect();
      peer.status = args.status as string;
      return ok(`Status updated to: "${args.status}"`);
    }
    case "list_peers": {
      const list = Array.from(peers.values());
      if (list.length === 0) return ok("No peers online.");
      const lines = list.map((p) => `  ${p.name}: ${p.status}${p.role ? ` — ${p.role}` : ""}`);
      return ok(`Online peers:\n${lines.join("\n")}`);
    }
    case "send_message": {
      const peer = requirePeerDirect();
      if (!getPeerByName(args.to as string)) return err(`Peer "${args.to}" not found.`);
      messages.push({
        id: randomUUID(),
        from: peer.name,
        to: args.to as string,
        content: args.message as string,
        timestamp: new Date(),
        readBy: new Set([peer.name]),
      });
      return ok(`Message sent to "${args.to}".`);
    }
    case "broadcast": {
      const peer = requirePeerDirect();
      messages.push({
        id: randomUUID(),
        from: peer.name,
        to: "*",
        content: args.message as string,
        timestamp: new Date(),
        readBy: new Set([peer.name]),
      });
      return ok("Message broadcast to all peers.");
    }
    case "event": {
      requirePeerDirect();
      let list = [...events];
      if (args.type) list = list.filter((e) => e.type === (args.type as string));
      const max = (args.limit as number) ?? 20;
      list = list.slice(-max);
      if (list.length === 0) return ok("No events.");
      const lines = list.map(
        (e) => `  [${e.timestamp.toISOString()}] ${e.type}: ${e.message}`
      );
      return ok(`Events:\n${lines.join("\n")}`);
    }
    case "post_decision": {
      const peer = requirePeerDirect();
      const decision: Decision = {
        id: randomUUID(),
        title: args.title as string,
        content: args.content as string,
        createdBy: peer.name,
        createdAt: new Date(),
      };
      decisions.push(decision);
      messages.push({
        id: randomUUID(),
        from: "system",
        to: "*",
        content: `New decision: "${args.title}" — ${args.content}`,
        timestamp: new Date(),
        readBy: new Set([peer.name]),
      });
      return ok(`Decision posted: "${args.title}"`);
    }
    case "list_decisions": {
      if (decisions.length === 0) return ok("No decisions recorded.");
      const lines = decisions.map(
        (d) => `  [${d.createdAt.toISOString()}] ${d.createdBy}: ${d.title}\n    ${d.content}`
      );
      return ok(`Decisions:\n${lines.join("\n")}`);
    }
    case "team_status": {
      const sections: string[] = [];
      const peerList = Array.from(peers.values());
      sections.push("## Peers");
      if (peerList.length === 0) {
        sections.push("  (none)");
      } else {
        for (const p of peerList) sections.push(`  ${p.name}: ${p.status}${p.role ? ` — ${p.role}` : ""}`);
      }
      sections.push("\n## Recent Decisions");
      const recent = decisions.slice(-5);
      if (recent.length === 0) {
        sections.push("  (none)");
      } else {
        for (const d of recent) sections.push(`  - ${d.title} (${d.createdBy})`);
      }
      return ok(sections.join("\n"));
    }
    default:
      return err(`Unknown tool: ${tool}`);
  } } catch (e) {
    if (e instanceof PeerNotFoundError) return err(e.message);
    throw e;
  }
}

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    peers: Array.from(peers.values()).map((p) => ({ name: p.name, status: p.status, role: p.role })),
    decisionCount: decisions.length,
  });
});

app.use(BASE_PATH, router);

const PORT = parseInt(process.env.PORT ?? "3456", 10);
const server = app.listen(PORT, () => {
  console.log(`claude-together MCP server running on http://localhost:${PORT}${BASE_PATH}/mcp`);
  console.log(`Health check: http://localhost:${PORT}${BASE_PATH}/health`);
});

// Graceful shutdown: notify all subscribers before exiting
function gracefulShutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down...`);

  // Broadcast shutdown message to all SSE subscribers
  const event = JSON.stringify({
    from: "system",
    content: "⚠️ Server is shutting down. You are now disconnected.",
    timestamp: new Date().toISOString(),
  });
  for (const [, sub] of channelSubscribers.entries()) {
    try {
      sub.res.write(`data: ${event}\n\n`);
      sub.res.end();
    } catch {
      // ignore write errors on already-closed connections
    }
  }

  // Close HTTP server and exit
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });

  // Force exit after 3s if connections don't close
  setTimeout(() => process.exit(1), 3000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
