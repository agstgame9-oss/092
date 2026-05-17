import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db, playersTable } from "../../lib/db.js";
import { eq } from "drizzle-orm";
import { COLORS, errorEmbed, successEmbed } from "../../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("notify")
  .setDescription("🔔 إدارة الإشعارات الشخصية من البوت")
  .addSubcommand((s) => s.setName("on").setDescription("تفعيل إشعارات DM (المكافأة اليومية، الطاقة الممتلئة، الحملات)"))
  .addSubcommand((s) => s.setName("off").setDescription("إيقاف إشعارات DM"))
  .addSubcommand((s) => s.setName("status").setDescription("عرض حالة الإشعارات الحالية"))
  .addSubcommand((s) => s.setName("test").setDescription("إرسال إشعار تجريبي لتأكيد أن DM يعمل"));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });

  if (sub === "status") {
    const status = player.notificationsEnabled ? "🟢 **مفعّل**" : "🔴 **موقوف**";
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(player.notificationsEnabled ? COLORS.success : COLORS.warning)
        .setTitle("🔔 حالة الإشعارات")
        .setDescription(`الإشعارات عبر DM: ${status}`)
        .addFields(
          { name: "ما الذي تتضمنه الإشعارات؟", value: [
            "• 🎁 تذكير المكافأة اليومية (كل 23 ساعة)",
            "• ⚡ تنبيه الطاقة الممتلئة",
            "• 📦 اكتمال الحملات",
            "• 🌋 إطلاق الوحش العالمي",
          ].join("\n"), inline: false },
        )
        .setTimestamp()],
    });
  }

  if (sub === "on") {
    if (player.notificationsEnabled) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription("الإشعارات مفعّلة بالفعل!")] });
    }
    try {
      await interaction.user.send({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.success)
          .setTitle("✅ تم تفعيل الإشعارات!")
          .setDescription("سيرسل لك البوت DM عند:\n• موعد مكافأتك اليومية\n• امتلاء طاقتك\n• انتهاء حملاتك\n• إطلاق وحش عالمي!")],
      });
    } catch {
      return interaction.editReply({
        embeds: [errorEmbed("لا يمكن إرسال DM إليك! تأكد من أن الخصوصية تسمح برسائل من السيرفرات المشتركة.")],
      });
    }
    await db.update(playersTable).set({ notificationsEnabled: true, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    return interaction.editReply({ embeds: [successEmbed("✅ تم تفعيل الإشعارات! ستصلك تذكيرات مفيدة عبر DM.")] });
  }

  if (sub === "off") {
    await db.update(playersTable).set({ notificationsEnabled: false, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    return interaction.editReply({ embeds: [successEmbed("🔕 تم إيقاف الإشعارات. لن تتلقى DM من البوت.")] });
  }

  if (sub === "test") {
    if (!player.notificationsEnabled) {
      return interaction.editReply({ embeds: [errorEmbed("الإشعارات موقوفة! فعّلها أولاً بـ `/notify on`")] });
    }
    try {
      await interaction.user.send({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.primary)
          .setTitle("🔔 إشعار تجريبي")
          .setDescription("هذا إشعار تجريبي للتأكد من أن البوت يمكنه الوصول إليك.\nستصلك الإشعارات الحقيقية تلقائياً!")
          .setTimestamp()],
      });
      return interaction.editReply({ embeds: [successEmbed("✅ تم إرسال الإشعار التجريبي! تحقق من DM.")] });
    } catch {
      return interaction.editReply({ embeds: [errorEmbed("فشل إرسال DM! تأكد من إعدادات الخصوصية.")] });
    }
  }
}
