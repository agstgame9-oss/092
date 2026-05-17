import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import {
  actionTournamentView,
  actionTournamentJoin,
  actionTournamentBracket,
  actionTournamentFight,
  actionTournamentBets,
  actionTournamentSeasonStats,
  openCreateTournamentModal,
  actionAdminStartTournament,
  actionAdminCancelTournament,
} from "../../lib/tournamentActions.js";
import { isAdmin } from "../../lib/adminActions.js";
import { errorEmbed } from "../../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("tournament")
  .setDescription("البطولات — قاتل، راهن، وأثبت أنك الأفضل!")
  .setDMPermission(false)
  .addSubcommand(sub => sub.setName("view").setDescription("🏆 عرض بطولات السيرفر"))
  .addSubcommand(sub => sub.setName("join").setDescription("✅ الانضمام للبطولة المفتوحة"))
  .addSubcommand(sub => sub.setName("bracket").setDescription("📊 عرض البراكيت الحالي"))
  .addSubcommand(sub => sub.setName("fight").setDescription("⚔️ قاتل خصمك في البطولة الآن!"))
  .addSubcommand(sub => sub.setName("bet").setDescription("💰 عرض الرهانات والمراهنة على المباريات"))
  .addSubcommand(sub => sub.setName("season").setDescription("🏅 إحصائيات موسم البطولات وأبطال السيرفر"))
  .addSubcommand(sub => sub.setName("create").setDescription("(مشرف) إنشاء بطولة جديدة"))
  .addSubcommand(sub => sub.setName("start").setDescription("(مشرف) بدء البطولة في مرحلة التسجيل"))
  .addSubcommand(sub => sub.setName("cancel").setDescription("(مشرف) إلغاء البطولة الحالية"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "view") return actionTournamentView(interaction);
  if (sub === "join") return actionTournamentJoin(interaction);
  if (sub === "bracket") return actionTournamentBracket(interaction);
  if (sub === "fight") return actionTournamentFight(interaction);
  if (sub === "bet") return actionTournamentBets(interaction);
  if (sub === "season") return actionTournamentSeasonStats(interaction);

  const admin = await isAdmin(interaction);
  if (!admin) {
    return interaction.reply({ embeds: [errorEmbed("تحتاج صلاحيات مشرف لهذا الأمر.")], ephemeral: true });
  }

  if (sub === "create") return openCreateTournamentModal(interaction as unknown as import("discord.js").ButtonInteraction);
  if (sub === "start") return actionAdminStartTournament(interaction as unknown as import("discord.js").ButtonInteraction);
  if (sub === "cancel") return actionAdminCancelTournament(interaction as unknown as import("discord.js").ButtonInteraction);
}
