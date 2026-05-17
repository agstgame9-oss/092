import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { db, playersTable, playerCharactersTable, charactersTable } from "../../lib/db.js";
import { eq, and } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, ELEMENT_EMOJI, errorEmbed, successEmbed } from "../../lib/embeds.js";
import { actionCharacters } from "../../lib/actions.js";
import { charactersRow } from "../../lib/buttons.js";

const SELL_GOLD: Record<string, number> = {
  "D":    50,
  "C":    200,
  "B":    600,
  "A":    2000,
  "S":    7500,
  "SS":   20000,
  "SSS":  70000,
  "SSS+": 200000,
};

export const data = new SlashCommandBuilder()
  .setName("characters")
  .setDescription("📦 عرض وإدارة مجموعة شخصياتك")
  .addSubcommand(sub =>
    sub.setName("view").setDescription("عرض مجموعة شخصياتك")
  )
  .addSubcommand(sub =>
    sub.setName("lock")
      .setDescription("🔒 قفل/فتح شخصية لحمايتها من البيع والتبادل")
      .addIntegerOption(o => o.setName("slot").setDescription("رقم الشخصية من القائمة").setRequired(true).setMinValue(1))
  )
  .addSubcommand(sub =>
    sub.setName("sell")
      .setDescription("💰 بيع شخصية مقابل الذهب")
      .addIntegerOption(o => o.setName("slot").setDescription("رقم الشخصية من القائمة").setRequired(true).setMinValue(1))
  )
  .addSubcommand(sub =>
    sub.setName("info")
      .setDescription("📋 عرض تفاصيل شخصية معينة")
      .addIntegerOption(o => o.setName("slot").setDescription("رقم الشخصية من القائمة").setRequired(true).setMinValue(1))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "view") return actionCharacters(interaction);

  await interaction.deferReply();
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });
  if (player.isBanned) return interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")] });

  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  const rarityOrder = ["SSS+", "SSS", "SS", "S", "A", "B", "C", "D"];
  chars.sort((a, b) => rarityOrder.indexOf(a.char.rarity) - rarityOrder.indexOf(b.char.rarity));

  const slot = interaction.options.getInteger("slot", true);
  const target = chars[slot - 1];
  if (!target) {
    return interaction.editReply({ embeds: [errorEmbed(`رقم غير صالح! لديك ${chars.length} شخصية. استخدم \`/characters view\` للعرض.`)] });
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:characters").setLabel("📦 القائمة").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:party_manage").setLabel("🎯 الفريق").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Secondary),
  );

  // ── INFO ──────────────────────────────────────────────────────────────────
  if (sub === "info") {
    const c = target.char;
    const pc = target.pc;
    const goldValue = SELL_GOLD[c.rarity] ?? 50;
    const skillLines = [c.skill1, c.skill2, c.skill3].map(s => `**${s.name}** — ${s.description}`).join("\n");
    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle(`${RARITY_EMOJI[c.rarity]} ${c.name}`)
      .setDescription(`📺 **${c.animeSource}** | ${ELEMENT_EMOJI[c.element1]}${c.element1}${c.element2 ? ` / ${ELEMENT_EMOJI[c.element2]}${c.element2}` : ""}`)
      .addFields(
        { name: "📊 الإحصائيات", value: `❤️ ${(c.baseHp * pc.level).toLocaleString()} HP\n⚔️ ${c.baseAtk * pc.level} ATK\n🛡️ ${c.baseDef * pc.level} DEF\n💨 ${c.baseSpd} SPD`, inline: true },
        { name: "🎖️ الحالة", value: `المستوى: **${pc.level}**\nالصعود: **${pc.ascension}⭐**\nالنسخ: **×${pc.copies}**\nفي الفريق: ${pc.isOnParty ? "✅" : "❌"}\nمقفول: ${pc.isLocked ? "🔒" : "🔓"}`, inline: true },
        { name: "💰 قيمة البيع", value: `${goldValue.toLocaleString()} 🪙`, inline: true },
        { name: "🌀 المهارات", value: skillLines, inline: false },
      )
      .setFooter({ text: `الندرة: ${c.rarity} | الخانة: #${slot}` })
      .setTimestamp();
    if (c.imageUrl) embed.setThumbnail(c.imageUrl);
    return interaction.editReply({ embeds: [embed], components: [navRow] });
  }

  // ── LOCK / UNLOCK ─────────────────────────────────────────────────────────
  if (sub === "lock") {
    const newLock = !target.pc.isLocked;
    await db.update(playerCharactersTable)
      .set({ isLocked: newLock })
      .where(eq(playerCharactersTable.id, target.pc.id));
    const status = newLock ? "🔒 **قُفلت**" : "🔓 **فُتح قفلها**";
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(newLock ? COLORS.warning : COLORS.success)
        .setTitle(`${RARITY_EMOJI[target.char.rarity]} ${target.char.name} — ${status}`)
        .setDescription(newLock
          ? "الشخصية محمية الآن — لا يمكن بيعها أو تبادلها."
          : "يمكن الآن بيع وتبادل هذه الشخصية.")
        .setFooter({ text: "أعِد تشغيل الأمر لتغيير الحالة" })],
      components: [navRow],
    });
  }

  // ── SELL ──────────────────────────────────────────────────────────────────
  if (sub === "sell") {
    if (target.pc.isLocked) {
      return interaction.editReply({
        embeds: [errorEmbed(`**${target.char.name}** مقفولة 🔒\nاستخدم \`/characters lock ${slot}\` لفتح القفل أولاً.`)],
        components: [navRow],
      });
    }
    if (target.pc.isOnParty) {
      return interaction.editReply({
        embeds: [errorEmbed(`**${target.char.name}** في فريقك حالياً!\nأزلها أولاً بـ \`/party remove ${slot}\`.`)],
        components: [navRow],
      });
    }

    const baseGold = SELL_GOLD[target.char.rarity] ?? 50;
    const hasDuplicates = target.pc.copies > 1;
    // Extra copies sell for 40% of value, first copy for 100%
    const sellGold = hasDuplicates ? Math.floor(baseGold * 0.4) : baseGold;

    if (hasDuplicates) {
      // Sell one duplicate copy
      await db.update(playerCharactersTable)
        .set({ copies: target.pc.copies - 1 })
        .where(eq(playerCharactersTable.id, target.pc.id));
    } else {
      // Sell last copy — remove from collection
      await db.delete(playerCharactersTable).where(eq(playerCharactersTable.id, target.pc.id));
    }

    await db.update(playersTable)
      .set({ gold: player.gold + sellGold, updatedAt: new Date() })
      .where(eq(playersTable.id, player.id));

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.gold)
        .setTitle(`💰 تم البيع: ${RARITY_EMOJI[target.char.rarity]} ${target.char.name}`)
        .setDescription(hasDuplicates
          ? `بعت نسخة إضافية — تبقّى **${target.pc.copies - 1}** نسخة.`
          : "تم بيع الشخصية بالكامل وإزالتها من مجموعتك.")
        .addFields(
          { name: "💰 الذهب المكتسب", value: `+${sellGold.toLocaleString()} 🪙`, inline: true },
          { name: "💼 رصيدك الجديد", value: `${(player.gold + sellGold).toLocaleString()} 🪙`, inline: true },
          ...(hasDuplicates ? [] : [{ name: "ℹ️ ملاحظة", value: "النسخ المضافة تُباع بـ 40% من القيمة", inline: false }]),
        )
        .setFooter({ text: `${target.char.rarity} → ${baseGold.toLocaleString()} 🪙 (نسخة أولى) | ${Math.floor(baseGold * 0.4).toLocaleString()} 🪙 (نسخ إضافية)` })
        .setTimestamp()],
      components: [navRow],
    });
  }
}
