import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db, playersTable, playerCharactersTable, charactersTable, guildMembersTable, guildsTable } from "../../lib/db.js";
import { eq } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, ELEMENT_EMOJI, errorEmbed } from "../../lib/embeds.js";
import { applyStaminaRegen } from "../../lib/gameEngine.js";

function bar(cur: number, max: number, len = 10): string {
  const safe = Math.max(1, max);
  const filled = Math.min(len, Math.max(0, Math.round((cur / safe) * len)));
  return "█".repeat(filled) + "░".repeat(len - filled);
}

export const data = new SlashCommandBuilder()
  .setName("dashboard")
  .setDescription("📊 عرض ملخص سريع لحسابك");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  let [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });
  if (player.isBanned) return interaction.editReply({ embeds: [errorEmbed(`⛔ محظور. السبب: ${player.banReason ?? "غير محدد"}`)] });

  player = await applyStaminaRegen(player);

  const [guildData] = await db
    .select({ guild: guildsTable })
    .from(guildMembersTable)
    .innerJoin(guildsTable, eq(guildMembersTable.guildId, guildsTable.id))
    .where(eq(guildMembersTable.discordId, player.discordId))
    .catch(() => []);

  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  const party = chars.filter(c => c.pc.isOnParty);
  const rarityOrder = ["SSS+", "SSS", "SS", "S", "A", "B", "C", "D"];
  chars.sort((a, b) => rarityOrder.indexOf(a.char.rarity) - rarityOrder.indexOf(b.char.rarity));

  const rarityCounts: Record<string, number> = {};
  for (const c of chars) {
    rarityCounts[c.char.rarity] = (rarityCounts[c.char.rarity] ?? 0) + 1;
  }

  const winRate = player.wins + player.losses > 0
    ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
    : "0.0";

  const partyLines = party.length > 0
    ? party.map(c =>
        `${RARITY_EMOJI[c.char.rarity]} **${c.char.name}** — ${ELEMENT_EMOJI[c.char.element1]}${c.char.element1} | مستوى ${c.pc.level} | ❤️${(c.char.baseHp * c.pc.level).toLocaleString()} ⚔️${c.char.baseAtk * c.pc.level}`
      ).join("\n")
    : "*لا يوجد فريق — استخدم `/party set <رقم>`*";

  const rarityLine = rarityOrder
    .filter(r => rarityCounts[r])
    .map(r => `${RARITY_EMOJI[r]}${rarityCounts[r]}`)
    .join(" ");

  const topChars = chars.slice(0, 3).map(c =>
    `${RARITY_EMOJI[c.char.rarity]} ${c.char.name} (${c.char.animeSource})`
  ).join("\n") || "لا يوجد شخصيات بعد";

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`📊 لوحة ${player.username}`)
    .setDescription(
      guildData?.guild
        ? `**الجيلد:** ${guildData.guild.emblem} [${guildData.guild.tag}] ${guildData.guild.name}`
        : "*لا يوجد جيلد — استخدم `/guild create` أو `/guild join`*"
    )
    .addFields(
      {
        name: "🎖️ الحساب",
        value: [
          `**المستوى:** ${player.level} — XP: ${player.xp.toLocaleString()} / ${player.xpToNext.toLocaleString()}`,
          `${bar(player.xp, player.xpToNext, 12)}`,
          `**الطابق:** ${player.currentFloor} | **تقييم PvP:** ${player.pvpRating} ⚔️`,
          `**الانتصارات/الهزائم:** ${player.wins}ف / ${player.losses}خ (${winRate}% نسبة الفوز)`,
          `**إجمالي الضرر:** ${player.totalDamageDealt.toLocaleString()}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "💰 الاقتصاد",
        value: [
          `🪙 **الذهب:** ${player.gold.toLocaleString()}`,
          `💎 **الجواهر:** ${player.gems}`,
          `⚡ **الطاقة:** ${player.stamina}/${player.maxStamina}`,
          `${bar(player.stamina, player.maxStamina, 10)} *(+1/6 دقائق)*`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "📦 المجموعة",
        value: [
          `**مجموع الشخصيات:** ${chars.length}`,
          rarityLine || "لا يوجد بعد",
          "",
          `**أفضل 3:**\n${topChars}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "🎯 الفريق النشط",
        value: partyLines,
        inline: false,
      },
    )
    .setFooter({ text: `استخدم /help لجميع الأوامر • مستكشف الطابق ${player.currentFloor}` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:summon_free").setLabel("💎 استدعاء").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:daily").setLabel("🎁 يومي").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:characters").setLabel("📦 الشخصيات").setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}
