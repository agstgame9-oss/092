import { db, playersTable, playerCharactersTable } from "./db.js";
import {
  achievementsTable,
  playerAchievementsTable,
  playerTitlesTable,
} from "./db.js";
import { eq, and, sql } from "drizzle-orm";
import { EmbedBuilder } from "discord.js";
import { COLORS } from "./embeds.js";
import type { Client } from "discord.js";

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: string;
  requirement: number;
  rewardGold: number;
  rewardGems: number;
  rewardTitle?: string;
  emoji: string;
  isSecret?: boolean;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // Explorer
  { key: "first_steps",      name: "خطواتي الأولى",      category: "مستكشف",  description: "ابدأ أول استكشاف",         requirement: 1,   rewardGold: 200,   rewardGems: 2,  emoji: "👣" },
  { key: "explorer_i",       name: "مستكشف مبتدئ",        category: "مستكشف",  description: "استكشف 10 مرات",           requirement: 10,  rewardGold: 500,   rewardGems: 5,  emoji: "🗺️" },
  { key: "explorer_ii",      name: "مستكشف محترف",        category: "مستكشف",  description: "استكشف 50 مرة",           requirement: 50,  rewardGold: 1500,  rewardGems: 10, emoji: "🧭" },
  { key: "explorer_iii",     name: "سيد الاستكشاف",       category: "مستكشف",  description: "استكشف 200 مرة",          requirement: 200, rewardGold: 5000,  rewardGems: 25, emoji: "🌍", rewardTitle: "سيد الاستكشاف" },
  { key: "floor_10",         name: "صاعد الأبراج",        category: "مستكشف",  description: "بلغ الطابق 10",            requirement: 10,  rewardGold: 800,   rewardGems: 8,  emoji: "🏗️" },
  { key: "floor_50",         name: "ساكن الهاوية",        category: "مستكشف",  description: "بلغ الطابق 50",            requirement: 50,  rewardGold: 3000,  rewardGems: 20, emoji: "🕳️" },
  { key: "floor_100",        name: "سيد البرج",           category: "مستكشف",  description: "بلغ الطابق 100",           requirement: 100, rewardGold: 10000, rewardGems: 50, emoji: "🗼", rewardTitle: "سيد البرج" },
  // Warrior
  { key: "first_blood",      name: "أول دم",              category: "محارب",   description: "افوز بأول قتال PvP",        requirement: 1,   rewardGold: 300,   rewardGems: 3,  emoji: "⚔️" },
  { key: "pvp_warrior",      name: "محارب PvP",           category: "محارب",   description: "افوز بـ10 مبارزات",         requirement: 10,  rewardGold: 1000,  rewardGems: 10, emoji: "🥊" },
  { key: "pvp_champion",     name: "بطل المبارزات",        category: "محارب",   description: "افوز بـ50 مبارزة",          requirement: 50,  rewardGold: 5000,  rewardGems: 30, emoji: "🏆", rewardTitle: "بطل الأبطال" },
  { key: "rating_1500",      name: "نخبة المقاتلين",      category: "محارب",   description: "ابلغ تقييم PvP 1500",       requirement: 1500, rewardGold: 2000, rewardGems: 15, emoji: "💫" },
  { key: "rating_2000",      name: "أسطوري",              category: "محارب",   description: "ابلغ تقييم PvP 2000",       requirement: 2000, rewardGold: 8000, rewardGems: 40, emoji: "⭐", rewardTitle: "المقاتل الأسطوري", isSecret: true },
  // Collector
  { key: "first_summon",     name: "الاستدعاء الأول",     category: "جامع",    description: "استدعِ أول شخصية",          requirement: 1,   rewardGold: 100,   rewardGems: 1,  emoji: "✨" },
  { key: "collector_10",     name: "بداية المجموعة",      category: "جامع",    description: "امتلك 10 شخصيات",           requirement: 10,  rewardGold: 1000,  rewardGems: 5,  emoji: "📦" },
  { key: "collector_25",     name: "جامع كبير",           category: "جامع",    description: "امتلك 25 شخصية",            requirement: 25,  rewardGold: 3000,  rewardGems: 15, emoji: "🎴" },
  { key: "rarity_s",        name: "صيّاد النادر",         category: "جامع",    description: "احصل على شخصية رتبة S",       requirement: 1,   rewardGold: 1500,  rewardGems: 10, emoji: "⭐" },
  { key: "rarity_sss",      name: "جامع الأساطير",        category: "جامع",    description: "احصل على شخصية رتبة SSS+",    requirement: 1,   rewardGold: 5000,  rewardGems: 30, emoji: "🌟", rewardTitle: "جامع الأساطير", isSecret: true },
  // Dedicated
  { key: "streak_7",         name: "دوام أسبوعي",         category: "مخلص",    description: "سجّل الدخول 7 أيام متتالية", requirement: 7,   rewardGold: 1000,  rewardGems: 7,  emoji: "🔥" },
  { key: "streak_30",        name: "مخلص الشهر",          category: "مخلص",    description: "سجّل الدخول 30 يوماً متتالياً", requirement: 30, rewardGold: 5000, rewardGems: 30, emoji: "💯", rewardTitle: "المخلص الأبدي" },
  // Social
  { key: "guild_join",       name: "جزء من فريق",         category: "اجتماعي", description: "انضم إلى نقابة",            requirement: 1,   rewardGold: 500,   rewardGems: 3,  emoji: "🤝" },
  { key: "guild_lead",       name: "قائد الميدان",        category: "اجتماعي", description: "أسّس نقابة",                 requirement: 1,   rewardGold: 2000,  rewardGems: 10, emoji: "👑" },
  // Rich
  { key: "gold_100k",        name: "جامع الذهب",          category: "ثروة",    description: "اكسب 100,000 ذهب",          requirement: 100000, rewardGold: 0,  rewardGems: 20, emoji: "💰" },
  { key: "gem_500",          name: "بائع الجواهر",        category: "ثروة",    description: "امتلك 500 جوهرة",            requirement: 500, rewardGold: 2000,  rewardGems: 0,  emoji: "💎" },
  // Boss
  { key: "boss_slayer",      name: "قاتل الوحوش",         category: "بوس",     description: "شارك في قتل وحش عالمي",      requirement: 1,   rewardGold: 3000,  rewardGems: 20, emoji: "🌋" },
  { key: "boss_mvp",         name: "أبطال العالم",        category: "بوس",     description: "كن الأعلى ضرراً على وحش عالمي", requirement: 1, rewardGold: 8000, rewardGems: 50, emoji: "🔥", rewardTitle: "قاهر الوحوش", isSecret: true },
];

export async function ensureAchievements(): Promise<void> {
  for (const def of ACHIEVEMENT_DEFS) {
    const existing = await db.select({ id: achievementsTable.id }).from(achievementsTable).where(eq(achievementsTable.key, def.key));
    if (existing.length === 0) {
      await db.insert(achievementsTable).values({
        key: def.key,
        name: def.name,
        description: def.description,
        category: def.category,
        requirement: def.requirement,
        rewardGold: def.rewardGold,
        rewardGems: def.rewardGems,
        rewardTitle: def.rewardTitle ?? null,
        emoji: def.emoji,
        isSecret: def.isSecret ?? false,
      });
    }
  }
}

export async function trackAchievement(
  discordId: string,
  key: string,
  progress: number,
  client?: Client,
  channelId?: string,
): Promise<void> {
  const [ach] = await db.select().from(achievementsTable).where(eq(achievementsTable.key, key));
  if (!ach) return;

  const [existing] = await db.select().from(playerAchievementsTable)
    .where(and(eq(playerAchievementsTable.discordId, discordId), eq(playerAchievementsTable.achievementKey, key)));

  if (existing?.isCompleted) return;

  const newProgress = progress;

  if (!existing) {
    await db.insert(playerAchievementsTable).values({
      discordId,
      achievementKey: key,
      progress: newProgress,
      isCompleted: newProgress >= ach.requirement,
      completedAt: newProgress >= ach.requirement ? new Date() : null,
      rewardClaimed: false,
    });
  } else {
    await db.update(playerAchievementsTable)
      .set({
        progress: newProgress,
        isCompleted: newProgress >= ach.requirement,
        completedAt: newProgress >= ach.requirement ? new Date() : null,
      })
      .where(eq(playerAchievementsTable.id, existing.id));
  }

  if (newProgress >= ach.requirement && !existing?.isCompleted) {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) return;

    await db.update(playersTable).set({
      gold: player.gold + ach.rewardGold,
      gems: player.gems + ach.rewardGems,
      updatedAt: new Date(),
    }).where(eq(playersTable.discordId, discordId));

    await db.update(playerAchievementsTable).set({ rewardClaimed: true })
      .where(and(eq(playerAchievementsTable.discordId, discordId), eq(playerAchievementsTable.achievementKey, key)));

    if (ach.rewardTitle) {
      await db.insert(playerTitlesTable).values({
        discordId,
        title: ach.rewardTitle,
        statBonus: "{}",
        isActive: false,
        challengeable: false,
      }).onConflictDoNothing();
    }

    if (client && channelId) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(COLORS.gold ?? 0xFFD700)
            .setTitle(`${ach.emoji} إنجاز جديد مفتوح!`)
            .setDescription(`<@${discordId}> حقق إنجاز **${ach.name}**!\n> ${ach.description}`)
            .addFields(
              { name: "💰 مكافأة ذهب", value: ach.rewardGold > 0 ? `+${ach.rewardGold.toLocaleString()}` : "—", inline: true },
              { name: "💎 مكافأة جواهر", value: ach.rewardGems > 0 ? `+${ach.rewardGems}` : "—", inline: true },
              ach.rewardTitle ? { name: "🎭 لقب جديد", value: ach.rewardTitle, inline: true } : { name: "\u200b", value: "\u200b", inline: true },
            )
            .setTimestamp();
          await (channel as import("discord.js").TextChannel).send({ embeds: [embed] });
        }
      } catch { /* non-critical */ }
    }
  }
}

export async function trackAchievementByValue(
  discordId: string,
  key: string,
  absoluteValue: number,
  client?: Client,
  channelId?: string,
): Promise<void> {
  return trackAchievement(discordId, key, absoluteValue, client, channelId);
}
