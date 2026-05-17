import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db, worldBossSessionsTable, worldBossDamageTable, bossesTable } from "../../lib/db.js";
import { eq, and, desc } from "drizzle-orm";
import { COLORS, errorEmbed } from "../../lib/embeds.js";
import { getActiveBossSession, buildBossEmbed, worldBossRow } from "../../lib/worldBossActions.js";

export const data = new SlashCommandBuilder()
  .setName("worldboss")
  .setDescription("🌋 الوحش العالمي — الإحصائيات والمشاركة")
  .addSubcommand((s) => s.setName("view").setDescription("عرض الوحش العالمي الحالي"))
  .addSubcommand((s) => s.setName("history").setDescription("سجل وحوش قُتلت مسبقاً"))
  .addSubcommand((s) => s.setName("mystats").setDescription("إحصائياتك في معارك الوحوش"));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const guildServerId = interaction.guildId ?? "global";

  if (sub === "view") {
    const session = await getActiveBossSession(guildServerId);
    if (!session) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("🌋 لا يوجد وحش عالمي حالياً")
          .setDescription("انتظر حتى يُطلق أحد المديرين وحشاً عالمياً باستخدام `/admin spawn`.\nيمكنك متابعة الإعلانات لمعرفة وقت الإطلاق!")
          .setTimestamp()],
      });
    }

    if (session.isDefeated) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x95A5A6)
          .setTitle("💀 الوحش مهزوم!")
          .setDescription(`تم هزيمة **${session.bossName}** بالفعل. انتظر الوحش القادم!`)
          .setTimestamp()],
      });
    }

    const embed = await buildBossEmbed(session);
    return interaction.editReply({ embeds: [embed], components: [worldBossRow(session.id)] });
  }

  if (sub === "history") {
    const sessions = await db.select()
      .from(worldBossSessionsTable)
      .where(and(
        eq(worldBossSessionsTable.guildServerId, guildServerId),
        eq(worldBossSessionsTable.isDefeated, true),
      ))
      .orderBy(desc(worldBossSessionsTable.createdAt))
      .limit(5);

    if (!sessions.length) {
      return interaction.editReply({ embeds: [errorEmbed("لا يوجد وحوش مهزومة بعد!")] });
    }

    const lines = sessions.map((s, i) => {
      const date = `<t:${Math.floor(s.createdAt.getTime() / 1000)}:d>`;
      return `${i + 1}. **${s.bossName}** — ${s.participantCount} مشارك — ${date}`;
    });

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle("📜 سجل الوحوش المهزومة")
        .setDescription(lines.join("\n"))
        .setTimestamp()],
    });
  }

  if (sub === "mystats") {
    const discordId = interaction.user.id;
    const stats = await db.select()
      .from(worldBossDamageTable)
      .where(eq(worldBossDamageTable.discordId, discordId));

    const totalDamage = stats.reduce((a, b) => a + b.damageDealt, 0);
    const totalAttacks = stats.reduce((a, b) => a + b.attackCount, 0);
    const sessions = stats.length;

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle("📊 إحصائياتك في الوحوش العالمية")
        .addFields(
          { name: "🔥 إجمالي الضرر", value: totalDamage.toLocaleString(), inline: true },
          { name: "⚔️ عدد الهجمات", value: totalAttacks.toString(), inline: true },
          { name: "🌋 معارك شاركت بها", value: sessions.toString(), inline: true },
        )
        .setTimestamp()],
    });
  }
}
