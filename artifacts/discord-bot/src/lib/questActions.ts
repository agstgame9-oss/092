import {
  ChatInputCommandInteraction, ButtonInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { db } from "./db.js";
import { playerQuestsTable, playersTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { COLORS, errorEmbed, successEmbed } from "./embeds.js";
import { addXP } from "./gameEngine.js";

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function prepare(i: AnyInteraction) {
  if (!i.deferred && !i.replied) {
    if (i.isButton()) await i.deferUpdate();
    else await (i as ChatInputCommandInteraction).deferReply();
  }
}

// ── تعريفات المهام الثابتة ─────────────────────────────────────────────────

interface QuestDef {
  key: string;
  name: string;
  desc: string;
  type: "daily" | "weekly";
  goal: number;
  rewardGold: number;
  rewardGems: number;
  rewardXp: number;
}

const DAILY_QUESTS: QuestDef[] = [
  { key: "daily_login",    name: "📅 تسجيل الدخول اليومي",  desc: "استلم مكافأتك اليومية",          type: "daily", goal: 1,  rewardGold: 200,  rewardGems: 2,  rewardXp: 50  },
  { key: "daily_explore3", name: "🗺️ المستكشف",              desc: "أكمل 3 مهام استكشاف",             type: "daily", goal: 3,  rewardGold: 300,  rewardGems: 5,  rewardXp: 200 },
  { key: "daily_summon1",  name: "💎 سحبة الغاتشا",           desc: "قم بأي استدعاء",                  type: "daily", goal: 1,  rewardGold: 100,  rewardGems: 3,  rewardXp: 100 },
  { key: "daily_pvpwin1",  name: "⚔️ الدم الأول",             desc: "فز في معركة PvP واحدة",           type: "daily", goal: 1,  rewardGold: 400,  rewardGems: 5,  rewardXp: 250 },
];

const WEEKLY_QUESTS: QuestDef[] = [
  { key: "weekly_explore20", name: "🏔️ غواص الزنازين",       desc: "أكمل 20 مهمة استكشاف",          type: "weekly", goal: 20, rewardGold: 2000, rewardGems: 30, rewardXp: 1000 },
  { key: "weekly_pvp5",      name: "🏆 البطل",                desc: "فز في 5 معارك PvP",              type: "weekly", goal: 5,  rewardGold: 1500, rewardGems: 20, rewardXp: 800  },
  { key: "weekly_summon3",   name: "💎 المُجمِّع",             desc: "قم بـ 3 استدعاءات",              type: "weekly", goal: 3,  rewardGold: 500,  rewardGems: 15, rewardXp: 300  },
  { key: "weekly_boss1",     name: "👹 قاتل الزعماء",          desc: "هزم زعيم طابق في الاستكشاف",    type: "weekly", goal: 1,  rewardGold: 3000, rewardGems: 40, rewardXp: 1500 },
];

const ALL_QUESTS = [...DAILY_QUESTS, ...WEEKLY_QUESTS];

function getDayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getDayEnd(): Date {
  const d = getDayStart();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function getWeekEnd(): Date {
  const d = getWeekStart();
  d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

// ── توليد المهام للاعب ────────────────────────────────────────────────────────

export async function generatePlayerQuests(discordId: string): Promise<void> {
  const dayStart = getDayStart();
  const weekStart = getWeekStart();

  const existing = await db.select().from(playerQuestsTable)
    .where(and(eq(playerQuestsTable.discordId, discordId), gte(playerQuestsTable.createdAt, weekStart)));

  const existingKeys = new Set(existing.map(q => q.questKey));

  const toInsert: typeof playerQuestsTable.$inferInsert[] = [];
  for (const q of DAILY_QUESTS) {
    if (!existingKeys.has(q.key)) {
      toInsert.push({
        discordId, questKey: q.key, questType: "daily",
        progress: 0, goal: q.goal,
        rewardGold: q.rewardGold, rewardGems: q.rewardGems, rewardXp: q.rewardXp,
        expiresAt: getDayEnd(),
      });
    }
  }
  for (const q of WEEKLY_QUESTS) {
    if (!existingKeys.has(q.key)) {
      toInsert.push({
        discordId, questKey: q.key, questType: "weekly",
        progress: 0, goal: q.goal,
        rewardGold: q.rewardGold, rewardGems: q.rewardGems, rewardXp: q.rewardXp,
        expiresAt: getWeekEnd(),
      });
    }
  }

  if (toInsert.length > 0) {
    await db.insert(playerQuestsTable).values(toInsert);
  }
}

// ── تحديث تقدم المهام ──────────────────────────────────────────────────────────

export async function incrementQuestProgress(discordId: string, questKey: string, amount = 1): Promise<void> {
  try {
    const dayStart = getDayStart();
    const weekStart = getWeekStart();

    const isDailyKey = questKey.startsWith("daily_");
    const periodStart = isDailyKey ? dayStart : weekStart;

    const [quest] = await db.select().from(playerQuestsTable)
      .where(and(
        eq(playerQuestsTable.discordId, discordId),
        eq(playerQuestsTable.questKey, questKey),
        gte(playerQuestsTable.createdAt, periodStart),
      ));

    if (!quest || quest.isCompleted) return;

    const newProgress = Math.min(quest.goal, quest.progress + amount);
    const isCompleted = newProgress >= quest.goal;

    await db.update(playerQuestsTable).set({
      progress: newProgress,
      isCompleted,
      updatedAt: new Date(),
    }).where(eq(playerQuestsTable.id, quest.id));
  } catch {
    // غير حرج، لا يوقف التنفيذ
  }
}

// ── أزرار المهام ──────────────────────────────────────────────────────────────

export function questsNavRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("quests:view").setLabel("📝 مهامي").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("quests:claim_all").setLabel("🎁 استلام الكل").setStyle(ButtonStyle.Success),
  );
}

// ── عرض المهام ────────────────────────────────────────────────────────────────

export async function actionQuestView(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")], components: [] });

  await generatePlayerQuests(interaction.user.id);

  const dayStart = getDayStart();
  const weekStart = getWeekStart();

  const allQuests = await db.select().from(playerQuestsTable)
    .where(and(eq(playerQuestsTable.discordId, interaction.user.id), gte(playerQuestsTable.createdAt, weekStart)));

  const daily = allQuests.filter(q => q.questType === "daily" && q.createdAt >= dayStart);
  const weekly = allQuests.filter(q => q.questType === "weekly" && q.createdAt >= weekStart);

  function renderQuest(q: typeof allQuests[0], def: QuestDef) {
    const filled = Math.round((q.progress / q.goal) * 8);
    const bar = "█".repeat(filled) + "░".repeat(8 - filled);
    const status = q.isClaimed ? "✅" : q.isCompleted ? "🎁 **استلم!**" : `${q.progress}/${q.goal}`;
    const reward = `💰${def.rewardGold} 💎${def.rewardGems} ✨${def.rewardXp}`;
    return `**${def.name}** — ${def.desc}\n\`${bar}\` ${status} | ${reward}`;
  }

  const dailyLines = daily.map(q => {
    const def = DAILY_QUESTS.find(d => d.key === q.questKey);
    return def ? renderQuest(q, def) : null;
  }).filter(Boolean) as string[];

  const weeklyLines = weekly.map(q => {
    const def = WEEKLY_QUESTS.find(d => d.key === q.questKey);
    return def ? renderQuest(q, def) : null;
  }).filter(Boolean) as string[];

  const hasClaims = allQuests.some(q => q.isCompleted && !q.isClaimed);

  const embed = new EmbedBuilder()
    .setColor(hasClaims ? COLORS.success : COLORS.primary)
    .setTitle("📝 مهامك")
    .addFields(
      { name: "📅 المهام اليومية", value: dailyLines.join("\n\n") || "جارٍ التوليد...", inline: false },
      { name: "📆 المهام الأسبوعية", value: weeklyLines.join("\n\n") || "جارٍ التوليد...", inline: false },
    )
    .setFooter({ text: "المهام اليومية تتجدد عند منتصف الليل UTC • المهام الأسبوعية تتجدد يوم الأحد" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [questsNavRow()] });
}

// ── استلام جميع المهام المكتملة ───────────────────────────────────────────────

export async function actionQuestClaimAll(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")], components: [] });

  const weekStart = getWeekStart();
  const claimable = await db.select().from(playerQuestsTable)
    .where(and(
      eq(playerQuestsTable.discordId, interaction.user.id),
      eq(playerQuestsTable.isCompleted, true),
      eq(playerQuestsTable.isClaimed, false),
      gte(playerQuestsTable.createdAt, weekStart),
    ));

  if (!claimable.length) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription("لا توجد مهام مكتملة للاستلام! واصل اللعب للتقدم.")],
      components: [questsNavRow()],
    });
  }

  let totalGold = 0, totalGems = 0, totalXp = 0;
  const claimedNames: string[] = [];

  for (const q of claimable) {
    const def = ALL_QUESTS.find(d => d.key === q.questKey);
    if (!def) continue;
    totalGold += q.rewardGold;
    totalGems += q.rewardGems;
    totalXp += q.rewardXp;
    claimedNames.push(def.name);
    await db.update(playerQuestsTable).set({ isClaimed: true, updatedAt: new Date() }).where(eq(playerQuestsTable.id, q.id));
  }

  await db.update(playersTable).set({ gold: player.gold + totalGold, gems: player.gems + totalGems, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
  if (totalXp > 0) await addXP(player.id, totalXp);

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle("🎁 تم استلام المهام!")
    .setDescription(`تم استلام **${claimedNames.length}** مهمة:\n${claimedNames.join("، ")}`)
    .addFields(
      { name: "💰 الذهب", value: `+${totalGold.toLocaleString()}`, inline: true },
      { name: "💎 الجواهر", value: `+${totalGems}`, inline: true },
      { name: "✨ الخبرة", value: `+${totalXp.toLocaleString()}`, inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [questsNavRow()] });
}
