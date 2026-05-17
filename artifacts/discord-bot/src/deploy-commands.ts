import { REST, Routes } from "discord.js";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN must be set.");
  process.exit(1);
}

// Always derive Application ID from the token itself — guaranteed to be correct.
const clientId = Buffer.from(token.split(".")[0]!, "base64").toString("utf-8");
if (!/^\d+$/.test(clientId)) {
  console.error("Could not extract Application ID from DISCORD_TOKEN. Make sure the token is valid.");
  process.exit(1);
}
console.log(`Application ID (from token): ${clientId}`);

const commands: object[] = [];

async function loadAllCommands() {
  const dirs = ["game", "guild", "admin"];
  for (const dir of dirs) {
    const dirPath = path.join(__dirname, "commands", dir);
    let files: string[] = [];
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
    } catch {
      continue;
    }
    for (const file of files) {
      const mod = await import(pathToFileURL(path.join(dirPath, file)).href);
      if (mod.data) {
        commands.push(mod.data.toJSON());
        console.log(`Loaded: /${mod.data.name}`);
      }
    }
  }
}

async function deploy() {
  await loadAllCommands();
  const rest = new REST().setToken(token!);
  console.log(`\nRegistering ${commands.length} slash commands globally…`);
  const data = await rest.put(Routes.applicationCommands(clientId), { body: commands }) as unknown[];
  console.log(`✅ Successfully registered ${data.length} slash commands.`);
}

deploy().catch(console.error);
