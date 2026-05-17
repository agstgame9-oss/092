import { Client, Events, ActivityType } from "discord.js";

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  await client.user.setPresence({
    status: "online",
    activities: [{ name: "Anime Multiverse Arena ⚔️", type: ActivityType.Playing }],
  });

  const clientId = client.user.id;
  const inviteLink =
    `https://discord.com/oauth2/authorize?client_id=${clientId}` +
    `&scope=bot+applications.commands&permissions=8`;

  try {
    const guilds = await client.guilds.fetch();
    console.log(`[Bot] ✅ Logged in as ${client.user.tag} (${clientId})`);
    console.log(`[Bot] 🌐 Serving ${guilds.size} server(s)`);
    if (guilds.size > 0) {
      guilds.forEach((g) => console.log(`[Bot]    • ${g.name} (${g.id})`));
    } else {
      console.log(`[Bot] ⚠️  Bot is not in any server yet!`);
      console.log(`[Bot] 👉 Invite link: ${inviteLink}`);
      console.log(`[Bot]    Also enable Server Members Intent in Discord Developer Portal:`);
      console.log(`[Bot]    https://discord.com/developers/applications/${clientId}/bot`);
    }
  } catch {
    console.log(`[Bot] ✅ Logged in as ${client.user.tag}`);
    console.log(`[Bot] 👉 Invite link: ${inviteLink}`);
  }
}
