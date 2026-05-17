import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import {
  actionExpeditionView,
  actionExpeditionStartMenu,
  actionExpeditionClaimAll,
} from "../../lib/expeditionActions.js";

export const data = new SlashCommandBuilder()
  .setName("expedition")
  .setDescription("⛺ البعثات — ابعت شخصياتك ويرجعوا بغنائم تلقائياً!")
  .setDMPermission(false)
  .addSubcommand(sub => sub.setName("view").setDescription("⛺ عرض بعثاتك الحالية"))
  .addSubcommand(sub => sub.setName("start").setDescription("🚀 إرسال بعثة جديدة"))
  .addSubcommand(sub => sub.setName("claim").setDescription("🎁 استلام غنائم البعثات المنتهية"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "view") return actionExpeditionView(interaction);
  if (sub === "start") return actionExpeditionStartMenu(interaction);
  if (sub === "claim") return actionExpeditionClaimAll(interaction);
}
