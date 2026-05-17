import {
  ButtonInteraction, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuInteraction,
} from "discord.js";
import { db } from "./db.js";
import { playersTable, playerCharactersTable, charactersTable, expeditionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, errorEmbed, successEmbed } from "./embeds.js";
import { addXP } from "./gameEngine.js";
import {
  MISSION_TYPES, EXPEDITION_DIFFICULTIES, calcExpeditionRewards,
  type MissionType, type ExpeditionDifficulty,
} from "./pveEngine.js";
import { progressBounty } from "./bountyActions.js";

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function prepare(i: AnyInteraction) {
  if (!i.deferred && !i.replied) {
    i.isButton() ? await i.deferUpdate() : await (i as ChatInputCommandInteraction).deferReply();
  }
}

export function expeditionNavRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("expedition:view").setLabel("⛺ البعثات").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("expedition:start_menu").setLabel("🚀 بعثة جديدة").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("expedition:claim_all").setLabel("🎁 استلام").setStyle(ButtonStyle.Secondary),
  );
}

// ── View Active Expeditions ───────────────────────────────────────────────────

export async function actionExpeditionView(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")], components: [] });

  const expeditions = await db.select().from(expeditionsTable)
    .where(and(eq(expeditionsTable.discordId, interaction.user.id), eq(expeditionsTable.isClaimed, false)))
    .orderBy(desc(expeditionsTable.createdAt))
    .limit(10);

  const now = new Date();

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("⛺ البعثات الخاصة بك")
    .setDescription("> ابعت شخصياتك في مهمات وعودوا بالغنائم تلقائياً!\n> كل بعثة لها وقت معين، والجوائز تنتظرك عند انتهائها.")
    .setTimestamp();

  if (!expeditions.length) {
    embed.addFields({ name: "📭 لا توجد بعثات نشطة", value: "> ابدأ بعثة جديدة بالضغط على **بعثة جديدة** أدناه!", inline: false });
  } else {
    for (const exp of expeditions) {
      const mission = MISSION_TYPES.find(m => m.id === exp.missionType);
      const diff = EXPEDITION_DIFFICULTIES.find(d => d.id === exp.difficulty);
      const completesAt = new Date(exp.completesAt);
      const isReady = completesAt <= now;
      const timeLeft = completesAt.getTime() - now.getTime();
      const hoursLeft = Math.floor(timeLeft / 3_600_000);
      const minutesLeft = Math.floor((timeLeft % 3_600_000) / 60_000);

      const status = isReady
        ? "✅ **جاهزة للاستلام!**"
        : `⏱️ ${hoursLeft > 0 ? `${hoursLeft}س ` : ""}${minutesLeft}د متبقية`;

      const rewards = exp.rewards;
      const rewardStr = rewards
        ? `💰${rewards.gold.toLocaleString()} | ✨${rewards.xp.toLocaleString()} | 🌟×${rewards.fragments}`
        : "...";

      embed.addFields({
        name: `${mission?.emoji ?? "⛺"} ${mission?.name ?? exp.missionType} — ${diff?.emoji ?? ""} ${diff?.name ?? exp.difficulty}`,
        value: `> ${status}\n> 🎁 الجوائز: ${rewardStr}`,
        inline: false,
      });
    }
  }

  const hasReady = expeditions.some(e => new Date(e.completesAt) <= now);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [expeditionNavRow()];
  if (hasReady) {
    rows.unshift(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("expedition:claim_all").setLabel("🎁 استلام البعثات الجاهزة").setStyle(ButtonStyle.Success),
    ));
  }

  await interaction.editReply({ embeds: [embed], components: rows });
}

// ── Start Expedition Menu ─────────────────────────────────────────────────────

export async function actionExpeditionStartMenu(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")], components: [] });

  const activeCount = await db.select().from(expeditionsTable)
    .where(and(eq(expeditionsTable.discordId, interaction.user.id), eq(expeditionsTable.isClaimed, false)));

  if (activeCount.length >= 3) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning)
        .setTitle("⛺ حد البعثات")
        .setDescription("> لا يمكنك إرسال أكثر من **3 بعثات** في نفس الوقت!\n> استلم البعثات المنتهية أولاً.")],
      components: [expeditionNavRow()],
    });
  }

  const missionMenu = new StringSelectMenuBuilder()
    .setCustomId("expedition:select_mission")
    .setPlaceholder("🎯 اختر نوع المهمة")
    .addOptions(MISSION_TYPES.map(m => ({
      label: `${m.emoji} ${m.name}`,
      description: m.description.slice(0, 100),
      value: m.id,
    })));

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("⛺ بعثة جديدة — اختر نوع المهمة")
    .setDescription("> اختر نوع البعثة التي تريد إرسال شخصياتك إليها:")
    .addFields(
      ...MISSION_TYPES.map(m => ({
        name: `${m.emoji} ${m.name}`,
        value: `> ${m.description}`,
        inline: true,
      })),
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(missionMenu),
      expeditionNavRow(),
    ] as any,
  });
}

export async function actionExpeditionSelectMission(interaction: StringSelectMenuInteraction): Promise<void> {
  await interaction.deferUpdate();
  const missionId = interaction.values[0];
  const mission = MISSION_TYPES.find(m => m.id === missionId);
  if (!mission) return;

  const diffMenu = new StringSelectMenuBuilder()
    .setCustomId(`expedition:select_diff:${missionId}`)
    .setPlaceholder("⚡ اختر صعوبة البعثة")
    .addOptions(EXPEDITION_DIFFICULTIES.map(d => ({
      label: `${d.emoji} ${d.name} — ${d.durationMinutes >= 60 ? `${d.durationMinutes / 60}س` : `${d.durationMinutes}د`}`,
      description: `💰${d.goldBase.toLocaleString()} | ✨${d.xpBase.toLocaleString()} | 🌟×${d.fragmentBase} | 🎟️${d.ticketChance}%`,
      value: d.id,
    })));

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`${mission.emoji} ${mission.name} — اختر الصعوبة`)
    .setDescription(`> **${mission.description}**\n> اختر مستوى صعوبة البعثة. كلما كانت أصعب، كانت الجوائز أكبر لكن الوقت أطول!`)
    .addFields(
      ...EXPEDITION_DIFFICULTIES.map(d => ({
        name: `${d.emoji} ${d.name}`,
        value: `⏱️ ${d.durationMinutes >= 60 ? `${d.durationMinutes / 60} ساعة` : `${d.durationMinutes} دقيقة`} | 💰${d.goldBase.toLocaleString()} | ✨${d.xpBase.toLocaleString()} | 🌟×${d.fragmentBase} | 🎟️${d.ticketChance}%`,
        inline: true,
      })),
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(diffMenu) as any, expeditionNavRow()],
  });
}

export async function actionExpeditionSelectDiff(interaction: StringSelectMenuInteraction, missionId: string): Promise<void> {
  await interaction.deferUpdate();
  const diffId = interaction.values[0];
  const diff = EXPEDITION_DIFFICULTIES.find(d => d.id === diffId);
  const mission = MISSION_TYPES.find(m => m.id === missionId);
  if (!diff || !mission) return;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return;

  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  if (!chars.length) return void interaction.editReply({ embeds: [errorEmbed("ليس لديك شخصيات!")], components: [] });

  const partyChars = chars.filter(c => c.pc.isOnParty).slice(0, 3);
  const selectedChars = partyChars.length ? partyChars : chars.slice(0, 3);
  const avgLevel = Math.floor(selectedChars.reduce((s, c) => s + c.pc.level, 0) / selectedChars.length);
  const rewards = calcExpeditionRewards(missionId, diff, avgLevel);

  const now = new Date();
  const completesAt = new Date(now.getTime() + diff.durationMinutes * 60_000);

  await db.insert(expeditionsTable).values({
    playerId: player.id,
    discordId: player.discordId,
    guildServerId: interaction.guildId ?? "dm",
    missionType: missionId,
    difficulty: diffId,
    durationMinutes: diff.durationMinutes,
    characterIds: selectedChars.map(c => c.pc.id),
    startsAt: now,
    completesAt,
    rewards,
    isClaimed: false,
  });

  const charList = selectedChars.map(c => `${RARITY_EMOJI[c.char.rarity]} **${c.char.name}** (المستوى ${c.pc.level})`).join("\n");
  const durationStr = diff.durationMinutes >= 60
    ? `${diff.durationMinutes / 60} ساعة`
    : `${diff.durationMinutes} دقيقة`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`${mission.emoji} تم إرسال البعثة!`)
    .setDescription(`> **${mission.name}** — ${diff.emoji} ${diff.name}\n> شخصياتك في طريقهم الآن! عودوا خلال **${durationStr}**.`)
    .addFields(
      { name: "⚔️ الفريق المُرسل", value: charList, inline: false },
      { name: "🎁 الجوائز المتوقعة", value: `💰${rewards.gold.toLocaleString()} | ✨${rewards.xp.toLocaleString()} | 🌟×${rewards.fragments}${rewards.items.length ? ` | 🎒${rewards.items.join(", ")}` : ""}`, inline: false },
      { name: "⏱️ تعود في", value: `<t:${Math.floor(completesAt.getTime() / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: "💡 يمكنك إرسال حتى 3 بعثات في نفس الوقت!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [expeditionNavRow()] });
}

// ── Claim All Ready Expeditions ───────────────────────────────────────────────

export async function actionExpeditionClaimAll(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const now = new Date();
  const allExpeditions = await db.select().from(expeditionsTable)
    .where(and(eq(expeditionsTable.discordId, interaction.user.id), eq(expeditionsTable.isClaimed, false)));

  const ready = allExpeditions.filter(e => new Date(e.completesAt) <= now);
  if (!ready.length) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning).setTitle("⛺ لا شيء جاهز بعد").setDescription("لا توجد بعثات انتهت بعد! تحقق مجدداً لاحقاً.")],
      components: [expeditionNavRow()],
    });
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return;

  let totalGold = 0, totalXp = 0, totalFragments = 0;
  const itemsList: string[] = [];

  for (const exp of ready) {
    const rewards = exp.rewards;
    if (!rewards) continue;
    totalGold += rewards.gold;
    totalXp += rewards.xp;
    totalFragments += rewards.fragments;
    if (rewards.items) itemsList.push(...rewards.items);
    await db.update(expeditionsTable).set({ isClaimed: true, updatedAt: new Date() } as any).where(eq(expeditionsTable.id, exp.id));
  }

  const newFragments = (player.summonFragments ?? 0) + totalFragments;
  const freePulls    = Math.floor(newFragments / 10);
  const remainFrags  = newFragments % 10;
  const bonusGems    = freePulls * 10;

  await db.update(playersTable).set({
    gold:            player.gold + totalGold,
    gems:            player.gems + bonusGems,
    summonFragments: remainFrags,
    updatedAt:       new Date(),
  }).where(eq(playersTable.id, player.id));

  const xpResult = await addXP(player.id, totalXp);

  for (let i = 0; i < ready.length; i++) {
    await progressBounty(interaction.user.id, "expedition", 1);
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold ?? 0xffd700)
    .setTitle(`🎉 استُلمت ${ready.length} بعثة!`)
    .setDescription("> شخصياتك عادوا بنجاح من مهامهم وأحضروا معهم هذه الغنائم:")
    .addFields(
      { name: "💰 الذهب المكتسب", value: `+${totalGold.toLocaleString()}`, inline: true },
      { name: "✨ الخبرة", value: `+${totalXp.toLocaleString()}${xpResult?.leveled ? ` 🎉 المستوى ${xpResult.newLevel}!` : ""}`, inline: true },
      { name: "🌟 الشظايا", value: `+${totalFragments}${freePulls > 0 ? ` → 💎 +${bonusGems} جوهرة!` : ""}`, inline: true },
    );

  if (itemsList.length) {
    embed.addFields({ name: "🎒 الأيتمز", value: itemsList.join(", "), inline: false });
  }

  embed.setFooter({ text: `⛺ ${ready.length} بعثة مكتملة — أرسل المزيد!` }).setTimestamp();
  await interaction.editReply({ embeds: [embed], components: [expeditionNavRow()] });
}
