import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { db, bossesTable } from "../../lib/db.js";
import { eq } from "drizzle-orm";
import { isAdmin } from "../../lib/adminActions.js";
import { COLORS, ELEMENT_EMOJI, errorEmbed } from "../../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("spawn")
  .setDescription("استدعِ زعيم غارة في هذه القناة ليقاتله جميع اللاعبين")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const admin = await isAdmin(interaction);
  if (!admin) {
    return interaction.reply({ embeds: [errorEmbed("تحتاج إلى صلاحيات المسؤول أو رتبة الأدمن لاستدعاء الزعماء.")], ephemeral: true });
  }

  const bosses = await db
    .select()
    .from(bossesTable)
    .where(eq(bossesTable.isEnabled, true))
    .limit(25);

  if (!bosses.length) {
    return interaction.reply({ embeds: [errorEmbed("لا يوجد زعماء في قاعدة البيانات. استخدم `/create boss` لإضافتهم!")], ephemeral: true });
  }

  const options = bosses.map(b => {
    const emoji = b.isWorldBoss ? "🌍" : b.tier === "abyss" ? "☠️" : b.tier === "legendary" ? "💎" : "👹";
    return {
      label: b.name.length > 25 ? b.name.slice(0, 24) + "…" : b.name,
      description: `${b.title} | ${b.tier.toUpperCase()} | ❤️ ${b.hp.toLocaleString()} HP`,
      value: String(b.id),
      emoji,
    };
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId("admin:spawn_boss_select")
    .setPlaceholder("🏆 اختر زعيماً لاستدعائه في هذه القناة…")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const embed = new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle("⚔️ استدعاء غارة زعيم")
    .setDescription(
      "اختر زعيماً من القائمة أدناه.\n" +
      "سيظهر **علناً** في **هذه القناة** ويمكن لجميع اللاعبين مهاجمته.\n\n" +
      `📋 **${bosses.length} زعيم متاح**`
    )
    .setFooter({ text: "تنتهي غارات الزعماء بعد 30 دقيقة إن لم يُهزموا." })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
