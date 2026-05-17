import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { db, playersTable, playerCharactersTable, charactersTable } from "../../lib/db.js";
import { characterEnhancementsTable } from "../../lib/db.js";
import { eq, and } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, ELEMENT_EMOJI, errorEmbed, successEmbed } from "../../lib/embeds.js";

const MAX_ENHANCE = 15;

const ENHANCE_COSTS: Record<number, { gold: number }> = {
  1:  { gold: 500   },
  2:  { gold: 800   },
  3:  { gold: 1200  },
  4:  { gold: 1800  },
  5:  { gold: 2500  },
  6:  { gold: 3500  },
  7:  { gold: 5000  },
  8:  { gold: 7000  },
  9:  { gold: 10000 },
  10: { gold: 15000 },
  11: { gold: 20000 },
  12: { gold: 28000 },
  13: { gold: 38000 },
  14: { gold: 50000 },
  15: { gold: 70000 },
};

function enhanceStar(level: number): string {
  if (level >= 15) return "⭐⭐⭐ MAX";
  if (level >= 10) return "⭐⭐" + "✦".repeat(level - 10);
  if (level >= 5)  return "⭐" + "✦".repeat(level - 5);
  return "✦".repeat(level);
}

function enhanceBonus(level: number): string {
  const bonus = level * 5;
  return `+${bonus}% جميع الإحصائيات`;
}

export const data = new SlashCommandBuilder()
  .setName("enhance")
  .setDescription("⬆️ تعزيز شخصية لزيادة إحصائياتها")
  .addSubcommand((s) => s.setName("view")
    .setDescription("عرض مستوى تعزيز شخصياتك في الفريق")
  )
  .addSubcommand((s) => s.setName("upgrade")
    .setDescription("ترقية تعزيز شخصية")
    .addIntegerOption((o) => o.setName("slot")
      .setDescription("رقم الفتحة في الفريق (1-3)")
      .setRequired(true).setMinValue(1).setMaxValue(3)
    )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });

  const partyIds = player.activeParty as number[];
  if (!partyIds.length) {
    return interaction.editReply({ embeds: [errorEmbed("فريقك فارغ! أضف شخصيات باستخدام `/party`.")] });
  }

  const partyChars = await db.select({
    pc: playerCharactersTable,
    c: charactersTable,
  }).from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(and(
      eq(playerCharactersTable.playerId, player.id),
      eq(playerCharactersTable.isOnParty, true),
    ));

  if (sub === "view") {
    if (!partyChars.length) {
      return interaction.editReply({ embeds: [errorEmbed("لا توجد شخصيات في الفريق.")] });
    }

    const lines: string[] = [];
    for (let i = 0; i < partyChars.length; i++) {
      const { pc, c } = partyChars[i];
      const [enh] = await db.select().from(characterEnhancementsTable)
        .where(eq(characterEnhancementsTable.playerCharacterId, pc.id));
      const level = enh?.enhanceLevel ?? 0;
      const nextCost = level < MAX_ENHANCE ? ENHANCE_COSTS[level + 1]?.gold ?? 0 : 0;
      lines.push([
        `**فتحة ${i + 1}: ${RARITY_EMOJI[c.rarity] ?? ""} ${c.name}**`,
        `مستوى التعزيز: **+${level}** ${enhanceStar(level)}`,
        `المكافأة الحالية: ${level > 0 ? enhanceBonus(level) : "لا يوجد"}`,
        level < MAX_ENHANCE ? `تكلفة الترقية التالية: **${nextCost.toLocaleString()} 💰**` : "✅ **وصل للحد الأقصى!**",
      ].join("\n"));
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle("⬆️ تعزيز الشخصيات")
      .setDescription(lines.join("\n\n"))
      .setFooter({ text: "استخدم /enhance upgrade [رقم الفتحة] لترقية شخصية" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "upgrade") {
    const slot = interaction.options.getInteger("slot", true) - 1;
    if (slot >= partyChars.length) {
      return interaction.editReply({ embeds: [errorEmbed(`الفتحة ${slot + 1} فارغة!`)] });
    }

    const { pc, c } = partyChars[slot];
    const [enh] = await db.select().from(characterEnhancementsTable)
      .where(eq(characterEnhancementsTable.playerCharacterId, pc.id));
    const currentLevel = enh?.enhanceLevel ?? 0;

    if (currentLevel >= MAX_ENHANCE) {
      return interaction.editReply({ embeds: [errorEmbed(`${c.name} وصل للحد الأقصى +15!`)] });
    }

    const nextLevel = currentLevel + 1;
    const cost = ENHANCE_COSTS[nextLevel].gold;

    if (player.gold < cost) {
      return interaction.editReply({
        embeds: [errorEmbed(`ذهبك قليل! تحتاج **${cost.toLocaleString()} 💰** لتعزيز +${nextLevel}.\nلديك: ${player.gold.toLocaleString()} 💰`)],
      });
    }

    await db.update(playersTable).set({
      gold: player.gold - cost,
      updatedAt: new Date(),
    }).where(eq(playersTable.id, player.id));

    if (!enh) {
      await db.insert(characterEnhancementsTable).values({
        discordId,
        playerCharacterId: pc.id,
        enhanceLevel: 1,
        totalGoldSpent: cost,
        updatedAt: new Date(),
      });
    } else {
      await db.update(characterEnhancementsTable).set({
        enhanceLevel: nextLevel,
        totalGoldSpent: (enh.totalGoldSpent ?? 0) + cost,
        updatedAt: new Date(),
      }).where(eq(characterEnhancementsTable.id, enh.id));
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("✨ تعزيز ناجح!")
      .setDescription(`**${RARITY_EMOJI[c.rarity] ?? ""} ${c.name}** تمت ترقيته إلى **+${nextLevel}** ${enhanceStar(nextLevel)}!`)
      .addFields(
        { name: "💰 ذهب منفق", value: `-${cost.toLocaleString()}`, inline: true },
        { name: "📈 مكافأة الإحصائيات", value: enhanceBonus(nextLevel), inline: true },
        { name: "💰 ذهبك المتبقي", value: (player.gold - cost).toLocaleString(), inline: true },
      )
      .setFooter({ text: nextLevel < MAX_ENHANCE ? `التالي: +${nextLevel + 1} بتكلفة ${ENHANCE_COSTS[nextLevel + 1]?.gold.toLocaleString() ?? "—"} 💰` : "🏆 وصلت للحد الأقصى!" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
}
