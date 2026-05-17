import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { actionQuestView, actionQuestClaimAll } from "../../lib/questActions.js";

export const data = new SlashCommandBuilder()
  .setName("quests")
  .setDescription("View your daily and weekly quests")
  .addSubcommand(sub => sub.setName("view").setDescription("View your current quests and progress"))
  .addSubcommand(sub => sub.setName("claim").setDescription("Claim rewards for all completed quests"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "view") return actionQuestView(interaction);
  if (sub === "claim") return actionQuestClaimAll(interaction);
}
