import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db, playersTable, playerTitlesTable } from "../../lib/db.js";
import { eq, and } from "drizzle-orm";
import { COLORS, errorEmbed, successEmbed } from "../../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("title")
  .setDescription("🎭 إدارة ألقابك المكتسبة")
  .addSubcommand((s) => s.setName("list").setDescription("عرض جميع ألقابك"))
  .addSubcommand((s) => s.setName("equip")
    .setDescription("تجهيز لقب معين")
    .addIntegerOption((o) => o.setName("number").setDescription("رقم اللقب من القائمة").setRequired(true).setMinValue(1))
  )
  .addSubcommand((s) => s.setName("unequip").setDescription("خلع لقبك الحالي"));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });

  const titles = await db.select().from(playerTitlesTable)
    .where(eq(playerTitlesTable.discordId, discordId))
    .orderBy(playerTitlesTable.earnedAt);

  if (sub === "list") {
    if (!titles.length) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("🎭 ألقابك")
          .setDescription("لا تملك ألقاباً بعد!\nاكسب الألقاب عبر تحقيق الإنجازات أو الفوز بالمبارزات المميزة.")
          .setTimestamp()],
      });
    }

    const lines = titles.map((t, i) => {
      const active = t.title === player.currentTitle ? " ✅ **[مُجهَّز]**" : "";
      const bonus = t.statBonus && t.statBonus !== "{}" ? ` • مكافأة: ${t.statBonus}` : "";
      return `\`${i + 1}\` **${t.title}**${active}${bonus}`;
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle("🎭 مجموعة ألقابك")
      .setDescription(lines.join("\n"))
      .addFields({ name: "اللقب الحالي", value: player.currentTitle ? `**${player.currentTitle}**` : "لا يوجد", inline: true })
      .setFooter({ text: "استخدم /title equip [رقم] لتجهيز لقب" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "equip") {
    const num = interaction.options.getInteger("number", true) - 1;
    if (num < 0 || num >= titles.length) {
      return interaction.editReply({ embeds: [errorEmbed(`رقم غير صحيح! لديك ${titles.length} لقب/ألقاب.`)] });
    }
    const chosen = titles[num];
    let statBonus: Record<string, number> = {};
    try { statBonus = JSON.parse(chosen.statBonus || "{}"); } catch { statBonus = {}; }

    await db.update(playersTable).set({
      currentTitle: chosen.title,
      titleStatBonus: statBonus,
      updatedAt: new Date(),
    }).where(eq(playersTable.id, player.id));

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle("✅ تم تجهيز اللقب!")
        .setDescription(`لقبك الجديد: **${chosen.title}**`)
        .setFooter({ text: "يظهر لقبك في ملفك الشخصي وفي إعلانات المعارك." })
        .setTimestamp()],
    });
  }

  if (sub === "unequip") {
    if (!player.currentTitle) {
      return interaction.editReply({ embeds: [errorEmbed("لا تملك لقباً مجهزاً حالياً!")] });
    }
    const old = player.currentTitle;
    await db.update(playersTable).set({
      currentTitle: null,
      titleStatBonus: null,
      updatedAt: new Date(),
    }).where(eq(playersTable.id, player.id));

    return interaction.editReply({
      embeds: [successEmbed(`تم خلع لقب **${old}** بنجاح.`)],
    });
  }
}
