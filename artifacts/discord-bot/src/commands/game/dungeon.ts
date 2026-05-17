import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import {
  actionDungeonView,
  actionDungeonEnter,
  actionDungeonClaimAll,
} from "../../lib/dungeonActions.js";

export const data = new SlashCommandBuilder()
  .setName("dungeon")
  .setDescription("🏰 الزنازين اليومية — قاتل، تقدم، وافوز بجوائز ضخمة!")
  .setDMPermission(false)
  .addSubcommand(sub => sub.setName("view").setDescription("🏰 عرض الزنازين اليومية المتاحة"))
  .addSubcommand(sub =>
    sub.setName("enter")
      .setDescription("⚔️ دخول زنزانة معينة")
      .addStringOption(opt =>
        opt.setName("id").setDescription("معرف الزنزانة").setRequired(true)
          .addChoices(
            { name: "⚔️ متاهة المحاربين (سهلة)", value: "dungeon_training" },
            { name: "🔥 زنزانة اللهب (سهلة)", value: "dungeon_fire" },
            { name: "🌊 برج المحيط (متوسطة)", value: "dungeon_water" },
            { name: "⚡ برج الرعد (متوسطة)", value: "dungeon_thunder" },
            { name: "❄️ معقل الجليد (متوسطة)", value: "dungeon_ice" },
            { name: "🌪️ قلعة الريح (متوسطة)", value: "dungeon_wind" },
            { name: "🌑 قلعة الظلام (صعبة)", value: "dungeon_dark" },
            { name: "✨ معبد الفجر (صعبة)", value: "dungeon_light" },
            { name: "🌀 بوابة الفوضى (صعبة+)", value: "dungeon_chaos" },
          )
      )
  )
  .addSubcommand(sub => sub.setName("claim").setDescription("🎁 استلام جوائز الزنازين المنتهية"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "view") return actionDungeonView(interaction);
  if (sub === "enter") {
    const id = interaction.options.getString("id", true);
    return actionDungeonEnter(interaction, id);
  }
  if (sub === "claim") return actionDungeonClaimAll(interaction);
}
