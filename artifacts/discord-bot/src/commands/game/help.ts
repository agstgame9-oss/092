import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { COLORS } from "../../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("📖 تعلّم كيف تلعب في ساحة الكون الأنمي");

export async function execute(interaction: ChatInputCommandInteraction) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:daily").setLabel("🎁 يومي").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:summon_free").setLabel("💎 استدعاء مجاني").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:profile").setLabel("👤 ملفي").setStyle(ButtonStyle.Secondary),
  );

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("📖 ساحة الكون الأنمي — دليل اللعب الكامل")
    .setDescription(
      "مرحباً بك في **AMA** — لعبة RPG استدعاء على ديسكورد!\n" +
      "استدعِ الأبطال، ابنِ فريقك، استكشف الطوابق، وقاتل اللاعبين الآخرين."
    )
    .addFields(
      {
        name: "🚀 البداية",
        value: [
          "**1.** `/start` — سجّل وأحصل على **20 💎** + **1,000 🪙**",
          "**2.** `/summon free` — استدعاء مجاني يومي للبداية",
          "**3.** `/party set 1` — ضع الشخصية في فريقك",
          "**4.** `/explore` — قاتل أعداء الطوابق للخبرة والذهب",
          "**5.** `/daily` — **+500🪙 +10💎 +60⚡** كل 24 ساعة",
          "**6.** `/weekly` — **+2,000🪙 +30💎 +120⚡** كل 7 أيام",
        ].join("\n"),
      },
      {
        name: "💎 نظام الاستدعاء",
        value: [
          "`/summon single` — سحبة واحدة بـ **10 💎**",
          "`/summon ten` — 10 سحبات بـ **90 💎** (ضمان S+ في السحبة 10)",
          "`/summon free` — سحبة مجانية كل **24 ساعة**",
          "",
          "**نسب الندرة:** ⬛D(40%) 🟩C(25%) 🟦B(15%) 🟪A(10%) 🟨S(6%) 🟧SS(2.5%) 🟥SSS(1%) 💎SSS+(0.5%)",
        ].join("\n"),
      },
      {
        name: "⚔️ نظام الاستكشاف",
        value: [
          "`/explore` — قاتل عدو الطابق (**-10 ⚡**، فترة انتظار 30 ثانية)",
          "فوز → تقدّم للطابق التالي + **خبرة** + **ذهب** + تقدم المهام",
          "خسارة → خبرة بسيطة وتبقى في نفس الطابق",
          "⚡ الطاقة تعود **+1 كل 6 دقائق** تلقائياً",
        ].join("\n"),
      },
      {
        name: "🥊 PvP (التحدي)",
        value: [
          "`/challenge @مستخدم` — قاتل لاعباً آخر في معركة PvP",
          "فوز → **+25 تقييم** | خسارة → **-20 تقييم** | فترة انتظار 5 دقائق",
        ].join("\n"),
      },
      {
        name: "🎯 الشخصيات والفريق",
        value: [
          "`/characters view` — عرض مجموعتك",
          "`/characters info <رقم>` — تفاصيل شخصية (مهاراتها، إحصائياتها، قيمة بيعها)",
          "`/characters lock <رقم>` — 🔒 قفل/فتح شخصية (حماية من البيع)",
          "`/characters sell <رقم>` — 💰 بيع شخصية مقابل الذهب",
          "`/party set/remove/clear` — إدارة الفريق (حد أقصى 3 شخصيات)",
          "`/use <رقم>` — استخدام عنصر استهلاكي من مخزونك",
        ].join("\n"),
      },
      {
        name: "🏪 المتجر والتجارة",
        value: [
          "`/shop view` — تصفّح العناصر (جرعات طاقة، جواهر، ذهب...)",
          "`/shop buy <رقم> [كمية]` — اشترِ 1-20 قطعة دفعة واحدة",
          "`/inventory` — عرض مخزونك الكامل",
          "`/trade offer @لاعب` — عرض تبادل (ذهب/شخصيات)",
          "`/trade list/accept/decline` — إدارة عروض التبادل",
        ].join("\n"),
      },
      {
        name: "📜 المهام والمكافآت",
        value: [
          "`/quests` — مهام يومية وأسبوعية (الاستكشاف، PvP، الاستدعاء، تسجيل الدخول)",
          "`/bounty` — مهام القتل اليومية لمكافآت إضافية",
          "`/daily` — 🎁 مكافأة يومية (+500🪙 +10💎 +60⚡)",
          "`/weekly` — 🗓️ مكافأة أسبوعية (+2,000🪙 +30💎 +120⚡)",
        ].join("\n"),
      },
      {
        name: "🏰 الزنازين والبعثات",
        value: [
          "`/dungeon` — ادخل الزنازين اليومية لمكافآت كبيرة",
          "`/expedition` — أرسل شخصياتك في بعثات سلبية (لا تحتاج لحضورك)",
          "`/zones` — اعرض خريطة الطوابق والمناطق",
        ].join("\n"),
      },
      {
        name: "🏰 نظام النقابات",
        value: [
          "`/guild create <اسم> <رمز>` — أنشئ نقابة (5,000 🪙)",
          "`/guild join <اسم>` | `/guild leave` — الانضمام والمغادرة",
          "`/guild donate <مبلغ>` — تبرّع بذهب للخزينة",
          "`/guild kick/promote/demote @لاعب` — إدارة الأعضاء",
          "`/guild transfer @لاعب` — نقل القيادة | `/guild disband` — حلّ النقابة",
          "`/guild toggle` — فتح/إغلاق النقابة لطلبات الانضمام",
        ].join("\n"),
      },
      {
        name: "🏆 التورنمنت والأحداث",
        value: [
          "`/tournament` — المشاركة في بطولات اللاعبين",
          "`/event` — أحداث الخادم (مضاعفة الذهب، الزعماء...)",
          "`/leaderboard` — لوحات الصدارة (PvP، المستوى، الذهب، الضرر)",
        ].join("\n"),
      },
      {
        name: "💡 نصائح المحترفين",
        value: [
          "• **الشخصية الأولى في الفريق** هي قائدك في الاستكشاف والـ PvP",
          "• الندرة SSS+ لها حتى **14 ضعف** نقاط صحة الندرة D",
          "• اجمع **10 شظايا** لسحبة مجانية في الزنازين",
          "• اقفل 🔒 شخصياتك المفضلة حتى لا تبيعها بالخطأ",
          "• استخدم `/shop buy 1 5` لشراء 5 جرعات طاقة دفعة واحدة",
        ].join("\n"),
      },
    )
    .setFooter({ text: "ساحة الكون الأنمي • استمتع باللعب!" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row] });
}
