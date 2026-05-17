import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { actionSummon } from "../../lib/actions.js";

export const data = new SlashCommandBuilder()
  .setName("summon")
  .setDescription("💎 استدعِ شخصيات الأنمي!")
  .addStringOption((opt) =>
    opt.setName("type")
      .setDescription("نوع الاستدعاء: فردي (10💎) أو ×10 (90💎 مع ضمان S+)")
      .setRequired(false)
      .addChoices(
        { name: "💎 سحبة فردية — 10 جواهر", value: "single" },
        { name: "💎 سحبة ×10 — 90 جواهر (ضمان S+)", value: "ten" },
        { name: "🎁 استدعاء مجاني (كل 24 ساعة)", value: "free" },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const type = (interaction.options.getString("type") ?? "single") as "single" | "ten" | "free";
  await actionSummon(interaction, type);
}
