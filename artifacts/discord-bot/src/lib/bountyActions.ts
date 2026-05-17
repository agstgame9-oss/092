import {
  ButtonInteraction, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { db } from "./db.js";
import { playersTable, playerBountiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { COLORS, errorEmbed } from "./embeds.js";
import { addXP } from "./gameEngine.js";
import { BOUNTY_TEMPLATES, getDailyBounties, getBountyTarget, getTodayDate } from "./pveEngine.js";

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function prepare(i: AnyInteraction) {
  if (!i.deferred && !i.replied) {
    i.isButton() ? await i.deferUpdate() : await (i as ChatInputCommandInteraction).deferReply();
  }
}

export function bountyNavRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("bounty:view").setLabel("📜 المطلوبون").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("bounty:claim_all").setLabel("🎁 استلام المكتملة").setStyle(ButtonStyle.Success),
  );
}

// ── Ensure Today's Bounties Exist ─────────────────────────────────────────────

async function ensureDailyBounties(discordId: string, playerId: number): Promise<void> {
  const today = getTodayDate();
  const existing = await db.select().from(playerBountiesTable)
    .where(and(eq(playerBountiesTable.discordId, discordId), eq(playerBountiesTable.bountyDate, today)));

  if (existing.length >= 5) return;

  const templates = getDailyBounties();
  for (let i = 0; i < templates.length; i++) {
    const tpl = templates[i];
    const alreadyExists = existing.find(e => e.bountyKey === tpl.key);
    if (alreadyExists) continue;
    const target = getBountyTarget(tpl, i);
    await db.insert(playerBountiesTable).values({
      playerId,
      discordId,
      bountyKey: tpl.key,
      bountyDate: today,
      targetCount: target,
      currentCount: 0,
      isComplete: false,
      rewardClaimed: false,
      rewardGold: tpl.rewardGold,
      rewardXp: tpl.rewardXp,
      rewardGems: tpl.rewardGems,
    });
  }
}

// ── Progress a Bounty (called from other systems) ─────────────────────────────

export async function progressBounty(discordId: string, bountyKey: string, amount: number = 1): Promise<void> {
  try {
    const today = getTodayDate();
    const [bounty] = await db.select().from(playerBountiesTable)
      .where(and(
        eq(playerBountiesTable.discordId, discordId),
        eq(playerBountiesTable.bountyKey, bountyKey),
        eq(playerBountiesTable.bountyDate, today),
        eq(playerBountiesTable.isComplete, false),
      ));

    if (!bounty) return;

    const newCount = Math.min(bounty.targetCount, bounty.currentCount + amount);
    const isComplete = newCount >= bounty.targetCount;

    await db.update(playerBountiesTable)
      .set({ currentCount: newCount, isComplete, updatedAt: new Date() } as any)
      .where(eq(playerBountiesTable.id, bounty.id));
  } catch { /* non-critical */ }
}

// ── View Bounties ─────────────────────────────────────────────────────────────

export async function actionBountyView(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")], components: [] });

  await ensureDailyBounties(interaction.user.id, player.id);

  const today = getTodayDate();
  const bounties = await db.select().from(playerBountiesTable)
    .where(and(eq(playerBountiesTable.discordId, interaction.user.id), eq(playerBountiesTable.bountyDate, today)));

  const completed = bounties.filter(b => b.isComplete && b.rewardClaimed).length;
  const claimable = bounties.filter(b => b.isComplete && !b.rewardClaimed).length;
  const active = bounties.filter(b => !b.isComplete).length;

  const totalGoldLeft = bounties.filter(b => !b.rewardClaimed).reduce((s, b) => s + b.rewardGold, 0);
  const totalGemsLeft = bounties.filter(b => !b.rewardClaimed).reduce((s, b) => s + b.rewardGems, 0);

  const fields = bounties.map(b => {
    const tpl = BOUNTY_TEMPLATES.find(t => t.key === b.bountyKey);
    if (!tpl) return null;
    const progress = `${b.currentCount}/${b.targetCount}`;
    const bar = buildProgressBar(b.currentCount, b.targetCount);
    const desc = tpl.descTemplate.replace("{count}", b.targetCount.toString());
    const status = b.rewardClaimed ? "✅ مكتملة ومستلمة" : b.isComplete ? "🎁 جاهزة للاستلام!" : `⏳ ${progress}`;
    return {
      name: `${tpl.emoji} ${tpl.name} — ${status}`,
      value: `> **${desc}**\n> ${bar} ${progress}\n> 🎁 ${b.rewardGold > 0 ? `💰${b.rewardGold.toLocaleString()} ` : ""}${b.rewardXp > 0 ? `✨${b.rewardXp.toLocaleString()} ` : ""}${b.rewardGems > 0 ? `💎${b.rewardGems}` : ""}`,
      inline: false,
    };
  }).filter(Boolean) as { name: string; value: string; inline: boolean }[];

  const embed = new EmbedBuilder()
    .setColor(claimable > 0 ? COLORS.success : COLORS.primary)
    .setTitle("📜 لوحة المطلوبين اليومية")
    .setDescription(
      `> مهامك اليومية تتجدد كل يوم عند منتصف الليل!\n> ✅ ${completed} مكتملة | 🎁 ${claimable} للاستلام | ⏳ ${active} جارية\n> 💰 ${totalGoldLeft.toLocaleString()} ذهب + 💎${totalGemsLeft} جواهر متبقية`
    )
    .addFields(...fields)
    .setFooter({ text: `🔄 تتجدد يومياً | اليوم: ${today}` })
    .setTimestamp();

  const rows: ActionRowBuilder<ButtonBuilder>[] = [bountyNavRow()];
  if (claimable > 0) {
    rows.unshift(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("bounty:claim_all").setLabel(`🎁 استلام ${claimable} مهمة مكتملة`).setStyle(ButtonStyle.Success),
    ));
  }

  await interaction.editReply({ embeds: [embed], components: rows });
}

// ── Claim All Completed Bounties ──────────────────────────────────────────────

export async function actionBountyClaimAll(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const today = getTodayDate();
  const claimable = await db.select().from(playerBountiesTable)
    .where(and(
      eq(playerBountiesTable.discordId, interaction.user.id),
      eq(playerBountiesTable.bountyDate, today),
      eq(playerBountiesTable.isComplete, true),
      eq(playerBountiesTable.rewardClaimed, false),
    ));

  if (!claimable.length) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning).setTitle("📜 لا مهام مكتملة").setDescription("لم تكمل أي مهمة بعد! تقدم في اللعبة لإنجاز مهامك.")],
      components: [bountyNavRow()],
    });
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return;

  let totalGold = 0, totalXp = 0, totalGems = 0;
  for (const b of claimable) {
    totalGold += b.rewardGold;
    totalXp += b.rewardXp;
    totalGems += b.rewardGems;
    await db.update(playerBountiesTable).set({ rewardClaimed: true, updatedAt: new Date() } as any).where(eq(playerBountiesTable.id, b.id));
  }

  await db.update(playersTable).set({
    gold: player.gold + totalGold,
    gems: player.gems + totalGems,
    updatedAt: new Date(),
  }).where(eq(playersTable.id, player.id));

  const xpResult = await addXP(player.id, totalXp);

  const claimedNames = claimable.map(b => {
    const tpl = BOUNTY_TEMPLATES.find(t => t.key === b.bountyKey);
    return `${tpl?.emoji ?? "📜"} ${tpl?.name ?? b.bountyKey}`;
  }).join("\n");

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`🎉 استُلمت ${claimable.length} مهمة!`)
    .setDescription(`> أنجزت مهامك اليومية وحصلت على مكافآتك!\n\n${claimedNames}`)
    .addFields(
      { name: "💰 الذهب", value: `+${totalGold.toLocaleString()}`, inline: true },
      { name: "✨ الخبرة", value: `+${totalXp.toLocaleString()}${xpResult?.leveled ? ` 🎉 المستوى ${xpResult.newLevel}!` : ""}`, inline: true },
      { name: "💎 الجواهر", value: `+${totalGems}`, inline: true },
    )
    .setFooter({ text: "📜 المهام تتجدد كل يوم — استمر في اللعب!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [bountyNavRow()] });
}

function buildProgressBar(current: number, total: number, len = 10): string {
  const filled = Math.min(len, Math.max(0, Math.round((current / Math.max(1, total)) * len)));
  return "▓".repeat(filled) + "░".repeat(len - filled);
}
