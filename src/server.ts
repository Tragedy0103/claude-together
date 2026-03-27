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

interface Task {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "done" | "blocked";
  assignee: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FileLock {
  path: string;
  owner: string;
  lockedAt: Date;
  reason: string;
}

interface Decision {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: Date;
}

const peers = new Map<string, Peer>(); // sessionId -> Peer
const messages: Message[] = [];
const tasks = new Map<string, Task>(); // taskId -> Task
const fileLocks = new Map<string, FileLock>(); // filePath -> FileLock
const decisions: Decision[] = [];

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
    { name: z.string().describe("Your display name, e.g. 'auth-agent' or 'api-agent'") },
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
        registeredAt: new Date(),
      });
      // Return current team state so the new peer has context
      const peerList = Array.from(peers.values()).map((p) => `${p.name} (${p.status})`);
      const openTasks = Array.from(tasks.values()).filter((t) => t.status !== "done");
      const summary = [
        `Registered as "${args.name}".`,
        `\nOnline peers: ${peerList.join(", ")}`,
        openTasks.length > 0
          ? `\nOpen tasks:\n${openTasks.map((t) => `  [${t.id}] ${t.title} (${t.status}, assignee: ${t.assignee ?? "none"})`).join("\n")}`
          : "\nNo open tasks.",
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
    "list_peers",
    "List all online peers and their current status.",
    {},
    async () => {
      const list = Array.from(peers.values());
      if (list.length === 0) return ok("No peers online.");
      const lines = list.map((p) => `  ${p.name}: ${p.status}`);
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

  // ----------------------------------------------------------
  // Shared Task List
  // ----------------------------------------------------------

  server.tool(
    "create_task",
    "Create a new task for the team. Anyone can pick it up.",
    {
      title: z.string().describe("Short task title"),
      description: z.string().describe("Detailed description of what needs to be done"),
      assignee: z.string().optional().describe("Peer name to assign to (optional)"),
    },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      const id = `task-${tasks.size + 1}`;
      const now = new Date();
      tasks.set(id, {
        id,
        title: args.title,
        description: args.description,
        status: args.assignee ? "in_progress" : "open",
        assignee: args.assignee ?? null,
        createdBy: r.peer.name,
        createdAt: now,
        updatedAt: now,
      });
      // Auto-broadcast so everyone knows
      messages.push({
        id: randomUUID(),
        from: "system",
        to: "*",
        content: `New task [${id}]: "${args.title}"${args.assignee ? ` (assigned to ${args.assignee})` : ""}`,
        timestamp: now,
        readBy: new Set([r.peer.name]),
      });
      return ok(`Task created: [${id}] ${args.title}`);
    }
  );

  server.tool(
    "list_tasks",
    "List all tasks and their status.",
    {
      status: z.enum(["all", "open", "in_progress", "done", "blocked"]).optional().describe("Filter by status (default: all)"),
    },
    async (args) => {
      const filter = args.status ?? "all";
      let list = Array.from(tasks.values());
      if (filter !== "all") list = list.filter((t) => t.status === filter);
      if (list.length === 0) return ok(`No tasks${filter !== "all" ? ` with status "${filter}"` : ""}.`);
      const lines = list.map(
        (t) => `  [${t.id}] ${t.title} | ${t.status} | assignee: ${t.assignee ?? "none"} | by: ${t.createdBy}`
      );
      return ok(`Tasks:\n${lines.join("\n")}`);
    }
  );

  server.tool(
    "claim_task",
    "Assign a task to yourself and set it to in_progress.",
    { task_id: z.string().describe("Task ID, e.g. task-1") },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      const task = tasks.get(args.task_id);
      if (!task) return err(`Task "${args.task_id}" not found.`);
      if (task.assignee && task.assignee !== r.peer.name) {
        return err(`Task already assigned to "${task.assignee}".`);
      }
      task.assignee = r.peer.name;
      task.status = "in_progress";
      task.updatedAt = new Date();
      return ok(`Task [${task.id}] assigned to you.`);
    }
  );

  server.tool(
    "update_task",
    "Update a task's status or description.",
    {
      task_id: z.string().describe("Task ID"),
      status: z.enum(["open", "in_progress", "done", "blocked"]).optional(),
      description: z.string().optional().describe("Updated description"),
    },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      const task = tasks.get(args.task_id);
      if (!task) return err(`Task "${args.task_id}" not found.`);
      if (args.status) task.status = args.status;
      if (args.description) task.description = args.description;
      task.updatedAt = new Date();
      // Notify on status change
      if (args.status) {
        messages.push({
          id: randomUUID(),
          from: "system",
          to: "*",
          content: `Task [${task.id}] "${task.title}" → ${args.status} (by ${r.peer.name})`,
          timestamp: new Date(),
          readBy: new Set([r.peer.name]),
        });
      }
      return ok(`Task [${task.id}] updated.`);
    }
  );

  // ----------------------------------------------------------
  // File Locking (conflict prevention)
  // ----------------------------------------------------------

  server.tool(
    "lock_file",
    "Lock a file so other peers know you are editing it. Prevents conflicts.",
    {
      path: z.string().describe("File path relative to project root, e.g. src/auth.ts"),
      reason: z.string().optional().describe("Why you need this file"),
    },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      const existing = fileLocks.get(args.path);
      if (existing && existing.owner !== r.peer.name) {
        return err(`File "${args.path}" is locked by "${existing.owner}" (reason: ${existing.reason}).`);
      }
      fileLocks.set(args.path, {
        path: args.path,
        owner: r.peer.name,
        lockedAt: new Date(),
        reason: args.reason ?? "editing",
      });
      return ok(`File "${args.path}" locked by you.`);
    }
  );

  server.tool(
    "unlock_file",
    "Release your lock on a file.",
    { path: z.string().describe("File path to unlock") },
    async (args, extra) => {
      const r = requirePeer(extra.sessionId ?? "");
      if ("error" in r) return err(r.error);
      const lock = fileLocks.get(args.path);
      if (!lock) return ok(`File "${args.path}" is not locked.`);
      if (lock.owner !== r.peer.name) return err(`File is locked by "${lock.owner}", not you.`);
      fileLocks.delete(args.path);
      return ok(`File "${args.path}" unlocked.`);
    }
  );

  server.tool(
    "check_file",
    "Check if a file is locked by someone before editing.",
    { path: z.string().describe("File path to check") },
    async (args) => {
      const lock = fileLocks.get(args.path);
      if (!lock) return ok(`File "${args.path}" is free.`);
      return ok(`File "${args.path}" is locked by "${lock.owner}" since ${lock.lockedAt.toISOString()} (reason: ${lock.reason}).`);
    }
  );

  server.tool(
    "list_locks",
    "List all currently locked files.",
    {},
    async () => {
      const locks = Array.from(fileLocks.values());
      if (locks.length === 0) return ok("No files are locked.");
      const lines = locks.map((l) => `  ${l.path} → ${l.owner} (${l.reason})`);
      return ok(`Locked files:\n${lines.join("\n")}`);
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
    "Get a full overview: who is online, what they are doing, open tasks, locked files, and recent decisions.",
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
        for (const p of peerList) sections.push(`  ${p.name}: ${p.status}`);
      }

      // Tasks
      const openTasks = Array.from(tasks.values()).filter((t) => t.status !== "done");
      sections.push("\n## Open Tasks");
      if (openTasks.length === 0) {
        sections.push("  (none)");
      } else {
        for (const t of openTasks) {
          sections.push(`  [${t.id}] ${t.title} | ${t.status} | assignee: ${t.assignee ?? "none"}`);
        }
      }

      // Locks
      const locks = Array.from(fileLocks.values());
      sections.push("\n## Locked Files");
      if (locks.length === 0) {
        sections.push("  (none)");
      } else {
        for (const l of locks) sections.push(`  ${l.path} → ${l.owner}`);
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
app.use(express.json());

const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req, res) => {
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
        // Release all locks held by this peer
        for (const [path, lock] of fileLocks.entries()) {
          if (lock.owner === peer.name) fileLocks.delete(path);
        }
        peers.delete(sid);
      }
      transports.delete(sid);
    }
  };

  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId)!.handleRequest(req, res);
    return;
  }
  res.status(400).json({ error: "Missing or invalid session ID" });
});

app.delete("/mcp", async (req, res) => {
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

app.get("/channel/subscribe/:peerName", (req, res) => {
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
app.post("/channel/send", (req, res) => {
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

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    peers: Array.from(peers.values()).map((p) => ({ name: p.name, status: p.status })),
    taskCount: tasks.size,
    lockCount: fileLocks.size,
    decisionCount: decisions.length,
  });
});

const PORT = parseInt(process.env.PORT ?? "3456", 10);
app.listen(PORT, () => {
  console.log(`claude-together MCP server running on http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
