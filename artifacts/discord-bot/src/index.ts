import { Client, GatewayIntentBits, Collection } from "discord.js";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readdirSync } from "fs";
import { startWebhookServer, stopWebhookServer } from "./lib/webhookServer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
}) as Client & { commands: Collection<string, any> };

client.commands = new Collection();

async function loadCommands() {
  const commandDirs = ["game", "guild", "admin"];
  for (const dir of commandDirs) {
    const dirPath = path.join(__dirname, "commands", dir);
    let files: string[] = [];
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
    } catch {
      continue;
    }
    for (const file of files) {
      const filePath = pathToFileURL(path.join(dirPath, file)).href;
      const mod = await import(filePath);
      if (mod.data && mod.execute) {
        client.commands.set(mod.data.name, mod);
        console.log(`[Bot] Loaded command: /${mod.data.name}`);
      }
    }
  }
}

async function loadEvents() {
  const eventsDir = path.join(__dirname, "events");
  let files: string[] = [];
  try {
    files = readdirSync(eventsDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
  } catch {
    return;
  }
  for (const file of files) {
    const filePath = pathToFileURL(path.join(eventsDir, file)).href;
    const event = await import(filePath);
    if (event.once) {
      client.once(event.name, (...args: unknown[]) => event.execute(...args));
    } else {
      client.on(event.name, (...args: unknown[]) => event.execute(...args));
    }
    console.log(`[Bot] Registered event: ${event.name}`);
  }
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error("[Bot] ERROR: DISCORD_TOKEN is not set. Add it in Replit Secrets.");
    process.exit(1);
  }

  await loadCommands();
  await loadEvents();

  client.on("error", (err) => {
    console.error("[Bot] Client error:", err);
  });

  process.on("SIGTERM", async () => {
    console.log("[Bot] Shutting down...");
    stopWebhookServer();
    client.destroy();
    process.exit(0);
  });

  await client.login(token);

  startWebhookServer();
}

main().catch((err) => {
  console.error("[Bot] Fatal error:", err);
  process.exit(1);
});
