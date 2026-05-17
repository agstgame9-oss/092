import http from "node:http";
import { db } from "@workspace/db";
import { serverConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET ?? "ama-internal-secret";
const WEBHOOK_PORT = Number(process.env.BOT_WEBHOOK_PORT ?? "9001");

export interface ReloadPayload {
  reason?: string;
  patchId?: number;
}

let server: http.Server | null = null;

export function startWebhookServer(): void {
  server = http.createServer(async (req, res) => {
    const authHeader = req.headers["x-webhook-secret"];
    if (authHeader !== WEBHOOK_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ts: Date.now() }));
      return;
    }

    if (req.method === "POST" && req.url === "/reload") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const payload: ReloadPayload = body ? JSON.parse(body) : {};
          console.log(`[Webhook] Reload triggered — reason: ${payload.reason ?? "manual"}, patchId: ${payload.patchId ?? "n/a"}`);

          await reloadBotData();

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, reloaded: true }));
        } catch (err) {
          console.error("[Webhook] Reload error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Reload failed" }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(WEBHOOK_PORT, "127.0.0.1", () => {
    console.log(`[Webhook] Bot webhook server listening on port ${WEBHOOK_PORT}`);
  });

  server.on("error", (err) => {
    console.error("[Webhook] Server error:", err);
  });
}

async function reloadBotData(): Promise<void> {
  try {
    const configs = await db.select().from(serverConfigTable);
    console.log(`[Webhook] Reloaded ${configs.length} server config(s) from DB`);
  } catch (err) {
    console.error("[Webhook] Failed to reload from DB:", err);
    throw err;
  }
}

export function stopWebhookServer(): void {
  server?.close(() => {
    console.log("[Webhook] Server stopped");
  });
}
