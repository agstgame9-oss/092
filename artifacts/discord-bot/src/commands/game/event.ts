import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import {
  actionEventView,
  actionEventJoin,
  actionEventClaim,
  actionEventScores,
  openCreateEventModal,
  actionAdminStartEvent,
  actionAdminEndEvent,
} from "../../lib/eventActions.js";
import { isAdmin } from "../../lib/adminActions.js";
import { errorEmbed } from "../../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("event")
  .setDescription("الفعاليات — العب مع الناس وفوز بجوائز ضخمة!")
  .setDMPermission(false)
  .addSubcommand(sub => sub.setName("view").setDescription("🎪 عرض فعاليات السيرفر الحالية"))
  .addSubcommand(sub => sub.setName("join").setDescription("✅ الانضمام للفعالية النشطة"))
  .addSubcommand(sub => sub.setName("scores").setDescription("🏆 عرض قائمة المتصدرين في الفعالية الحالية"))
  .addSubcommand(sub => sub.setName("claim").setDescription("🎁 استلام مكافأتك من فعالية منتهية"))
  .addSubcommand(sub => sub.setName("create").setDescription("(مشرف) إنشاء فعالية مخصصة جديدة"))
  .addSubcommand(sub => sub.setName("start").setDescription("(مشرف) تفعيل الفعالية القادمة"))
  .addSubcommand(sub => sub.setName("end").setDescription("(مشرف) إنهاء الفعالية النشطة وتوزيع الجوائز"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "view") return actionEventView(interaction);
  if (sub === "join") return actionEventJoin(interaction);
  if (sub === "claim") return actionEventClaim(interaction);
  if (sub === "scores") return actionEventScores(interaction);

  const admin = await isAdmin(interaction);
  if (!admin) {
    return interaction.reply({ embeds: [errorEmbed("تحتاج صلاحيات مشرف لهذا الأمر.")], ephemeral: true });
  }

  if (sub === "create") return openCreateEventModal(interaction as unknown as import("discord.js").ButtonInteraction);
  if (sub === "start") return actionAdminStartEvent(interaction as unknown as import("discord.js").ButtonInteraction);
  if (sub === "end") return actionAdminEndEvent(interaction as unknown as import("discord.js").ButtonInteraction);
}
