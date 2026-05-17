import {
  ButtonInteraction, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { db } from "./db.js";
import { playersTable, playerCharactersTable, charactersTable, dungeonRunsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { COLORS, ELEMENT_EMOJI, errorEmbed, successEmbed, type ColorResolvable } from "./embeds.js";
import { applyStaminaRegen, resolveRound, pickEnemyMove, getElementMultiplier, addXP } from "./gameEngine.js";
import { exploreBattles } from "./battleState.js";
import { DUNGEON_TEMPLATES, getDailyDungeons, getTodayDate, type DungeonTemplate } from "./pveEngine.js";
import { battleActionsRow } from "./buttons.js";
import { progressBounty } from "./bountyActions.js";

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function prepare(i: AnyInteraction) {
  if (!i.deferred && !i.replied) {
    i.isButton() ? await i.deferUpdate() : await (i as ChatInputCommandInteraction).deferReply();
  }
}

function buildBar(current: number, max: number, len = 10): string {
  const filled = Math.min(len, Math.max(0, Math.round((current / Math.max(1, max)) * len)));
  return "█".repeat(filled) + "░".repeat(len - filled);
}

function difficultyColor(d: string): ColorResolvable {
  return d === "easy" ? COLORS.success : d === "medium" ? COLORS.warning : COLORS.danger;
}

function difficultyLabel(d: string): string {
  return d === "easy" ? "🟢 سهلة" : d === "medium" ? "🟡 متوسطة" : "🔴 صعبة";
}

export function dungeonNavRow(showClaim = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("dungeon:view").setLabel("🏰 الزنازين").setStyle(ButtonStyle.Primary),
    ...(showClaim ? [new ButtonBuilder().setCustomId("dungeon:claim_all").setLabel("🎁 استلام الجوائز").setStyle(ButtonStyle.Success)] : []),
  );
}

// ── View Daily Dungeons ───────────────────────────────────────────────────────

export async function actionDungeonView(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")], components: [] });

  const today = getTodayDate();
  const dailyDungeons = getDailyDungeons();
  const runs = await db.select().from(dungeonRunsTable)
    .where(and(eq(dungeonRunsTable.discordId, interaction.user.id), eq(dungeonRunsTable.dungeonDate, today)));

  const runMap = Object.fromEntries(runs.map(r => [r.dungeonId, r]));
  const hasUnclaimed = runs.some(r => r.isComplete && !r.rewardsClaimed);

  const fields = dailyDungeons.map(d => {
    const run = runMap[d.id];
    const status = !run
      ? `⬜ لم تبدأ | 🧪 ${d.staminaCost} نشاط`
      : run.isComplete && run.rewardsClaimed
        ? "✅ مكتملة ومستلمة"
        : run.isComplete
          ? "🎁 منتهية — استلم جائزتك!"
          : `🔄 جارية — الطابق ${run.floorsCleared}/${d.totalFloors}`;
    return {
      name: `${d.emoji} ${d.name} — ${difficultyLabel(d.difficulty)}`,
      value: [
        `> ${status}`,
        `> 🏆 الجائزة: 💰${d.rewardGold.toLocaleString()} | ✨${d.rewardXp.toLocaleString()} | 🌟×${d.rewardFragments} | 🎟️${d.ticketChance}%`,
      ].join("\n"),
      inline: false,
    };
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("🏰 الزنازين اليومية")
    .setDescription("> ثلاث زنازين تتجدد كل يوم! أكملها لتحصل على جوائز ضخمة.\n> كل زنزانة تحتوي على **طوابق + زعيم نهائي** 👹")
    .addFields(...fields)
    .addFields({ name: "⚡ نشاطك الحالي", value: `${player.stamina}/${player.maxStamina}`, inline: true })
    .setFooter({ text: `🔄 تتجدد يومياً | اليوم: ${today}` })
    .setTimestamp();

  const btns = dailyDungeons.map(d => {
    const run = runMap[d.id];
    const disabled = Boolean(run?.isComplete && run?.rewardsClaimed);
    return new ButtonBuilder()
      .setCustomId(`dungeon:enter:${d.id}`)
      .setLabel(`${d.emoji} ${d.name.slice(0, 15)}`)
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled);
  });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(btns),
  ];
  if (hasUnclaimed) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("dungeon:claim_all").setLabel("🎁 استلام كل الجوائز").setStyle(ButtonStyle.Success),
    ));
  }

  await interaction.editReply({ embeds: [embed], components: rows });
}

// ── Enter Dungeon ─────────────────────────────────────────────────────────────

export async function actionDungeonEnter(interaction: AnyInteraction, dungeonId: string): Promise<void> {
  await prepare(interaction);

  const dungeon = DUNGEON_TEMPLATES.find(d => d.id === dungeonId);
  if (!dungeon) return void interaction.editReply({ embeds: [errorEmbed("زنزانة غير موجودة!")], components: [dungeonNavRow()] });

  let [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")], components: [] });

  player = await applyStaminaRegen(player);

  const today = getTodayDate();
  const [existingRun] = await db.select().from(dungeonRunsTable)
    .where(and(
      eq(dungeonRunsTable.discordId, interaction.user.id),
      eq(dungeonRunsTable.dungeonId, dungeonId),
      eq(dungeonRunsTable.dungeonDate, today),
    ));

  if (existingRun?.isComplete) {
    if (!existingRun.rewardsClaimed) {
      return actionDungeonClaimReward(interaction, existingRun.id, dungeon);
    }
    return void interaction.editReply({ embeds: [errorEmbed("أكملت هذه الزنزانة اليوم بالفعل! عد غداً.")], components: [dungeonNavRow()] });
  }

  const currentFloor = existingRun?.floorsCleared ?? 0;
  if (!existingRun && player.stamina < dungeon.staminaCost) {
    return void interaction.editReply({ embeds: [errorEmbed(`لا يوجد نشاط كافٍ! تحتاج **${dungeon.staminaCost}** نشاط. لديك **${player.stamina}**.`)], components: [dungeonNavRow()] });
  }

  // Get player's lead character
  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  const lead = chars.find(c => c.pc.isOnParty) ?? chars[0];
  if (!lead) return void interaction.editReply({ embeds: [errorEmbed("ليس لديك شخصيات! استخدم `/summon`.")], components: [] });

  // Deduct stamina only on first entry
  if (!existingRun) {
    const [run] = await db.insert(dungeonRunsTable).values({
      playerId: player.id,
      discordId: player.discordId,
      dungeonId,
      dungeonDate: today,
      floorsCleared: 0,
    }).returning();

    await db.update(playersTable)
      .set({ stamina: player.stamina - dungeon.staminaCost, updatedAt: new Date() })
      .where(eq(playersTable.id, player.id));

    await startDungeonFloor(interaction, player, lead, dungeon, currentFloor + 1, run.id);
  } else {
    await startDungeonFloor(interaction, player, lead, dungeon, currentFloor + 1, existingRun.id);
  }
}

async function startDungeonFloor(
  interaction: AnyInteraction,
  player: { id: number; discordId: string },
  lead: { pc: { level: number }; char: { name: string; element1: string; baseHp: number; baseAtk: number; baseDef: number; baseCrit: number; baseCritDmg: number; skill1: unknown } },
  dungeon: DungeonTemplate,
  floorNumber: number,
  runId: number,
): Promise<void> {
  const isBoss = floorNumber === dungeon.totalFloors;
  const floorMult = 1 + (floorNumber - 1) * 0.2;
  const totalMult = dungeon.statMult * floorMult;
  const lvl = lead.pc.level;
  const skill1 = lead.char.skill1 as { name: string; element?: string; damage: number };

  const enemyName = isBoss
    ? dungeon.bossName
    : dungeon.enemies[Math.floor(Math.random() * dungeon.enemies.length)];

  const enemyHp   = Math.floor(lead.char.baseHp  * lvl * totalMult * 1.2);
  const enemyAtk  = Math.floor(lead.char.baseAtk * lvl * totalMult * 0.8);
  const enemyDef  = Math.floor(lead.char.baseDef * lvl * totalMult * 0.6);

  const battle = {
    discordId: player.discordId,
    playerId: player.id,
    channelId: interaction.channelId,
    floor: floorNumber,
    isBoss,
    player: {
      name: lead.char.name,
      displayName: (interaction as ChatInputCommandInteraction).user?.username ?? "لاعب",
      discordId: player.discordId,
      hp: lead.char.baseHp * lvl,
      maxHp: lead.char.baseHp * lvl,
      atk: lead.char.baseAtk * lvl,
      def: lead.char.baseDef * lvl,
      crit: lead.char.baseCrit,
      critDmg: lead.char.baseCritDmg,
      element: lead.char.element1,
      fury: 0,
      skillName: skill1.name,
      skillElement: skill1.element ?? lead.char.element1,
      skillDamage: skill1.damage,
      skillCooldown: 0,
    },
    enemy: {
      name: enemyName,
      hp: enemyHp,
      maxHp: enemyHp,
      atk: enemyAtk,
      def: enemyDef,
      element: dungeon.element,
      fury: 0,
      skillCooldown: 0,
    },
    round: 0,
    log: [] as string[],
    dungeonId: dungeon.id,
    dungeonRunId: runId,
    maxDungeonFloor: dungeon.totalFloors,
  };

  exploreBattles.set(player.discordId, battle);

  const atkAdv = getElementMultiplier(lead.char.element1, dungeon.element) > 1;
  const defAdv = getElementMultiplier(dungeon.element, lead.char.element1) > 1;

  const embed = new EmbedBuilder()
    .setColor(isBoss ? 0xffd700 : dungeon.color)
    .setTitle(`${dungeon.emoji} ${dungeon.name} — ${isBoss ? "🏆 الزعيم النهائي" : `الطابق ${floorNumber}/${dungeon.totalFloors}`}`)
    .setDescription(`> ${isBoss ? `⚠️ **${dungeon.bossName}** يقف في طريقك! هذا الزعيم النهائي!` : `طابق ${floorNumber} من ${dungeon.totalFloors}. صمد واهزم الأعداء!`}`)
    .addFields(
      {
        name: `${ELEMENT_EMOJI[lead.char.element1] ?? ""}${lead.char.name}${atkAdv ? " ⚡ أفضلية!" : defAdv ? " ⚠️ ضعف!" : ""}`,
        value: `❤️ ${buildBar(battle.player.hp, battle.player.maxHp)} **${battle.player.hp.toLocaleString()}**`,
        inline: true,
      },
      {
        name: `${ELEMENT_EMOJI[dungeon.element] ?? ""}${enemyName}`,
        value: `❤️ ${buildBar(enemyHp, enemyHp)} **${enemyHp.toLocaleString()}**`,
        inline: true,
      },
    )
    .setFooter({ text: `🏰 ${dungeon.name} | الصعوبة: ${difficultyLabel(dungeon.difficulty)}` })
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: [battleActionsRow(false, false, 0, skill1.name)],
  });
}

// ── Handle Dungeon Floor Win ──────────────────────────────────────────────────

export async function handleDungeonFloorWin(
  interaction: ButtonInteraction,
  runId: number,
  dungeonId: string,
  nextFloor: number,
  dungeon: DungeonTemplate,
): Promise<void> {
  const [run] = await db.select().from(dungeonRunsTable).where(eq(dungeonRunsTable.id, runId));
  if (!run) return;

  const isComplete = nextFloor > dungeon.totalFloors;

  await db.update(dungeonRunsTable)
    .set({ floorsCleared: nextFloor - 1, isComplete, updatedAt: new Date() } as any)
    .where(eq(dungeonRunsTable.id, runId));

  if (isComplete) {
    await progressBounty(interaction.user.id, "dungeon_complete", 1);
    return actionDungeonClaimReward(interaction, runId, dungeon);
  }

  // Advance to next floor
  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return;

  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  const lead = chars.find(c => c.pc.isOnParty) ?? chars[0];
  if (!lead) return;

  await startDungeonFloor(interaction, player, lead, dungeon, nextFloor, runId);
}

// ── Claim Dungeon Reward ──────────────────────────────────────────────────────

async function actionDungeonClaimReward(
  interaction: AnyInteraction,
  runId: number,
  dungeon: DungeonTemplate,
): Promise<void> {
  const [run] = await db.select().from(dungeonRunsTable).where(eq(dungeonRunsTable.id, runId));
  if (!run || run.rewardsClaimed) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning).setTitle("🏰 منتهية").setDescription("لقد استلمت جائزة هذه الزنزانة بالفعل!")],
      components: [dungeonNavRow()],
    });
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return;

  const gotTicket = Math.random() * 100 < dungeon.ticketChance;
  const bonusGold = Math.floor(dungeon.rewardGold * (0.9 + Math.random() * 0.2));
  const fragments = dungeon.rewardFragments + (gotTicket ? 5 : 0);

  const newFragments = (player.summonFragments ?? 0) + fragments;
  const freePulls = Math.floor(newFragments / 10);
  const remainingFragments = newFragments % 10;

  await Promise.all([
    db.update(dungeonRunsTable).set({ rewardsClaimed: true, updatedAt: new Date() } as any).where(eq(dungeonRunsTable.id, runId)),
    db.update(playersTable).set({
      gold: player.gold + bonusGold,
      gems: player.gems + (freePulls > 0 ? freePulls * 10 : 0),
      summonFragments: remainingFragments,
      updatedAt: new Date(),
    }).where(eq(playersTable.id, player.id)),
  ]);

  const xpResult = await addXP(player.id, dungeon.rewardXp);

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`🏆 ${dungeon.emoji} ${dungeon.name} — مكتملة!`)
    .setDescription(`> **أنجزت الزنزانة بالكامل!** ${dungeon.bossName} هُزم وأبوابه انكسرت!`)
    .addFields(
      { name: "💰 الذهب", value: `+${bonusGold.toLocaleString()}`, inline: true },
      { name: "✨ الخبرة", value: `+${dungeon.rewardXp.toLocaleString()}${xpResult?.leveled ? ` 🎉 المستوى ${xpResult.newLevel}!` : ""}`, inline: true },
      { name: "🌟 الشظايا", value: `+${fragments} شظية${freePulls > 0 ? ` → 💎 +${freePulls * 10} جواهر مجانية!` : ""}`, inline: true },
      { name: "📊 تقدمك", value: `الزنزانة مكتملة ✅ — تعود غداً لمزيد من المكافآت!`, inline: false },
    )
    .setFooter({ text: "🏰 الزنازين تتجدد كل يوم" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [dungeonNavRow()] });
}

// ── Claim All Completed ───────────────────────────────────────────────────────

export async function actionDungeonClaimAll(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const today = getTodayDate();
  const completedRuns = await db.select().from(dungeonRunsTable)
    .where(and(
      eq(dungeonRunsTable.discordId, interaction.user.id),
      eq(dungeonRunsTable.dungeonDate, today),
      eq(dungeonRunsTable.isComplete, true),
      eq(dungeonRunsTable.rewardsClaimed, false),
    ));

  if (!completedRuns.length) {
    return void interaction.editReply({ embeds: [errorEmbed("لا توجد جوائز معلقة الآن!")], components: [dungeonNavRow()] });
  }

  // If only one, use the detailed single-claim view
  if (completedRuns.length === 1) {
    const dungeon = DUNGEON_TEMPLATES.find(d => d.id === completedRuns[0].dungeonId);
    if (dungeon) return actionDungeonClaimReward(interaction, completedRuns[0].id, dungeon);
    return;
  }

  // Multiple completed — batch claim all of them
  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return;

  let totalGold = 0;
  let totalXp   = 0;
  let totalFragments = 0;
  const claimedNames: string[] = [];

  for (const run of completedRuns) {
    const dungeon = DUNGEON_TEMPLATES.find(d => d.id === run.dungeonId);
    if (!dungeon) continue;

    const bonusGold = Math.floor(dungeon.rewardGold * (0.9 + Math.random() * 0.2));
    const gotTicket = Math.random() * 100 < dungeon.ticketChance;
    const fragments = dungeon.rewardFragments + (gotTicket ? 5 : 0);

    totalGold      += bonusGold;
    totalXp        += dungeon.rewardXp;
    totalFragments += fragments;

    claimedNames.push(`${dungeon.emoji} ${dungeon.name}`);
    await db.update(dungeonRunsTable).set({ rewardsClaimed: true, updatedAt: new Date() } as any).where(eq(dungeonRunsTable.id, run.id));
  }

  const currentFragments = player.summonFragments ?? 0;
  const newFragments = currentFragments + totalFragments;
  const freePulls    = Math.floor(newFragments / 10);
  const remainFrags  = newFragments % 10;
  const bonusGems    = freePulls > 0 ? freePulls * 10 : 0;

  await db.update(playersTable).set({
    gold:            player.gold + totalGold,
    gems:            player.gems + bonusGems,
    summonFragments: remainFrags,
    updatedAt:       new Date(),
  }).where(eq(playersTable.id, player.id));

  const xpResult = await addXP(player.id, totalXp);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`🏆 تم استلام ${completedRuns.length} زنزانة!`)
      .setDescription(claimedNames.join("\n"))
      .addFields(
        { name: "💰 الذهب", value: `+${totalGold.toLocaleString()}`, inline: true },
        { name: "✨ الخبرة", value: `+${totalXp.toLocaleString()}${xpResult?.leveled ? ` 🎉 المستوى ${xpResult.newLevel}!` : ""}`, inline: true },
        { name: "🌟 الشظايا", value: `+${totalFragments}${bonusGems > 0 ? ` → 💎 +${bonusGems} جواهر!` : ""}`, inline: true },
      )
      .setFooter({ text: "🏰 الزنازين تتجدد كل يوم" })
      .setTimestamp()],
    components: [dungeonNavRow()],
  });
}
