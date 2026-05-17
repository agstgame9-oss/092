import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db, playersTable } from "../../lib/db.js";
import { achievementsTable, playerAchievementsTable } from "../../lib/db.js";
import { eq, and } from "drizzle-orm";
import { COLORS, errorEmbed } from "../../lib/embeds.js";
import { ACHIEVEMENT_DEFS, ensureAchievements } from "../../lib/achievementActions.js";

export const data = new SlashCommandBuilder()
  .setName("achievements")
  .setDescription("🏆 عرض إنجازاتك ومكافآتها")
  .addSubcommand((s) => s.setName("all").setDescription("جميع الإنجازات المتاحة"))
  .addSubcommand((s) => s.setName("mine").setDescription("إنجازاتك المكتملة فقط"))
  .addSubcommand((s) => s.setName("progress").setDescription("الإنجازات قيد التقدم"));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const discordId = interaction.user.id;

  await ensureAchievements();

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });

  const playerAchs = await db.select().from(playerAchievementsTable)
    .where(eq(playerAchievementsTable.discordId, discordId));
  const achMap = new Map(playerAchs.map((a) => [a.achievementKey, a]));

  if (sub === "mine") {
    const completed = playerAchs.filter((a) => a.isCompleted);
    if (!completed.length) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("🏆 إنجازاتك")
          .setDescription("لم تكمل أي إنجاز بعد! العب أكثر لفتح الإنجازات.")
          .setTimestamp()],
      });
    }

    const completedDefs = ACHIEVEMENT_DEFS.filter((d) => achMap.get(d.key)?.isCompleted);
    const byCategory = new Map<string, typeof completedDefs>();
    completedDefs.forEach((d) => {
      if (!byCategory.has(d.category)) byCategory.set(d.category, []);
      byCategory.get(d.category)!.push(d);
    });

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(`🏆 إنجازاتك المكتملة (${completed.length}/${ACHIEVEMENT_DEFS.filter((d) => !d.isSecret).length})`)
      .setTimestamp();

    for (const [cat, defs] of byCategory) {
      const lines = defs.map((d) => `${d.emoji} ~~${d.name}~~ ✅`);
      embed.addFields({ name: `📂 ${cat}`, value: lines.join("\n"), inline: false });
    }

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "progress") {
    const inProgress = playerAchs.filter((a) => !a.isCompleted && a.progress > 0);
    if (!inProgress.length) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("📈 الإنجازات قيد التقدم")
          .setDescription("لا توجد إنجازات قيد التقدم حالياً. ابدأ اللعب!")
          .setTimestamp()],
      });
    }

    const lines = inProgress.map((a) => {
      const def = ACHIEVEMENT_DEFS.find((d) => d.key === a.achievementKey);
      if (!def) return "";
      const pct = Math.min(100, Math.round((a.progress / def.requirement) * 100));
      const bar = "█".repeat(Math.floor(pct / 10)) + "░".repeat(10 - Math.floor(pct / 10));
      return `${def.emoji} **${def.name}** — ${bar} ${pct}% (${a.progress}/${def.requirement})`;
    }).filter(Boolean);

    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle("📈 الإنجازات قيد التقدم")
      .setDescription(lines.join("\n"))
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // sub === "all"
  const byCategory = new Map<string, typeof ACHIEVEMENT_DEFS>();
  ACHIEVEMENT_DEFS.forEach((d) => {
    if (d.isSecret && !achMap.get(d.key)?.isCompleted) return;
    if (!byCategory.has(d.category)) byCategory.set(d.category, []);
    byCategory.get(d.category)!.push(d);
  });

  const completed = playerAchs.filter((a) => a.isCompleted).length;
  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`🏆 الإنجازات (${completed}/${ACHIEVEMENT_DEFS.filter((d) => !d.isSecret).length} مكتمل)`)
    .setTimestamp();

  for (const [cat, defs] of byCategory) {
    const lines = defs.map((d) => {
      const pa = achMap.get(d.key);
      if (pa?.isCompleted) return `${d.emoji} ~~${d.name}~~ ✅`;
      const prog = pa ? ` (${pa.progress}/${d.requirement})` : "";
      const reward = [d.rewardGold ? `${d.rewardGold}💰` : "", d.rewardGems ? `${d.rewardGems}💎` : ""].filter(Boolean).join(" ");
      return `${d.emoji} **${d.name}**${prog} — *${d.description}* | ${reward}`;
    });
    if (lines.length) embed.addFields({ name: `📂 ${cat}`, value: lines.join("\n"), inline: false });
  }

  return interaction.editReply({ embeds: [embed] });
}
