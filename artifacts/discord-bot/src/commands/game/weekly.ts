import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { db, playersTable } from "../../lib/db.js";
import { eq } from "drizzle-orm";
import { COLORS, errorEmbed } from "../../lib/embeds.js";
import { addXP, applyStaminaRegen } from "../../lib/gameEngine.js";

const WEEKLY_GOLD    = 2000;
const WEEKLY_GEMS    = 30;
const WEEKLY_STAMINA = 120;
const WEEKLY_XP      = 3000;

const weeklyRow = () =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:daily").setLabel("🎁 يومي").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("quests:view").setLabel("📝 المهام").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:summon_single").setLabel("💎 استدعاء").setStyle(ButtonStyle.Secondary),
  );

export const data = new SlashCommandBuilder()
  .setName("weekly")
  .setDescription("🗓️ استلم مكافأتك الأسبوعية الكبرى!");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const discordId = interaction.user.id;

  let [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });
  if (player.isBanned) return interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")] });

  const now = new Date();

  if (player.weeklyLastClaimed) {
    const daysSince = (now.getTime() - player.weeklyLastClaimed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      const nextClaim = new Date(player.weeklyLastClaimed.getTime() + 7 * 24 * 60 * 60 * 1000);
      const remaining = Math.ceil((nextClaim.getTime() - now.getTime()) / 1000);
      const d = Math.floor(remaining / 86400);
      const h = Math.floor((remaining % 86400) / 3600);
      const m = Math.floor((remaining % 3600) / 60);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("⏰ تم الاستلام بالفعل!")
          .setDescription(`عُد بعد **${d} يوم و ${h} ساعة و ${m} دقيقة** للمكافأة الأسبوعية التالية.`)
          .setFooter({ text: "المكافأة الأسبوعية تتجدد كل 7 أيام" })],
        components: [weeklyRow()],
      });
    }
  }

  player = await applyStaminaRegen(player);

  const newGold    = player.gold + WEEKLY_GOLD;
  const newGems    = player.gems + WEEKLY_GEMS;
  const newStamina = Math.min(player.maxStamina, player.stamina + WEEKLY_STAMINA);

  await db.update(playersTable).set({
    gold: newGold,
    gems: newGems,
    stamina: newStamina,
    staminaLastRegen: now,
    weeklyLastClaimed: now,
    updatedAt: now,
  }).where(eq(playersTable.id, player.id));

  const xpResult = await addXP(player.id, WEEKLY_XP);

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle("🗓️ تم استلام المكافأة الأسبوعية!")
    .setDescription("استمرارك في اللعب هذا الأسبوع له ثمنه!")
    .addFields(
      { name: "💰 الذهب", value: `+${WEEKLY_GOLD.toLocaleString()} ← ${newGold.toLocaleString()}`, inline: true },
      { name: "💎 الجواهر", value: `+${WEEKLY_GEMS} ← ${newGems}`, inline: true },
      { name: "⚡ الطاقة", value: `+${WEEKLY_STAMINA} ← ${newStamina}/${player.maxStamina}`, inline: true },
      { name: "✨ الخبرة", value: `+${WEEKLY_XP.toLocaleString()}${xpResult?.leveled ? ` 🎉 المستوى ${xpResult.newLevel}!` : ""}`, inline: true },
    )
    .setFooter({ text: "عُد الأسبوع القادم للمزيد! المكافأة اليومية متاحة كل 24 ساعة." })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed], components: [weeklyRow()] });
}
