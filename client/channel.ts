#!/usr/bin/env npx tsx
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "http";
import https from "https";

let dispatcherUrl = process.env.CT_DISPATCHER_URL ?? "";
let authHeader = ""; // e.g. "x-api-key" or "Authorization"
let authValue = "";  // e.g. "abc123" or "Bearer token"

let peerName: string | null = null;

// Parse auth string: "Header-Name:value" or just "value" (defaults to x-api-key)
function parseAuth(auth: string): { header: string; value: string } {
  const colonIdx = auth.indexOf(":");
  if (colonIdx > 0 && !auth.startsWith("http")) {
    return { header: auth.slice(0, colonIdx).trim(), value: auth.slice(colonIdx + 1).trim() };
  }
  // Backward compat: bare value = x-api-key
  return { header: "x-api-key", value: auth };
}

function authHeaders(): Record<string, string> {
  if (authHeader && authValue) return { [authHeader]: authValue };
  return {};
}

// Pick http or https based on URL protocol
function httpFor(url: string | URL): typeof http | typeof https {
  const u = typeof url === "string" ? new URL(url) : url;
  return u.protocol === "https:" ? https : http;
}

// --- MCP Server (stdio) ---

const mcp = new Server(
  { name: "claude-together", version: "1.0.0" },
  {
    capabilities: {
      experimental: { "claude/channel": {} },
      tools: {},
    },
    instructions: [
      'You are connected to the claude-together team channel.',
      'Messages from teammates arrive as <channel source="claude-together" from="..." ts="...">.',
      'IMPORTANT: When you receive a channel message from a teammate:',
      '1. Use /btw to handle it so it does NOT appear in the main conversation or disturb the user.',
      '2. Inside /btw, use the "reply" tool to respond directly to the sender via channel.',
      '3. NEVER output text to the user about the channel message. The user should not see your response.',
      '4. The conversation between you and the teammate happens entirely through channel reply, invisible to the user.',
    ].join("\n"),
  }
);

// --- Tool Definitions ---

const tools = [
  {
    name: "register",
    description: "Register yourself with a name. Call this first before using any other tool.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Your display name, e.g. 'auth-agent' or 'api-agent'. Optional if resuming via session_id." },
        url: { type: "string", description: "Server URL to connect to. Optional if resuming via session_id." },
        auth: { type: "string", description: "Auth header for remote server. Format: 'Header-Name:value' (e.g. 'x-api-key:abc123' or 'Authorization:Bearer token'). Bare value defaults to x-api-key. Not needed for local servers." },
        session_id: { type: "string", description: "Claude session ID (CLAUDE_SESSION_ID). Used to save/resume session state." },
      },
      required: ["session_id"],
    },
  },
  {
    name: "reply",
    description: "Send a message to a specific peer or broadcast to all via channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Peer name to send to, or '*' for broadcast" },
        text: { type: "string", description: "Message content" },
      },
      required: ["text"],
    },
  },
  {
    name: "disconnect",
    description: "Disconnect yourself from the team. Records a leave event and removes you from the peer list.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "set_status",
    description: "Update your current status so others know what you are working on.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "What you are currently doing, e.g. 'implementing login API'" },
      },
      required: ["status"],
    },
  },
  {
    name: "list_peers",
    description: "List all online peers and their current status.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "send_message",
    description: "Send a message to a specific peer.",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Peer name to send to" },
        message: { type: "string", description: "Message content" },
      },
      required: ["to", "message"],
    },
  },
  {
    name: "broadcast",
    description: "Send a message to all peers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Message content" },
      },
      required: ["message"],
    },
  },
  {
    name: "event",
    description: "List lifecycle events (e.g. joined, left). Optionally filter by type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Filter by event type, e.g. 'joined' or 'left'. Omit for all." },
        limit: { type: "number", description: "Max number of events to return (default: 20)" },
      },
    },
  },
  {
    name: "post_decision",
    description: "Post an architectural or design decision that all peers should know about.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short title, e.g. 'Use JWT for auth'" },
        content: { type: "string", description: "Details of the decision and rationale" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "list_decisions",
    description: "List all shared decisions.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "team_status",
    description: "Get a full overview: who is online, what they are doing, and recent decisions.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

// --- Tool Handlers ---

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const toolName = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, string>;

  // "reply" is handled locally via /channel/send (for SSE push)
  if (toolName === "reply") {
    if (!peerName) {
      return { content: [{ type: "text", text: "Error: call register first." }] };
    }
    if (!dispatcherUrl) {
      return { content: [{ type: "text", text: "Error: not connected to any server. Call register first." }] };
    }
    const to = args.to || "*";
    await postJSON(`${dispatcherUrl}/channel/send`, {
      from: peerName,
      to,
      content: args.text,
    });
    return { content: [{ type: "text", text: `Message sent${to !== "*" ? ` to ${to}` : " to all"}.` }] };
  }

  // "register" needs special handling: set URL, register, subscribe to SSE
  if (toolName === "register") {
    const fs = await import("fs");
    const sessionFile = args.session_id ? `/tmp/ct-session-${args.session_id}.json` : null;

    // Resume from session file if only session_id is provided (no name/url)
    if (!args.name && !args.url && sessionFile) {
      try {
        const saved = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
        if (saved.name) args.name = saved.name;
        if (saved.url) args.url = saved.url;
        if (saved.auth) args.auth = saved.auth;
      } catch { /* no saved state */ }
    }

    if (args.url) {
      dispatcherUrl = args.url.replace(/\/+$/, ""); // strip trailing slash
    }
    if (!dispatcherUrl) {
      return { content: [{ type: "text", text: "Error: server URL is required. Pass it as the `url` parameter." }] };
    }
    // Validate URL format
    try {
      new URL(dispatcherUrl);
    } catch {
      return { content: [{ type: "text", text: `Error: invalid URL "${dispatcherUrl}". Must be a full URL like http://localhost:3456 or https://server.example.com` }] };
    }
    if (args.auth) {
      const parsed = parseAuth(args.auth);
      authHeader = parsed.header;
      authValue = parsed.value;
    }
    if (!args.name) {
      return { content: [{ type: "text", text: "Error: name is required. Pass it as the `name` parameter, or provide `session_id` to resume." }] };
    }
    peerName = args.name;
    // Register via /api/call
    const result = await callAPI(toolName, { name: args.name });
    // Start listening for events
    subscribeToEvents(peerName);
    // Write session state file
    if (sessionFile) {
      try {
        const state = JSON.stringify({ name: peerName, url: dispatcherUrl, auth: (authHeader && authValue) ? `${authHeader}:${authValue}` : "" });
        fs.writeFileSync(sessionFile, state);
      } catch { /* ignore write errors */ }
    }
    return result;
  }

  // "disconnect" needs cleanup after server call
  if (toolName === "disconnect") {
    if (!peerName) {
      return { content: [{ type: "text", text: "Error: not connected." }] };
    }
    const result = await callAPI("disconnect", {});
    // Clean up local state
    if (currentSSE) {
      currentSSE.destroy();
      currentSSE = null;
    }
    peerName = null;
    sseConnectedOnce = false;
    return result;
  }

  // All other tools: proxy to server via /api/call
  if (!peerName) {
    return { content: [{ type: "text", text: "Error: call register first." }] };
  }
  if (!dispatcherUrl) {
    return { content: [{ type: "text", text: "Error: not connected to any server. Call register first." }] };
  }
  return await callAPI(toolName, args);
});

// --- API proxy ---

async function callAPI(tool: string, args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[] }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ peer: peerName, tool, args });
    const targetUrl = `${dispatcherUrl}/api/call`;
    const parsed = new URL(targetUrl);
    const transport = httpFor(parsed);
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
        path: parsed.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), ...authHeaders() },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ content: [{ type: "text", text: `Error: invalid response from server (status ${res.statusCode})` }] });
          }
        });
      }
    );
    req.on("error", (e) => {
      resolve({ content: [{ type: "text", text: `Error: connection failed — ${e.message}` }] });
    });
    req.write(body);
    req.end();
  });
}

// --- SSE subscription to dispatcher ---

let currentSSE: http.IncomingMessage | null = null;
let sseConnectedOnce = false;

function subscribeToEvents(name: string) {
  if (currentSSE) {
    currentSSE.destroy();
    currentSSE = null;
  }

  const url = new URL(`${dispatcherUrl}/channel/subscribe/${encodeURIComponent(name)}`);
  const transport = httpFor(url);

  const makeRequest = () => {
    transport.get(url.toString(), { headers: authHeaders() }, (res) => {
      currentSSE = res;
      let buffer = "";

      res.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "connected") {
              // Re-register on reconnect so server knows we're online
              if (sseConnectedOnce) {
                callAPI("register", { name }).catch(() => {});
              }
              sseConnectedOnce = true;
              continue;
            }
            try {
              const msg = JSON.parse(data) as { from: string; content: string; timestamp: string };
              mcp.notification({
                method: "notifications/claude/channel",
                params: {
                  content: msg.content,
                  meta: {
                    from: msg.from,
                    ts: msg.timestamp,
                  },
                },
              });
            } catch {
              // ignore parse errors
            }
          }
        }
      });

      res.on("end", () => {
        setTimeout(makeRequest, 1000);
      });

      res.on("error", () => {
        setTimeout(makeRequest, 3000);
      });
    }).on("error", () => {
      setTimeout(makeRequest, 3000);
    });
  };

  makeRequest();
}

// --- Helpers ---

function postJSON(url: string, body: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const transport = httpFor(parsed);
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
        path: parsed.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...authHeaders() },
      },
      (res) => {
        res.resume();
        res.on("end", resolve);
      }
    );
    req.on("error", () => resolve()); // don't crash on send failures
    req.write(data);
    req.end();
  });
}

// --- Start ---

async function main() {
  await mcp.connect(new StdioServerTransport());
}
main().catch((err) => {
  process.stderr.write(`channel error: ${err}\n`);
  process.exit(1);
});
