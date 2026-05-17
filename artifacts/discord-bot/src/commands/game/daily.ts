import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { actionDaily } from "../../lib/actions.js";

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("🎁 استلم مكافآتك اليومية!");

export async function execute(interaction: ChatInputCommandInteraction) {
  await actionDaily(interaction);
}
