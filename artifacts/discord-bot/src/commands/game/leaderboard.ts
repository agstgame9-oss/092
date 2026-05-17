import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { actionLeaderboard } from "../../lib/actions.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("🏆 عرض لوحة المتصدرين العالمية")
  .addStringOption((o) =>
    o.setName("type")
      .setDescription("نوع لوحة المتصدرين")
      .setRequired(false)
      .addChoices(
        { name: "🏆 تقييم PvP", value: "pvp" },
        { name: "📊 المستوى", value: "level" },
        { name: "💰 الذهب", value: "gold" },
        { name: "💥 إجمالي الضرر", value: "damage" },
        { name: "⚔️ إجمالي الانتصارات", value: "wins" },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const type = (interaction.options.getString("type") ?? "pvp") as "pvp" | "level" | "gold" | "damage" | "wins";
  await actionLeaderboard(interaction, type);
}
