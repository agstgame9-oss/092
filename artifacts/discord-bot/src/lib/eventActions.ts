import {
  ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { db } from "./db.js";
import { serverEventsTable, eventParticipantsTable, playersTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { COLORS, errorEmbed, successEmbed } from "./embeds.js";
import { isAdmin } from "./adminActions.js";

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function prepare(i: AnyInteraction) {
  if (!i.deferred && !i.replied) {
    if (i.isButton()) await i.deferUpdate();
    else await (i as ChatInputCommandInteraction).deferReply();
  }
}

// ── 30 Event Templates ────────────────────────────────────────────────────────

export const EVENT_TEMPLATES = [
  // XP Events
  { id: "triple_xp",         type: "xp_boost"       as const, name: "⚡ خبرة ثلاثية",             emoji: "⚡", duration: 24, bonus: 3, gold: 0,    gems: 0,  xp: 0,     maxP: 200, desc: "جميع مكاسب الخبرة مضاعفة ثلاث مرات لمدة 24 ساعة! وقت مثالي للتقدم بسرعة." },
  { id: "double_xp",         type: "xp_boost"       as const, name: "✨ خبرة مضاعفة",            emoji: "✨", duration: 48, bonus: 2, gold: 0,    gems: 0,  xp: 0,     maxP: 500, desc: "ضاعف خبرتك لمدة يومين كاملين! فرصة ذهبية لرفع مستواك." },
  { id: "xp_rush",           type: "xp_boost"       as const, name: "🌟 اندفاع الخبرة",           emoji: "🌟", duration: 6,  bonus: 5, gold: 0,    gems: 0,  xp: 1000,  maxP: 100, desc: "5 أضعاف الخبرة لمدة 6 ساعات فقط! سارع قبل انتهاء الوقت." },
  // Gold Events
  { id: "gold_rush",         type: "gold_rush"      as const, name: "💰 موجة الذهب الكبرى",      emoji: "💰", duration: 24, bonus: 2, gold: 5000,  gems: 0,  xp: 0,     maxP: 300, desc: "جميع مكاسب الذهب مضاعفة! استكشف الطوابق وجمع الثروات." },
  { id: "triple_gold",       type: "gold_rush"      as const, name: "🏆 الذهب الثلاثي",           emoji: "🏆", duration: 12, bonus: 3, gold: 10000, gems: 0,  xp: 0,     maxP: 150, desc: "ثلاثة أضعاف الذهب لمدة 12 ساعة! أثرى المستكشفين يفوزون." },
  { id: "treasure_hunt",     type: "gold_rush"      as const, name: "🗺️ صيد الكنوز",              emoji: "🗺️", duration: 24, bonus: 2, gold: 8000,  gems: 5,  xp: 500,   maxP: 100, desc: "كنوز منتشرة في جميع أنحاء العالم! اجمع أكبر قدر ممكن." },
  { id: "fortune_week",      type: "gold_rush"      as const, name: "💫 أسبوع الثروة",            emoji: "💫", duration: 168,bonus: 2, gold: 15000, gems: 10, xp: 2000,  maxP: 500, desc: "أسبوع كامل من مكافآت الذهب المضاعفة والمكافآت الإضافية!" },
  // Summon Events
  { id: "summon_festival",   type: "summon_rate_up" as const, name: "💎 مهرجان الاستدعاء",        emoji: "💎", duration: 48, bonus: 2, gold: 0,    gems: 15, xp: 0,     maxP: 200, desc: "معدلات الاستدعاء مرفوعة لمدة يومين! احظ بشخصيات SSS+ نادرة." },
  { id: "ssr_rate_up",       type: "summon_rate_up" as const, name: "🌈 ارتفاع معدل SSS+",        emoji: "🌈", duration: 24, bonus: 3, gold: 0,    gems: 20, xp: 0,     maxP: 150, desc: "معدل الحصول على SSS+ مضاعف ثلاث مرات! لا تفوت هذه الفرصة." },
  { id: "gacha_night",       type: "summon_rate_up" as const, name: "🎰 ليلة الغاتشا المجنونة",  emoji: "🎰", duration: 12, bonus: 2, gold: 0,    gems: 10, xp: 0,     maxP: 100, desc: "ليلة واحدة حاسمة مع مكافآت الغاتشا المضاعفة! حظ سعيد." },
  // Boss Events
  { id: "boss_rush",         type: "boss_rush"      as const, name: "👹 اندفاع الزعماء",          emoji: "👹", duration: 24, bonus: 2, gold: 3000,  gems: 10, xp: 5000,  maxP: 100, desc: "زعماء أقوياء يظهرون في كل مكان! هزمهم للحصول على مكافآت ضخمة." },
  { id: "world_boss_war",    type: "boss_rush"      as const, name: "⚔️ حرب الزعماء العالميين",   emoji: "⚔️", duration: 48, bonus: 3, gold: 10000, gems: 25, xp: 10000, maxP: 50,  desc: "الزعماء الأسطوريون يتحدون أقوى المحاربين في العالم!" },
  { id: "dungeon_siege",     type: "boss_rush"      as const, name: "🏰 حصار الزنزانة",          emoji: "🏰", duration: 36, bonus: 2, gold: 5000,  gems: 15, xp: 8000,  maxP: 75,  desc: "الزنزانة مليئة بالأعداء! كل طابق يكشف عن زعيم أقوى." },
  { id: "abyss_challenge",   type: "boss_rush"      as const, name: "🌑 تحدي الهاوية",           emoji: "🌑", duration: 24, bonus: 4, gold: 8000,  gems: 20, xp: 15000, maxP: 30,  desc: "زعماء الهاوية الأسطوريون يدعون الأبطال الشجعان للتحدي!" },
  // PvP Events
  { id: "pvp_tourney",       type: "pvp_tournament" as const, name: "⚔️ بطولة العروش",           emoji: "⚔️", duration: 72, bonus: 2, gold: 20000, gems: 50, xp: 5000,  maxP: 32,  desc: "بطولة PvP ضخمة! القاتل الأخير يأخذ العرش والمكافآت الكبرى." },
  { id: "honor_clash",       type: "pvp_tournament" as const, name: "🗡️ صراع الشرف",             emoji: "🗡️", duration: 48, bonus: 2, gold: 10000, gems: 30, xp: 3000,  maxP: 16,  desc: "كل نزال يرفع تقييمك ومكافآتك. الشرف ينتمي للأقوى فقط." },
  { id: "rating_blitz",      type: "pvp_tournament" as const, name: "📊 اندفاع التقييم",         emoji: "📊", duration: 24, bonus: 2, gold: 5000,  gems: 15, xp: 2000,  maxP: 50,  desc: "24 ساعة من النزالات المتواصلة لرفع تقييمك PvP! تحرك بسرعة." },
  // Element Events
  { id: "fire_week",         type: "custom"         as const, name: "🔥 أسبوع النار",             emoji: "🔥", duration: 168,bonus: 2, gold: 3000,  gems: 5,  xp: 3000,  maxP: 300, desc: "شخصيات عنصر النار تكتسب ضعف المكافآت هذا الأسبوع! احشد جيش النار." },
  { id: "water_week",        type: "custom"         as const, name: "🌊 أسبوع الماء",             emoji: "🌊", duration: 168,bonus: 2, gold: 3000,  gems: 5,  xp: 3000,  maxP: 300, desc: "عنصر الماء يتدفق بالقوة المضاعفة هذا الأسبوع! الماء ينتصر دائماً." },
  { id: "lightning_week",    type: "custom"         as const, name: "⚡ أسبوع البرق",             emoji: "⚡", duration: 168,bonus: 2, gold: 3000,  gems: 5,  xp: 3000,  maxP: 300, desc: "البرق يضرب ضعف أسرع هذا الأسبوع! شخصيات البرق في أوج قوتها." },
  { id: "ice_week",          type: "custom"         as const, name: "❄️ أسبوع الجليد",             emoji: "❄️", duration: 168,bonus: 2, gold: 3000,  gems: 5,  xp: 3000,  maxP: 300, desc: "الجليد يجمد المعارك هذا الأسبوع مع مكافآت مضاعفة لعنصره." },
  { id: "dark_chaos",        type: "custom"         as const, name: "🌑 أسبوع الظلام والفوضى",    emoji: "🌑", duration: 168,bonus: 3, gold: 5000,  gems: 8,  xp: 5000,  maxP: 200, desc: "الأسبوع الأكثر إثارة! عنصرا الظلام والفوضى يتحدان لمكافآت خرافية." },
  { id: "light_order",       type: "custom"         as const, name: "☀️ أسبوع النور والنظام",     emoji: "☀️", duration: 168,bonus: 3, gold: 5000,  gems: 8,  xp: 5000,  maxP: 200, desc: "النور والنظام ينيران الطريق مع مكافآت ثلاثية لأبطالهم." },
  // Special Events
  { id: "server_birthday",   type: "custom"         as const, name: "🎊 عيد ميلاد السيرفر",       emoji: "🎊", duration: 24, bonus: 3, gold: 10000, gems: 50, xp: 10000, maxP: 1000,desc: "نحتفل معاً! مكافآت ضخمة لكل من شارك في هذه اللحظة الاستثنائية." },
  { id: "champions_trial",   type: "custom"         as const, name: "👑 تحدي الأبطال",            emoji: "👑", duration: 24, bonus: 4, gold: 15000, gems: 30, xp: 20000, maxP: 50,  desc: "فقط الأقوياء يصمدون أمام هذا التحدي الأسطوري! هل أنت من بينهم؟" },
  { id: "explore_festival",  type: "custom"         as const, name: "🗺️ مهرجان الاستكشاف",       emoji: "🗺️", duration: 48, bonus: 2, gold: 5000,  gems: 10, xp: 8000,  maxP: 200, desc: "الاستكشاف يمنحك ضعف المكافآت! اجتح الطوابق واستكشف كل زاوية." },
  { id: "midnight_fever",    type: "custom"         as const, name: "🌙 حمى منتصف الليل",         emoji: "🌙", duration: 8,  bonus: 5, gold: 2000,  gems: 5,  xp: 2000,  maxP: 50,  desc: "8 ساعات من الجنون الليلي! 5 أضعاف المكافآت لمن يستيقظ الآن!" },
  { id: "rainbow_event",     type: "custom"         as const, name: "🌈 حدث قوس قزح",            emoji: "🌈", duration: 24, bonus: 2, gold: 5000,  gems: 15, xp: 5000,  maxP: 500, desc: "كل العناصر تتعاون! مكافآت مضاعفة لجميع الأنشطة دون استثناء." },
  { id: "loyalty_week",      type: "custom"         as const, name: "🎖️ أسبوع الولاء",           emoji: "🎖️", duration: 168,bonus: 2, gold: 5000,  gems: 20, xp: 5000,  maxP: 1000,desc: "مكافأة خاصة لكل من يشارك يومياً هذا الأسبوع! الولاء له ثمنه." },
  { id: "guild_war",         type: "pvp_tournament" as const, name: "⚔️ حرب النقابات",           emoji: "⚔️", duration: 72, bonus: 2, gold: 25000, gems: 60, xp: 10000, maxP: 100, desc: "النقابات تتصادم في معركة ضارية! النقابة الفائزة تحصد كل الشهرة." },
  { id: "space_time",        type: "xp_boost"       as const, name: "🌌 شق الزمن والفضاء",        emoji: "🌌", duration: 12, bonus: 4, gold: 3000,  gems: 8,  xp: 5000,  maxP: 75,  desc: "ثغرة في الزمن والفضاء تمنح الجميع مكافآت من أبعاد أخرى!" },
] as const;

type EventTemplate = typeof EVENT_TEMPLATES[number];

const EVENT_STATUS_AR: Record<string, string> = {
  upcoming: "🕐 قادم", active: "🟢 نشط", ended: "✅ منتهي", cancelled: "❌ ملغي",
};

const EVENT_TYPE_AR: Record<string, string> = {
  boss_rush: "👹 اندفاع زعماء", gold_rush: "💰 موجة ذهب", xp_boost: "✨ تعزيز الخبرة",
  summon_rate_up: "💎 رفع معدل الاستدعاء", pvp_tournament: "⚔️ بطولة PvP", custom: "🎪 مخصص",
};

export function eventNavRow(joinId?: number, claimId?: number) {
  const btns = [
    new ButtonBuilder().setCustomId("event:view").setLabel("🎪 الفعاليات").setStyle(ButtonStyle.Primary),
  ];
  if (joinId) btns.push(new ButtonBuilder().setCustomId(`event:join:${joinId}`).setLabel("✅ انضم للفعالية").setStyle(ButtonStyle.Success));
  if (claimId) btns.push(new ButtonBuilder().setCustomId(`event:claim:${claimId}`).setLabel("🎁 استلم المكافأة").setStyle(ButtonStyle.Secondary));
  return new ActionRowBuilder<ButtonBuilder>().addComponents(btns);
}

export function adminEventRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("event:admin:template").setLabel("📋 اختر قالباً").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("event:admin:create").setLabel("✏️ فعالية مخصصة").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("event:admin:start").setLabel("▶️ ابدأ").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("event:admin:end").setLabel("⏹️ أنهِ").setStyle(ButtonStyle.Danger),
  );
}

// ── View Events ───────────────────────────────────────────────────────────────

export async function actionEventView(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const list = await db.select().from(serverEventsTable)
    .where(eq(serverEventsTable.guildServerId, interaction.guildId))
    .orderBy(desc(serverEventsTable.createdAt)).limit(5);

  if (!list.length) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle("🎪 فعاليات السيرفر")
        .setDescription("```\nلا توجد فعاليات حالياً!\n```\n> يمكن للمشرفين إنشاء فعالية جديدة باستخدام الأزرار أدناه.")
        .addFields({ name: "💡 نصيحة", value: "استخدم **قالب الفعالية** لتنشيط فعالية جاهزة بنقرة واحدة!", inline: false })
        .setFooter({ text: "🎪 نظام الفعاليات • أنيمي ملتيفرس أرينا" })],
      components: [adminEventRow()],
    });
  }

  const active = list.find(e => e.status === "active");
  const upcoming = list.find(e => e.status === "upcoming");

  const lines = list.map(ev => {
    const status = EVENT_STATUS_AR[ev.status] ?? "❓";
    const type = EVENT_TYPE_AR[ev.type] ?? "🎪 مخصص";
    const timeStr = ev.endsAt ? `<t:${Math.floor(ev.endsAt.getTime() / 1000)}:R>` : "—";
    const bonusLine = ev.bonusMultiplier > 1 ? `⚡ **${ev.bonusMultiplier}x** مضاعف` : "";
    return `${status} **${ev.name}**\n> ${type} ${bonusLine ? `• ${bonusLine}` : ""}\n> ينتهي: ${timeStr}`;
  });

  const embed = new EmbedBuilder()
    .setColor(active ? COLORS.success : COLORS.info)
    .setTitle("🎪 فعاليات السيرفر")
    .setDescription(lines.join("\n\n"))
    .addFields(
      active
        ? { name: "🟢 الفعالية النشطة", value: `**${active.name}**\n> ${active.description.slice(0, 100)}`, inline: false }
        : upcoming
          ? { name: "🕐 الفعالية القادمة", value: `**${upcoming.name}** — تنتظر البدء`, inline: false }
          : { name: "📭 لا توجد فعالية نشطة", value: "انتظر المشرف لتفعيل فعالية جديدة", inline: false }
    )
    .setFooter({ text: active ? `🟢 ${active.name} نشطة الآن!` : "🎪 لا توجد فعالية نشطة" })
    .setTimestamp();

  const rows: ActionRowBuilder<ButtonBuilder>[] = [eventNavRow(active?.id), adminEventRow()];
  await interaction.editReply({ embeds: [embed], components: rows });
}

// ── Join Event ────────────────────────────────────────────────────────────────

export async function actionEventJoin(interaction: AnyInteraction, eventId?: number): Promise<void> {
  await prepare(interaction);
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً للتسجيل!")], components: [] });
  if (player.isBanned) return void interaction.editReply({ embeds: [errorEmbed("حسابك موقوف.")], components: [] });

  let event;
  if (eventId) {
    const res = await db.select().from(serverEventsTable).where(eq(serverEventsTable.id, eventId));
    event = res[0];
  } else {
    const res = await db.select().from(serverEventsTable)
      .where(and(eq(serverEventsTable.guildServerId, interaction.guildId), eq(serverEventsTable.status, "active"))).limit(1);
    event = res[0];
  }

  if (!event) return void interaction.editReply({ embeds: [errorEmbed("لا توجد فعالية نشطة الآن.")], components: [eventNavRow()] });
  if (event.status !== "active") return void interaction.editReply({ embeds: [errorEmbed(`**${event.name}** غير نشطة حالياً.`)], components: [eventNavRow()] });

  const existing = await db.select().from(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.eventId, event.id), eq(eventParticipantsTable.discordId, interaction.user.id)));
  if (existing.length) return void interaction.editReply({ embeds: [errorEmbed(`أنت مشارك بالفعل في **${event.name}**!`)], components: [eventNavRow(event.id, event.id)] });

  const [cnt] = await db.select({ c: count() }).from(eventParticipantsTable).where(eq(eventParticipantsTable.eventId, event.id));
  if ((cnt?.c ?? 0) >= event.maxParticipants) return void interaction.editReply({ embeds: [errorEmbed(`**${event.name}** امتلأت المقاعد!`)], components: [eventNavRow()] });

  await db.insert(eventParticipantsTable).values({ eventId: event.id, discordId: interaction.user.id, username: player.username });

  const rewardLines: string[] = [];
  if (event.rewardGold > 0) rewardLines.push(`💰 **${event.rewardGold.toLocaleString()}** ذهباً`);
  if (event.rewardGems > 0) rewardLines.push(`💎 **${event.rewardGems}** جواهر`);
  if (event.rewardXp > 0) rewardLines.push(`✨ **${event.rewardXp.toLocaleString()}** خبرة`);

  const bonusLine = event.bonusMultiplier > 1
    ? `\n\n🔥 **تعزيز نشط: ${event.bonusMultiplier}x مضاعف طوال الفعالية!**`
    : "";

  const timeStr = event.endsAt ? `<t:${Math.floor(event.endsAt.getTime() / 1000)}:R>` : "عند إنهاء الفعالية";

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("✅ تم الانضمام للفعالية!")
      .setDescription(`انضممت إلى **${event.name}**!${bonusLine}`)
      .addFields(
        { name: "🎁 المكافآت عند الإتمام", value: rewardLines.length ? rewardLines.join("\n") : "ستعلن قريباً", inline: true },
        { name: "📋 الوصف", value: event.description.slice(0, 200), inline: false },
        { name: "⏱️ ينتهي", value: timeStr, inline: true },
        { name: "👥 المقاعد", value: `${(cnt?.c ?? 0) + 1} / ${event.maxParticipants}`, inline: true },
      )
      .setFooter({ text: "استلم مكافأتك عند انتهاء الفعالية! • أنيمي ملتيفرس أرينا" })
      .setTimestamp()],
    components: [eventNavRow(undefined, event.id)],
  });
}

// ── Claim Reward ──────────────────────────────────────────────────────────────

export async function actionEventClaim(interaction: AnyInteraction, eventId?: number): Promise<void> {
  await prepare(interaction);
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")], components: [] });

  let event;
  if (eventId) {
    const res = await db.select().from(serverEventsTable).where(eq(serverEventsTable.id, eventId));
    event = res[0];
  } else {
    const res = await db.select().from(serverEventsTable)
      .where(and(eq(serverEventsTable.guildServerId, interaction.guildId), eq(serverEventsTable.status, "ended"))).limit(1);
    event = res[0];
  }

  if (!event) return void interaction.editReply({ embeds: [errorEmbed("لا توجد فعالية منتهية يمكن المطالبة بمكافأتها.")], components: [eventNavRow()] });

  const [participation] = await db.select().from(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.eventId, event.id), eq(eventParticipantsTable.discordId, interaction.user.id)));
  if (!participation) return void interaction.editReply({ embeds: [errorEmbed(`لم تشارك في **${event.name}**.`)], components: [eventNavRow()] });
  if (participation.rewardClaimed) return void interaction.editReply({ embeds: [errorEmbed("استلمت مكافأتك بالفعل!")], components: [eventNavRow()] });

  await db.update(eventParticipantsTable).set({ rewardClaimed: true }).where(eq(eventParticipantsTable.id, participation.id));
  const newGold = player.gold + event.rewardGold;
  const newGems = player.gems + event.rewardGems;
  await db.update(playersTable).set({ gold: newGold, gems: newGems, updatedAt: new Date() }).where(eq(playersTable.id, player.id));

  const rewards: string[] = [];
  if (event.rewardGold > 0) rewards.push(`+${event.rewardGold.toLocaleString()} 💰`);
  if (event.rewardGems > 0) rewards.push(`+${event.rewardGems} 💎`);
  if (event.rewardXp > 0) rewards.push(`+${event.rewardXp.toLocaleString()} ✨`);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle("🎁 تم استلام المكافأة!")
      .setDescription(`> **${event.name}** — مكافآت الفعالية استُلمت بنجاح! 🎊`)
      .addFields(
        { name: "🏆 المكافآت", value: rewards.join("  ") || "لا شيء", inline: false },
        { name: "💰 رصيد الذهب الجديد", value: `${newGold.toLocaleString()}`, inline: true },
        { name: "💎 رصيد الجواهر الجديد", value: `${newGems}`, inline: true },
      )
      .setFooter({ text: "شكراً على مشاركتك! • أنيمي ملتيفرس أرينا" })
      .setTimestamp()],
    components: [eventNavRow()],
  });
}

// ── Admin: Show Template Picker ───────────────────────────────────────────────

export async function actionEventTemplatePicker(interaction: ButtonInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) return void interaction.reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true });

  // Build pages of templates (5 per select menu, max 25 options per menu)
  const options = EVENT_TEMPLATES.slice(0, 25).map(t => ({
    label: t.name,
    description: t.desc.slice(0, 100),
    value: t.id,
    emoji: t.emoji,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId("event:template:select")
    .setPlaceholder("اختر نوع الفعالية...")
    .addOptions(options);

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("📋 قوالب الفعاليات — 30 نوعاً")
    .setDescription("اختر من القائمة أدناه لإنشاء فعالية جاهزة بإعدادات مثالية:\n\u200b")
    .addFields(
      { name: "⚡ تعزيز الخبرة", value: "خبرة ثلاثية • خبرة مضاعفة • اندفاع الخبرة • شق الزمن", inline: true },
      { name: "💰 موجة الذهب", value: "موجة الذهب • الذهب الثلاثي • صيد الكنوز • أسبوع الثروة", inline: true },
      { name: "💎 الاستدعاء", value: "مهرجان الاستدعاء • ارتفاع SSS+ • ليلة الغاتشا", inline: true },
      { name: "👹 الزعماء", value: "اندفاع الزعماء • حرب الزعماء • حصار الزنزانة • تحدي الهاوية", inline: true },
      { name: "⚔️ PvP", value: "بطولة العروش • صراع الشرف • اندفاع التقييم • حرب النقابات", inline: true },
      { name: "🌈 مخصصة", value: "أسابيع العناصر • عيد الميلاد • تحدي الأبطال • حدث قوس قزح", inline: true },
    )
    .setFooter({ text: "📋 اختر قالباً لإنشاء الفعالية تلقائياً" });

  await interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    ephemeral: true,
  });
}

// ── Admin: Handle Template Selection ─────────────────────────────────────────

export async function actionEventTemplateSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) return void interaction.reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true });
  await interaction.deferUpdate();

  const templateId = interaction.values[0];
  const template = EVENT_TEMPLATES.find(t => t.id === templateId);
  if (!template) return void interaction.editReply({ embeds: [errorEmbed("قالب غير موجود.")], components: [] });

  const endsAt = new Date(Date.now() + template.duration * 60 * 60 * 1000);

  await db.insert(serverEventsTable).values({
    name: template.name,
    description: template.desc,
    type: template.type,
    guildServerId: interaction.guildId!,
    organizerDiscordId: interaction.user.id,
    rewardGold: template.gold,
    rewardGems: template.gems,
    rewardXp: template.xp,
    bonusMultiplier: template.bonus,
    maxParticipants: template.maxP,
    status: "upcoming",
    endsAt,
    channelId: interaction.channelId ?? null,
  });

  const rewardParts: string[] = [];
  if (template.gold > 0) rewardParts.push(`💰 ${template.gold.toLocaleString()} ذهباً`);
  if (template.gems > 0) rewardParts.push(`💎 ${template.gems} جوهرة`);
  if (template.xp > 0) rewardParts.push(`✨ ${template.xp.toLocaleString()} خبرة`);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle(`${template.emoji} تم إنشاء الفعالية!`)
      .setDescription(`> **${template.name}** جاهزة للتفعيل!`)
      .addFields(
        { name: "📋 الوصف", value: template.desc, inline: false },
        { name: "🎁 المكافآت", value: rewardParts.join(" • ") || "لا شيء", inline: true },
        { name: "⚡ المضاعف", value: `${template.bonus}x`, inline: true },
        { name: "👥 الحد الأقصى", value: `${template.maxP} مشارك`, inline: true },
        { name: "⏱️ المدة", value: `${template.duration} ساعة`, inline: true },
      )
      .setFooter({ text: "اضغط ▶️ ابدأ لتفعيل الفعالية!" })],
    components: [],
  });
}

// ── Admin: Create Custom Event ────────────────────────────────────────────────

export async function openCreateEventModal(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) {
    const reply = interaction.isButton()
      ? () => (interaction as ButtonInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true })
      : () => (interaction as ChatInputCommandInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true });
    return void reply();
  }

  const modal = new ModalBuilder().setCustomId("event:modal:create").setTitle("✏️ إنشاء فعالية مخصصة");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("name").setLabel("اسم الفعالية").setStyle(TextInputStyle.Short).setPlaceholder("🎊 مهرجان السيرفر الكبير").setRequired(true).setMaxLength(80)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("description").setLabel("وصف الفعالية").setStyle(TextInputStyle.Paragraph).setPlaceholder("صف الفعالية للمشاركين...").setRequired(true).setMaxLength(500)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("type").setLabel("النوع: boss_rush | gold_rush | xp_boost | summon_rate_up | custom").setStyle(TextInputStyle.Short).setPlaceholder("gold_rush").setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("rewards").setLabel("المكافآت: ذهب | جواهر | خبرة (مفصولة بمسافات)").setStyle(TextInputStyle.Short).setPlaceholder("5000 20 1000").setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("bonus_max").setLabel("المضاعف | الحد الأقصى للمشاركين").setStyle(TextInputStyle.Short).setPlaceholder("2 | 100").setRequired(false)
    ),
  );
  await (interaction as ButtonInteraction).showModal(modal);
}

// ── Admin: Start Event ────────────────────────────────────────────────────────

export async function actionAdminStartEvent(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) {
    return void (interaction.isButton()
      ? (interaction as ButtonInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true })
      : (interaction as ChatInputCommandInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true }));
  }
  if (!interaction.deferred && !interaction.replied) {
    if (interaction.isButton()) await (interaction as ButtonInteraction).deferReply({ ephemeral: true });
    else await (interaction as ChatInputCommandInteraction).deferReply({ ephemeral: true });
  }

  const [ev] = await db.select().from(serverEventsTable)
    .where(and(eq(serverEventsTable.guildServerId, interaction.guildId!), eq(serverEventsTable.status, "upcoming")))
    .orderBy(desc(serverEventsTable.createdAt)).limit(1);

  if (!ev) return void interaction.editReply({ embeds: [errorEmbed("لا توجد فعاليات قادمة لتفعيلها.")] });

  await db.update(serverEventsTable).set({ status: "active", startsAt: new Date(), updatedAt: new Date() }).where(eq(serverEventsTable.id, ev.id));
  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("🟢 الفعالية نشطة الآن!")
      .setDescription(`> **${ev.name}** بدأت! يمكن للاعبين الانضمام بـ \`/event join\``)
      .addFields(
        { name: "⚡ المضاعف", value: `${ev.bonusMultiplier}x`, inline: true },
        { name: "👥 الحد الأقصى", value: `${ev.maxParticipants}`, inline: true },
      )],
  });
}

// ── Admin: End Event ──────────────────────────────────────────────────────────

export async function actionAdminEndEvent(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) {
    return void (interaction.isButton()
      ? (interaction as ButtonInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true })
      : (interaction as ChatInputCommandInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true }));
  }
  if (!interaction.deferred && !interaction.replied) {
    if (interaction.isButton()) await (interaction as ButtonInteraction).deferReply({ ephemeral: true });
    else await (interaction as ChatInputCommandInteraction).deferReply({ ephemeral: true });
  }

  const [ev] = await db.select().from(serverEventsTable)
    .where(and(eq(serverEventsTable.guildServerId, interaction.guildId!), eq(serverEventsTable.status, "active")))
    .orderBy(desc(serverEventsTable.createdAt)).limit(1);

  if (!ev) return void interaction.editReply({ embeds: [errorEmbed("لا توجد فعاليات نشطة الآن.")] });

  await db.update(serverEventsTable).set({ status: "ended", endsAt: new Date(), updatedAt: new Date() }).where(eq(serverEventsTable.id, ev.id));

  const [cnt] = await db.select({ c: count() }).from(eventParticipantsTable).where(eq(eventParticipantsTable.eventId, ev.id));
  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle("⏹️ انتهت الفعالية!")
      .setDescription(`> **${ev.name}** انتهت!`)
      .addFields(
        { name: "👥 المشاركون", value: `**${cnt?.c ?? 0}** لاعب`, inline: true },
        { name: "📢 التالي", value: "اللاعبون يمكنهم استلام مكافآتهم بـ `/event claim`", inline: false },
      )],
  });
}

// ── Exported: Add Event Score (called from explore/pvp/boss) ─────────────────

export async function addEventScore(
  guildId: string,
  discordId: string,
  username: string,
  points: number,
): Promise<void> {
  try {
    const [event] = await db.select().from(serverEventsTable)
      .where(and(eq(serverEventsTable.guildServerId, guildId), eq(serverEventsTable.status, "active")))
      .limit(1);
    if (!event) return;

    const [participation] = await db.select().from(eventParticipantsTable)
      .where(and(eq(eventParticipantsTable.eventId, event.id), eq(eventParticipantsTable.discordId, discordId)));

    if (participation) {
      const bonus = Math.floor(points * (event.bonusMultiplier - 1));
      await db.update(eventParticipantsTable)
        .set({ score: participation.score + points + bonus })
        .where(eq(eventParticipantsTable.id, participation.id));
    }
  } catch { /* non-critical */ }
}

// ── Scores: Live Leaderboard ──────────────────────────────────────────────────

export async function actionEventScores(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const [activeEvent] = await db.select().from(serverEventsTable)
    .where(and(eq(serverEventsTable.guildServerId, interaction.guildId), eq(serverEventsTable.status, "active")))
    .orderBy(desc(serverEventsTable.createdAt)).limit(1);

  const [endedEvent] = !activeEvent
    ? await db.select().from(serverEventsTable)
      .where(and(eq(serverEventsTable.guildServerId, interaction.guildId), eq(serverEventsTable.status, "ended")))
      .orderBy(desc(serverEventsTable.createdAt)).limit(1)
    : [undefined];

  const ev = activeEvent ?? endedEvent;
  if (!ev) {
    return void interaction.editReply({
      embeds: [errorEmbed("لا توجد فعالية نشطة أو منتهية لعرض نتائجها.")],
      components: [eventNavRow()],
    });
  }

  const participants = await db.select().from(eventParticipantsTable)
    .where(eq(eventParticipantsTable.eventId, ev.id))
    .orderBy(desc(eventParticipantsTable.score));

  const medals = ["🥇", "🥈", "🥉"];
  const maxScore = participants[0]?.score ?? 1;

  const lines = participants.slice(0, 10).map((p, i) => {
    const medal = medals[i] ?? `**${i + 1}.**`;
    const filled = Math.round(Math.min(1, p.score / Math.max(1, maxScore)) * 8);
    const bar = "▓".repeat(filled) + "░".repeat(8 - filled);
    const claimed = p.rewardClaimed ? " ✅" : "";
    return `${medal} **${p.username}**${claimed}\n> ${bar} **${p.score.toLocaleString()}** نقطة`;
  });

  const prizeMultipliers = [1.0, 0.6, 0.3];
  const prizes: string[] = [];
  for (let i = 0; i < Math.min(3, participants.length); i++) {
    const p = participants[i];
    const gold = Math.floor(ev.rewardGold * (prizeMultipliers[i] ?? 0.1));
    const gems = Math.floor(ev.rewardGems * (prizeMultipliers[i] ?? 0.1));
    const xp = Math.floor(ev.rewardXp * (prizeMultipliers[i] ?? 0.1));
    const parts: string[] = [];
    if (gold > 0) parts.push(`💰 ${gold.toLocaleString()}`);
    if (gems > 0) parts.push(`💎 ${gems}`);
    if (xp > 0) parts.push(`✨ ${xp.toLocaleString()}`);
    prizes.push(`${medals[i]} **${p.username}**: ${parts.join(" + ") || "—"}`);
  }

  const timeStr = ev.endsAt ? `<t:${Math.floor(ev.endsAt.getTime() / 1000)}:R>` : "—";

  const embed = new EmbedBuilder()
    .setColor(ev.status === "ended" ? COLORS.gold : COLORS.success)
    .setTitle(`🏆 ${ev.status === "ended" ? "النتائج النهائية" : "قائمة المتصدرين"} — ${ev.name}`)
    .setDescription(lines.length ? lines.join("\n\n") : "لا يوجد مشاركون بعد!")
    .addFields(
      { name: "👥 المشاركون", value: `${participants.length} لاعب`, inline: true },
      { name: "⏱️ " + (ev.status === "ended" ? "انتهت" : "ينتهي"), value: timeStr, inline: true },
      { name: "⚡ مضاعف الفعالية", value: `${ev.bonusMultiplier}x`, inline: true },
    );

  if (prizes.length) {
    embed.addFields({ name: "🎁 توزيع الجوائز (حسب الترتيب)", value: prizes.join("\n"), inline: false });
  }

  embed.addFields({
    name: "📈 كيف تكسب نقاطاً؟",
    value: "⚔️ الاستكشاف | 🏆 معارك PvP | 👹 هزيمة الزعماء | 🎯 إتمام المهام",
    inline: false,
  });

  embed.setFooter({ text: ev.status === "ended" ? "🏆 انتهت الفعالية — شكراً للمشاركة!" : "🟢 الفعالية نشطة الآن — العب أكثر لتتصدر!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [eventNavRow(), adminEventRow()] });
}

// ── Modal Submit ──────────────────────────────────────────────────────────────

export async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) return void interaction.reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true });
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.fields.getTextInputValue("name").trim();
  const description = interaction.fields.getTextInputValue("description").trim();
  const typeRaw = interaction.fields.getTextInputValue("type").trim().toLowerCase();
  const rewardsRaw = interaction.fields.getTextInputValue("rewards").trim();
  const bonusMaxRaw = interaction.fields.getTextInputValue("bonus_max").trim();

  const validTypes = ["boss_rush", "gold_rush", "xp_boost", "summon_rate_up", "pvp_tournament", "custom"] as const;
  type EventType = typeof validTypes[number];
  const type: EventType = (validTypes as readonly string[]).includes(typeRaw) ? typeRaw as EventType : "custom";

  const rewardParts = rewardsRaw ? rewardsRaw.split(/\s+/).map(n => parseInt(n, 10) || 0) : [0, 0, 0];
  const rewardGold = rewardParts[0] ?? 0;
  const rewardGems = rewardParts[1] ?? 0;
  const rewardXp = rewardParts[2] ?? 0;

  const bonusMaxParts = bonusMaxRaw ? bonusMaxRaw.split("|").map(p => parseInt(p.trim(), 10) || 0) : [1, 50];
  const bonusMultiplier = Math.max(1, bonusMaxParts[0] ?? 1);
  const maxParticipants = Math.max(1, bonusMaxParts[1] ?? 50);

  await db.insert(serverEventsTable).values({
    name, description, type, guildServerId: interaction.guildId!, organizerDiscordId: interaction.user.id,
    rewardGold, rewardGems, rewardXp, bonusMultiplier, maxParticipants, status: "upcoming",
    channelId: interaction.channelId ?? null,
  });

  const rewardLine: string[] = [];
  if (rewardGold > 0) rewardLine.push(`💰 ${rewardGold.toLocaleString()}`);
  if (rewardGems > 0) rewardLine.push(`💎 ${rewardGems}`);
  if (rewardXp > 0) rewardLine.push(`✨ ${rewardXp.toLocaleString()}`);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("✅ تم إنشاء الفعالية!")
      .setDescription(`> **${name}** جاهزة — اضغط **▶️ ابدأ** لتفعيلها!`)
      .addFields(
        { name: "🎁 المكافآت", value: rewardLine.join(" • ") || "لا شيء", inline: true },
        { name: "⚡ المضاعف", value: `${bonusMultiplier}x`, inline: true },
        { name: "👥 الحد الأقصى", value: `${maxParticipants}`, inline: true },
      )],
  });
}
