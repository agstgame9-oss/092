import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { actionBountyView, actionBountyClaimAll } from "../../lib/bountyActions.js";

export const data = new SlashCommandBuilder()
  .setName("bounty")
  .setDescription("📜 لوحة المطلوبين — مهام يومية بمكافآت ضخمة!")
  .setDMPermission(false)
  .addSubcommand(sub => sub.setName("view").setDescription("📜 عرض مهامك اليومية وتقدمك"))
  .addSubcommand(sub => sub.setName("claim").setDescription("🎁 استلام مكافآت المهام المكتملة"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "view") return actionBountyView(interaction);
  if (sub === "claim") return actionBountyClaimAll(interaction);
}
