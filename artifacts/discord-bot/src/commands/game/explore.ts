import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { actionExplore } from "../../lib/actions.js";

export const data = new SlashCommandBuilder()
  .setName("explore")
  .setDescription("🗺️ استكشف الطابق الحالي وقاتل الأعداء");

export async function execute(interaction: ChatInputCommandInteraction) {
  await actionExplore(interaction);
}
