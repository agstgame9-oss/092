import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db, playersTable, battlesTable } from "../../lib/db.js";
import { eq, desc, gte, and } from "drizzle-orm";
import { COLORS, errorEmbed } from "../../lib/embeds.js";

function getSeasonInfo() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  const day = startOfWeek.getUTCDay();
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - day);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 7);

  const weekNum = Math.ceil((now.getTime() - new Date("2024-01-01").getTime()) / (7 * 24 * 3600 * 1000));
  return { weekNum, startOfWeek, endOfWeek };
}

function getRankTier(rating: number): { tier: string; color: number } {
  if (rating >= 2200) return { tier: "💫 SSS الخارق", color: 0xFFD700 };
  if (rating >= 2000) return { tier: "⭐ SS ماسي",    color: 0xB9F2FF };
  if (rating >= 1800) return { tier: "🔷 S ماستر",    color: 0x3498DB };
  if (rating >= 1600) return { tier: "💎 A بلاتيني",   color: 0x9B59B6 };
  if (rating >= 1400) return { tier: "🥇 B ذهبي",     color: 0xF39C12 };
  if (rating >= 1200) return { tier: "🥈 C فضي",      color: 0x95A5A6 };
  if (rating >= 1000) return { tier: "🥉 D برونزي",    color: 0xCD6133 };
  return { tier: "⚫ E حديدي", color: 0x2C3E50 };
}

export const data = new SlashCommandBuilder()
  .setName("season")
  .setDescription("📊 موسم PvP الأسبوعي — ترتيب المتنافسين والمكافآت")
  .addSubcommand((s) => s.setName("standings").setDescription("ترتيب الموسم الحالي"))
  .addSubcommand((s) => s.setName("myrank").setDescription("تقييمك وترتيبك الحالي"))
  .addSubcommand((s) => s.setName("prizes").setDescription("مكافآت نهاية الموسم"));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const discordId = interaction.user.id;
  const { weekNum, startOfWeek, endOfWeek } = getSeasonInfo();

  if (sub === "prizes") {
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle("🏆 مكافآت نهاية موسم PvP")
      .setDescription(`الموسم الحالي: **الأسبوع #${weekNum}**\nينتهي: <t:${Math.floor(endOfWeek.getTime() / 1000)}:R>`)
      .addFields(
        { name: "🥇 المرتبة الأولى", value: "**5,000 💰** + **100 💎** + لقب *أسطورة الموسم*", inline: false },
        { name: "🥈 المرتبة الثانية", value: "**3,000 💰** + **60 💎**", inline: false },
        { name: "🥉 المرتبة الثالثة", value: "**1,500 💰** + **30 💎**", inline: false },
        { name: "🏅 المراتب 4-10", value: "**500 💰** + **10 💎**", inline: false },
        { name: "📋 شروط الأهلية", value: "الحصول على 5 انتصارات أو أكثر خلال الأسبوع", inline: false },
      )
      .setFooter({ text: "تُوزَّع المكافآت تلقائياً في نهاية كل أسبوع (منتصف ليل الأحد UTC)" })
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "standings") {
    const topPlayers = await db.select({
      discordId: playersTable.discordId,
      username: playersTable.username,
      pvpRating: playersTable.pvpRating,
      wins: playersTable.wins,
    })
      .from(playersTable)
      .orderBy(desc(playersTable.pvpRating))
      .limit(15);

    const lines = topPlayers.map((p, i) => {
      const { tier } = getRankTier(p.pvpRating);
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
      const you = p.discordId === discordId ? " ← **أنت**" : "";
      return `${medal} **${p.username}** — ${p.pvpRating} نقطة ${tier}${you}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(`📊 موسم PvP — الأسبوع #${weekNum}`)
      .setDescription(lines.join("\n") || "لا يوجد لاعبون بعد!")
      .setFooter({ text: `ينتهي الموسم: ${endOfWeek.toUTCString()}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "myrank") {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });

    const allPlayers = await db.select({ pvpRating: playersTable.pvpRating })
      .from(playersTable)
      .orderBy(desc(playersTable.pvpRating));

    const rank = allPlayers.findIndex((p) => p.pvpRating <= player.pvpRating) + 1;
    const { tier, color } = getRankTier(player.pvpRating);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`📊 ترتيبك في موسم PvP — الأسبوع #${weekNum}`)
      .addFields(
        { name: "⚔️ التقييم", value: `**${player.pvpRating}** نقطة`, inline: true },
        { name: "🏅 الرتبة", value: tier, inline: true },
        { name: "📍 الترتيب العالمي", value: `#${rank} من ${allPlayers.length}`, inline: true },
        { name: "✅ انتصارات", value: player.wins.toString(), inline: true },
        { name: "❌ هزائم", value: player.losses.toString(), inline: true },
        { name: "🎯 نسبة الفوز", value: player.wins + player.losses > 0 ? `${Math.round(player.wins / (player.wins + player.losses) * 100)}%` : "—", inline: true },
      )
      .setFooter({ text: `ينتهي الموسم: ${endOfWeek.toUTCString()}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
}
