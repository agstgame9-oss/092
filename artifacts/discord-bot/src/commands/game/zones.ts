import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "../../lib/db.js";
import { playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { COLORS, ELEMENT_EMOJI, errorEmbed } from "../../lib/embeds.js";
import { ZONES, getZoneForFloor } from "../../lib/pveEngine.js";

export const data = new SlashCommandBuilder()
  .setName("zones")
  .setDescription("🗺️ خريطة العالم — 10 مناطق تنتظرك!")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")] });

  const currentZone = getZoneForFloor(Math.max(1, player.currentFloor));
  const unlockedZones = ZONES.filter(z => player.currentFloor >= z.unlockFloor);
  const lockedZones = ZONES.filter(z => player.currentFloor < z.unlockFloor);

  const unlockedLines = unlockedZones.map(z => {
    const isCurrent = z.id === currentZone.id;
    const isComplete = player.currentFloor > z.floorEnd;
    const floor = Math.max(z.floorStart, Math.min(z.floorEnd, player.currentFloor));
    const progress = isComplete
      ? `✅ مكتملة (${z.floorStart}–${z.floorEnd})`
      : `📍 الطابق ${floor}/${z.floorEnd}`;
    return `${isCurrent ? "▶️" : "  "} ${z.emoji} **${z.name}** — ${ELEMENT_EMOJI[z.element] ?? ""} ${z.element}\n> ${progress} | 🏆 الزعيم: ${z.bossName}`;
  });

  const lockedLines = lockedZones.slice(0, 3).map(z =>
    `🔒 ${z.emoji} **${z.name}** — يُفتح عند الطابق **${z.unlockFloor}**`
  );

  const nextUnlock = lockedZones[0];

  const embed = new EmbedBuilder()
    .setColor(currentZone.color)
    .setTitle("🗺️ خريطة العالم — أنيمي ملتيفرس أرينا")
    .setDescription(
      `> أنت الآن في **${currentZone.emoji} ${currentZone.name}** — الطابق **${Math.max(1, player.currentFloor)}**\n` +
      `> الزعيم التالي: **${currentZone.bossName}** (${currentZone.bossTitle})`
    )
    .addFields(
      { name: `✅ المناطق المفتوحة (${unlockedZones.length}/${ZONES.length})`, value: unlockedLines.join("\n\n") || "—", inline: false },
    );

  if (lockedLines.length) {
    embed.addFields({ name: "🔒 مناطق قادمة", value: lockedLines.join("\n"), inline: false });
  }

  if (nextUnlock) {
    const floorsLeft = nextUnlock.unlockFloor - player.currentFloor;
    embed.addFields({
      name: "🎯 الهدف التالي",
      value: `> أكمل **${floorsLeft}** طابق لفتح **${nextUnlock.emoji} ${nextUnlock.name}**!`,
      inline: false,
    });
  }

  embed
    .addFields({ name: "⚔️ عدد الطوابق الكلي", value: `200 طابق | 10 مناطق | 10 زعماء عملاقين`, inline: true })
    .setFooter({ text: "💡 استخدم /explore للتقدم في الخريطة" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("explore:start").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("dungeon:view").setLabel("🏰 الزنازين").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("bounty:view").setLabel("📜 المطلوبون").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("expedition:view").setLabel("⛺ البعثات").setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}
