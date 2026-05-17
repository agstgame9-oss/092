import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from "discord.js";
import { db, playersTable, serverConfigTable } from "../../lib/db.js";
import { eq } from "drizzle-orm";
import { errorEmbed, COLORS } from "../../lib/embeds.js";
import { startRow } from "../../lib/buttons.js";

export const data = new SlashCommandBuilder()
  .setName("start")
  .setDescription("ابدأ رحلتك في ساحة الكون الأنمي!");

export async function execute(interaction: ChatInputCommandInteraction) {
  const discordId = interaction.user.id;
  const username = interaction.user.username;
  const guildId = interaction.guildId ?? "global";

  const existing = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (existing.length > 0) {
    return interaction.reply({
      embeds: [errorEmbed("أنت مسجّل بالفعل! استخدم `/profile` لرؤية إحصائياتك.")],
      ephemeral: true,
    });
  }

  await db.insert(playersTable).values({
    discordId,
    username,
    guildId,
    level: 1,
    xp: 0,
    xpToNext: 100,
    gold: 1000,
    gems: 20,
    stamina: 100,
    maxStamina: 100,
    staminaLastRegen: new Date(),
    activeParty: [],
    currentWorld: "ساحة التدريب",
    currentFloor: 0,
    maxAbyssFloor: 0,
    furyMeter: 0,
    wins: 0,
    losses: 0,
    totalDamageDealt: 0,
    pvpRating: 1000,
    worldBossContributions: 0,
    isBanned: false,
    updatedAt: new Date(),
  });

  if (interaction.guildId) {
    try {
      const [config] = await db
        .select()
        .from(serverConfigTable)
        .where(eq(serverConfigTable.guildId, interaction.guildId));

      if (config?.playerRoleId) {
        const member = interaction.member as GuildMember | null;
        if (member && typeof member.roles?.add === "function") {
          await member.roles.add(config.playerRoleId).catch(() => null);
        }
      }
    } catch {
    }
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("⚔️ مرحباً بك في ساحة الكون الأنمي!")
    .setDescription(`أهلاً يا **${username}**! رحلتك تبدأ الآن.\nاستخدم الأزرار أدناه للانطلاق بسرعة!`)
    .addFields(
      { name: "🪙 ذهب البداية", value: "1,000", inline: true },
      { name: "💎 جواهر البداية", value: "20 *(استدعاءان مجانيان!)*", inline: true },
      { name: "⚡ الطاقة", value: "100/100 *(+1 كل 6 دقائق)*", inline: true },
      { name: "📖 كيف تبدأ؟", value: [
        "**1.** 🎁 **استدعاء مجاني** — احصل على شخصيتك الأولى مجاناً",
        "**2.** `/party set 1` — ضع شخصيتك في الفريق",
        "**3.** `/explore` — قاتل الأعداء واكسب الخبرة والذهب",
        "**4.** `/daily` — احصل على المكافأة اليومية (+10💎 +500🪙 +60⚡)",
        "**5.** `/challenge @شخص` — تحدّ اللاعبين الآخرين في PvP",
      ].join("\n") },
    )
    .setFooter({ text: "حظاً موفقاً يا مغامر!" });

  return interaction.reply({ embeds: [embed], components: [startRow()] });
}
