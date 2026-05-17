import {
  db, playersTable, worldBossSessionsTable, worldBossDamageTable, bossesTable,
} from "./db.js";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  type TextChannel, type Client,
} from "discord.js";
import { COLORS, errorEmbed } from "./embeds.js";
import { applyStaminaRegen } from "./gameEngine.js";
import { checkCooldown, setCooldown, formatTime } from "./cooldown.js";
import { trackAchievement } from "./achievementActions.js";

const BOSS_ATTACK_STAMINA = 5;
const BOSS_ATTACK_COOLDOWN_SECS = 10;

function buildBossHpBar(current: number, total: number): string {
  const pct = Math.max(0, current / total);
  const filled = Math.round(pct * 20);
  return "🟥".repeat(filled) + "⬛".repeat(20 - filled);
}

export function worldBossRow(sessionId: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`wb:attack:${sessionId}`).setLabel("⚔️ هجوم!").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`wb:leaderboard:${sessionId}`).setLabel("🏆 الترتيب").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`wb:info:${sessionId}`).setLabel("📊 الإحصائيات").setStyle(ButtonStyle.Secondary),
  );
}

export async function getActiveBossSession(guildServerId: string) {
  const [session] = await db.select()
    .from(worldBossSessionsTable)
    .where(and(
      eq(worldBossSessionsTable.guildServerId, guildServerId),
      eq(worldBossSessionsTable.isDefeated, false),
    ))
    .orderBy(desc(worldBossSessionsTable.createdAt))
    .limit(1);
  return session ?? null;
}

export async function buildBossEmbed(session: typeof worldBossSessionsTable.$inferSelect): Promise<EmbedBuilder> {
  const hpPct = Math.round((session.currentHp / session.totalHp) * 100);
  const endsAt = Math.floor(session.endsAt.getTime() / 1000);

  return new EmbedBuilder()
    .setColor(hpPct > 50 ? 0xE74C3C : hpPct > 20 ? 0xE67E22 : 0x992D22)
    .setTitle(`🌋 وحش عالمي: ${session.bossName}`)
    .setDescription([
      buildBossHpBar(session.currentHp, session.totalHp),
      `❤️ **${session.currentHp.toLocaleString()} / ${session.totalHp.toLocaleString()}** HP (${hpPct}%)`,
    ].join("\n"))
    .addFields(
      { name: "👥 المشاركون", value: `${session.participantCount}`, inline: true },
      { name: "💥 إجمالي الضرر", value: session.totalDamageDealt.toLocaleString(), inline: true },
      { name: "⏳ ينتهي", value: `<t:${endsAt}:R>`, inline: true },
    )
    .setFooter({ text: "⚔️ هجوم بزر هجوم أدناه • كل هجوم يكلف 5 طاقة" })
    .setTimestamp();
}

export async function handleWorldBossAttack(
  interaction: import("discord.js").ButtonInteraction,
  sessionId: number,
  client: Client,
): Promise<void> {
  await interaction.deferUpdate();
  const discordId = interaction.user.id;

  let [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")], components: [] });

  const [session] = await db.select().from(worldBossSessionsTable).where(eq(worldBossSessionsTable.id, sessionId));
  if (!session || session.isDefeated) {
    return void interaction.editReply({ embeds: [errorEmbed("هذا الوحش لم يعد موجوداً!")], components: [] });
  }
  if (new Date() > session.endsAt) {
    return void interaction.editReply({ embeds: [errorEmbed("انتهى وقت معركة الوحش!")], components: [] });
  }

  const cd = await checkCooldown(discordId, `wb_attack_${sessionId}`);
  if (cd > 0) {
    return void interaction.followUp({
      embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription(`⏰ انتظر **${formatTime(cd)}** قبل الهجوم مجدداً!`)],
      ephemeral: true,
    });
  }

  player = await applyStaminaRegen(player);
  if (player.stamina < BOSS_ATTACK_STAMINA) {
    return void interaction.followUp({
      embeds: [errorEmbed(`طاقتك قليلة! تحتاج ${BOSS_ATTACK_STAMINA} طاقة. لديك: ${player.stamina}`)],
      ephemeral: true,
    });
  }

  const baseDmg = player.level * 15 + Math.floor(Math.random() * player.level * 10);
  const damage = Math.max(50, baseDmg);
  const actualDamage = Math.min(damage, session.currentHp);
  const newHp = session.currentHp - actualDamage;
  const isKilled = newHp <= 0;

  await db.update(playersTable).set({
    stamina: player.stamina - BOSS_ATTACK_STAMINA,
    worldBossContributions: player.worldBossContributions + 1,
    updatedAt: new Date(),
  }).where(eq(playersTable.id, player.id));

  const existingDmg = await db.select().from(worldBossDamageTable)
    .where(and(eq(worldBossDamageTable.sessionId, sessionId), eq(worldBossDamageTable.discordId, discordId)));

  if (existingDmg.length === 0) {
    await db.insert(worldBossDamageTable).values({
      sessionId,
      discordId,
      username: interaction.user.username,
      damageDealt: actualDamage,
      attackCount: 1,
      lastAttackAt: new Date(),
    });
    await db.update(worldBossSessionsTable).set({
      participantCount: sql`${worldBossSessionsTable.participantCount} + 1`,
    }).where(eq(worldBossSessionsTable.id, sessionId));
  } else {
    await db.update(worldBossDamageTable).set({
      damageDealt: sql`${worldBossDamageTable.damageDealt} + ${actualDamage}`,
      attackCount: sql`${worldBossDamageTable.attackCount} + 1`,
      lastAttackAt: new Date(),
    }).where(and(eq(worldBossDamageTable.sessionId, sessionId), eq(worldBossDamageTable.discordId, discordId)));
  }

  await db.update(worldBossSessionsTable).set({
    currentHp: Math.max(0, newHp),
    totalDamageDealt: sql`${worldBossSessionsTable.totalDamageDealt} + ${actualDamage}`,
    isDefeated: isKilled,
    lootDistributed: false,
  }).where(eq(worldBossSessionsTable.id, sessionId));

  await setCooldown(discordId, `wb_attack_${sessionId}`, BOSS_ATTACK_COOLDOWN_SECS);

  if (isKilled) {
    await distributeBossLoot(sessionId, client, session.channelId);
    const deadEmbed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle(`💀 تم قتل ${session.bossName}!`)
      .setDescription(`<@${discordId}> أنهى المعركة! الجوائز تُوزَّع...`)
      .setTimestamp();
    return void interaction.editReply({ embeds: [deadEmbed], components: [] });
  }

  const [updatedSession] = await db.select().from(worldBossSessionsTable).where(eq(worldBossSessionsTable.id, sessionId));
  const embed = await buildBossEmbed(updatedSession);
  embed.addFields({ name: "🗡️ هجومك الأخير", value: `ضرر: **${actualDamage.toLocaleString()}** | طاقة متبقية: **${player.stamina - BOSS_ATTACK_STAMINA}**`, inline: false });

  await interaction.editReply({ embeds: [embed], components: [worldBossRow(sessionId)] });
}

async function distributeBossLoot(sessionId: number, client: Client, channelId: string): Promise<void> {
  const damages = await db.select().from(worldBossDamageTable)
    .where(eq(worldBossDamageTable.sessionId, sessionId))
    .orderBy(desc(worldBossDamageTable.damageDealt));

  if (damages.length === 0) return;

  const totalDmg = damages.reduce((a, b) => a + b.damageDealt, 0);
  const BASE_LOOT = 5000;
  const lines: string[] = [];

  for (let i = 0; i < damages.length; i++) {
    const d = damages[i];
    const share = Math.round((d.damageDealt / totalDmg) * BASE_LOOT);
    const bonus = i === 0 ? 2000 : i === 1 ? 1000 : i === 2 ? 500 : 0;
    const totalReward = share + bonus;

    await db.update(playersTable).set({
      gold: sql`${playersTable.gold} + ${totalReward}`,
      gems: sql`${playersTable.gems} + ${i < 3 ? 5 - i * 2 : 1}`,
      updatedAt: new Date(),
    }).where(eq(playersTable.discordId, d.discordId));

    const rank = i + 1;
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
    lines.push(`${medal} <@${d.discordId}> — ${d.damageDealt.toLocaleString()} ضرر — **+${totalReward.toLocaleString()} 💰**`);

    await trackAchievement(d.discordId, "boss_slayer", 1);
    if (i === 0) await trackAchievement(d.discordId, "boss_mvp", 1);
  }

  await db.update(worldBossSessionsTable).set({ lootDistributed: true }).where(eq(worldBossSessionsTable.id, sessionId));

  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("💀 تم هزيمة الوحش! توزيع الجوائز")
      .setDescription(lines.slice(0, 15).join("\n"))
      .setFooter({ text: "استمر في القتال لزيادة حصتك في المعارك القادمة!" })
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch { /* non-critical */ }
}

export async function handleWorldBossLeaderboard(
  interaction: import("discord.js").ButtonInteraction,
  sessionId: number,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const damages = await db.select().from(worldBossDamageTable)
    .where(eq(worldBossDamageTable.sessionId, sessionId))
    .orderBy(desc(worldBossDamageTable.damageDealt))
    .limit(10);

  const lines = damages.map((d, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
    return `${medal} **${d.username}** — ${d.damageDealt.toLocaleString()} ضرر (${d.attackCount} هجمات)`;
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("🏆 ترتيب المعركة")
    .setDescription(lines.length ? lines.join("\n") : "لا أحد هاجم بعد!")
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
