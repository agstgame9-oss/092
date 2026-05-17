import { ChatInputCommandInteraction, ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuInteraction } from "discord.js";
import { db, playersTable, playerCharactersTable, charactersTable, guildMembersTable, guildsTable } from "./db.js";
import { eq, desc, inArray, and } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, ELEMENT_EMOJI, RARITY_COLORS, errorEmbed, successEmbed } from "./embeds.js";
import { checkCooldown, setCooldown, formatTime } from "./cooldown.js";
import {
  addXP, rollRarity, RARITY_GEM_COST, applyStaminaRegen,
  getExploreEnemy, resolveRound, pickEnemyMove, getElementMultiplier,
  type Move,
} from "./gameEngine.js";
import { exploreBattles, type ExploreBattle, type FighterState } from "./battleState.js";
import { mainMenuRow, exploreRow, summonRow, dailyRow, charactersRow, partyRow, battleActionsRow, leaderboardRow, guildNavRow, type LeaderboardType } from "./buttons.js";
import { rollRandomEvent, getStreakBonus, getStreakMilestoneGems, getZoneForFloor, DUNGEON_TEMPLATES } from "./pveEngine.js";
import { progressBounty } from "./bountyActions.js";
import { handleDungeonFloorWin } from "./dungeonActions.js";
import { incrementQuestProgress, generatePlayerQuests } from "./questActions.js";

export type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function prepare(interaction: AnyInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    if (interaction.isButton()) {
      await interaction.deferUpdate();
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
    }
  }
}

function buildBar(current: number, max: number, len: number): string {
  const safeMax = Math.max(1, max);
  const filled = Math.min(len, Math.max(0, Math.round((current / safeMax) * len)));
  return "█".repeat(filled) + "░".repeat(len - filled);
}

function buildFuryBar(fury: number): string {
  const filled = Math.round((fury / 100) * 8);
  return "▓".repeat(filled) + "░".repeat(8 - filled);
}

function buildExploreBattleEmbed(battle: ExploreBattle, title: string): EmbedBuilder {
  const { player, enemy } = battle;
  const atkBonus = getElementMultiplier(player.element, enemy.element) > 1;
  const defBonus = getElementMultiplier(enemy.element, player.element) > 1;

  const playerEl = ELEMENT_EMOJI[player.element] ?? "";
  const enemyEl = ELEMENT_EMOJI[enemy.element] ?? "🐉";

  const skillInfo = player.skillCooldown > 0
    ? `المهارة: انتظار **${player.skillCooldown}** جولات`
    : `المهارة: **جاهزة**`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(title)
    .addFields(
      {
        name: `${playerEl} ${player.name} *(${player.element})*`,
        value: [
          `❤️ ${buildBar(player.hp, player.maxHp, 12)} **${player.hp.toLocaleString()}/${player.maxHp.toLocaleString()}**`,
          `💥 الغضب: ${buildFuryBar(player.fury)} **${player.fury}%** | ${skillInfo}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: `${enemyEl} ${enemy.name} *(${enemy.element})*${atkBonus ? "  ⚡ لديك أفضلية!" : ""}${defBonus ? "  ⚠️ للعدو أفضلية!" : ""}`,
        value: `❤️ ${buildBar(enemy.hp, enemy.maxHp, 12)} **${enemy.hp.toLocaleString()}/${enemy.maxHp.toLocaleString()}**`,
        inline: false,
      },
    );

  if (battle.log.length > 0) {
    embed.addFields({
      name: `📜 الجولة ${battle.round}`,
      value: battle.log.slice(-1)[0],
      inline: false,
    });
  }

  embed.setFooter({ text: "⚔️ هجوم = آمن | 🌀 مهارة = قوة العنصر | 🛡️ دفاع = يقلل الضرر ويشحن الغضب | 💥 الغضب = 2.5x انفجار" });
  return embed;
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function actionProfile(interaction: AnyInteraction, targetId?: string): Promise<void> {
  await prepare(interaction);
  const discordId = targetId ?? interaction.user.id;

  let [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) {
    const msg = discordId === interaction.user.id
      ? "لم تبدأ بعد! استخدم `/start` للتسجيل."
      : "هذا اللاعب لم يبدأ بعد.";
    return void interaction.editReply({ embeds: [errorEmbed(msg)], components: [] });
  }
  if (player.isBanned) {
    return void interaction.editReply({
      embeds: [errorEmbed(`⛔ هذا اللاعب محظور. السبب: ${player.banReason ?? "غير محدد"}`)],
      components: [],
    });
  }

  player = await applyStaminaRegen(player);

  const guildMember = player.guildMemberId
    ? await db.select({ guild: guildsTable })
        .from(guildMembersTable)
        .innerJoin(guildsTable, eq(guildMembersTable.guildId, guildsTable.id))
        .where(eq(guildMembersTable.discordId, player.discordId))
    : [];

  const guildInfo = guildMember[0]?.guild;
  const winRate = player.wins + player.losses > 0
    ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
    : "0.0";

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${guildInfo ? `[${guildInfo.tag}] ` : ""}ملف ${player.username} الشخصي`)
    .addFields(
      { name: "🎖️ المستوى", value: `**${player.level}**`, inline: true },
      { name: "🏆 تقييم PvP", value: `**${player.pvpRating}**`, inline: true },
      { name: "🌍 العالم", value: player.currentWorld, inline: true },
      { name: "📊 الخبرة", value: `${buildBar(player.xp, player.xpToNext, 12)}\n${player.xp.toLocaleString()} / ${player.xpToNext.toLocaleString()}`, inline: false },
      { name: "⚡ الطاقة", value: `${buildBar(player.stamina, player.maxStamina, 10)}\n${player.stamina} / ${player.maxStamina} *(+1 كل 6 دقائق)*`, inline: false },
      { name: "🪙 الذهب", value: player.gold.toLocaleString(), inline: true },
      { name: "💎 الجواهر", value: player.gems.toLocaleString(), inline: true },
      { name: "⚔️ انتصارات", value: `${player.wins} (${winRate}%)`, inline: true },
      { name: "💀 هزائم", value: player.losses.toString(), inline: true },
      { name: "💥 الضرر الكلي", value: player.totalDamageDealt.toLocaleString(), inline: true },
      { name: "🏯 النقابة", value: guildInfo ? `${guildInfo.emblem} ${guildInfo.name}` : "لا يوجد", inline: true },
    )
    .setFooter({ text: `معرّف ديسكورد: ${player.discordId}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [mainMenuRow()] });
}

// ── Daily ──────────────────────────────────────────────────────────────────

const DAILY_GOLD = 500;
const DAILY_GEMS = 10;
const DAILY_STAMINA = 60;

export async function actionDaily(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  let [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")], components: [] });
  if (player.isBanned) return void interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")], components: [] });

  const now = new Date();
  if (player.dailyLastClaimed) {
    const hoursSince = (now.getTime() - player.dailyLastClaimed.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      const nextClaim = new Date(player.dailyLastClaimed.getTime() + 24 * 60 * 60 * 1000);
      const remaining = Math.ceil((nextClaim.getTime() - now.getTime()) / 1000);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return void interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("⏰ تم المطالبة بالفعل!")
          .setDescription(`عُد بعد **${h} ساعة و ${m} دقيقة** لمكافأتك اليومية التالية.`)],
        components: [dailyRow()],
      });
    }
  }

  player = await applyStaminaRegen(player);

  const newGold = player.gold + DAILY_GOLD;
  const newGems = player.gems + DAILY_GEMS;
  const newStamina = Math.min(player.maxStamina, player.stamina + DAILY_STAMINA);

  await db.update(playersTable).set({
    gold: newGold,
    gems: newGems,
    stamina: newStamina,
    staminaLastRegen: now,
    dailyLastClaimed: now,
    updatedAt: now,
  }).where(eq(playersTable.id, player.id));

  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle("🎁 تم استلام المكافأة اليومية!")
    .setDescription("إليك مكافآتك اليومية:")
    .addFields(
      { name: "💰 الذهب", value: `+${DAILY_GOLD.toLocaleString()} ← ${newGold.toLocaleString()}`, inline: true },
      { name: "💎 الجواهر", value: `+${DAILY_GEMS} ← ${newGems}`, inline: true },
      { name: "⚡ الطاقة", value: `+${DAILY_STAMINA} ← ${newStamina}/${player.maxStamina}`, inline: true },
    )
    .setFooter({ text: "عُد غداً للمزيد!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [dailyRow()] });

  // Quest hooks (non-blocking)
  generatePlayerQuests(interaction.user.id).catch(() => {});
  incrementQuestProgress(interaction.user.id, "daily_login").catch(() => {});
}

// ── Explore (Interactive Turn-Based) ───────────────────────────────────────

const STAMINA_COST = 10;
const EXPLORE_COOLDOWN = 30;

export async function actionExplore(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  let [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")], components: [] });
  if (player.isBanned) return void interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")], components: [] });

  player = await applyStaminaRegen(player);

  const cd = await checkCooldown(interaction.user.id, "explore");
  if (cd > 0) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription(`⏰ فترة الانتظار! حاول مجدداً بعد **${formatTime(cd)}**.\n⚡ الطاقة: **${player.stamina}/${player.maxStamina}**`)],
      components: [exploreRow()],
    });
  }

  if (player.stamina < STAMINA_COST) {
    return void interaction.editReply({
      embeds: [errorEmbed(`طاقة غير كافية! لديك **${player.stamina}⚡** وتحتاج **${STAMINA_COST}⚡**.\nالطاقة تتجدد 1 كل 6 دقائق، أو استخدم \`/daily\` للحصول على شحنة كبيرة.`)],
      components: [exploreRow()],
    });
  }

  const partyChars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  const party = partyChars.filter(c => c.pc.isOnParty);
  const team = party.length > 0 ? party : partyChars.slice(0, 1);

  if (team.length === 0) {
    return void interaction.editReply({ embeds: [errorEmbed("لا توجد شخصيات! استخدم `/summon` للحصول على شخصيات أولاً.")], components: [] });
  }

  const lead = team[0];
  const floor = player.currentFloor + 1;
  const enemy = getExploreEnemy(floor);

  await db.update(playersTable).set({
    stamina: player.stamina - STAMINA_COST,
    updatedAt: new Date(),
  }).where(eq(playersTable.id, player.id));
  await setCooldown(interaction.user.id, "explore", EXPLORE_COOLDOWN);

  const skill1 = lead.char.skill1 as { name: string; element?: string; damage: number };

  const playerFighter: FighterState = {
    name: lead.char.name,
    displayName: player.username,
    discordId: player.discordId,
    hp: lead.char.baseHp * lead.pc.level,
    maxHp: lead.char.baseHp * lead.pc.level,
    atk: lead.char.baseAtk * lead.pc.level,
    def: lead.char.baseDef * lead.pc.level,
    crit: lead.char.baseCrit,
    critDmg: lead.char.baseCritDmg,
    element: lead.char.element1,
    fury: 0,
    skillName: skill1.name,
    skillElement: skill1.element ?? lead.char.element1,
    skillDamage: skill1.damage,
    skillCooldown: 0,
  };

  const battle: ExploreBattle = {
    discordId: player.discordId,
    playerId: player.id,
    channelId: interaction.channelId ?? "",
    floor,
    isBoss: enemy.isBoss,
    player: playerFighter,
    enemy: {
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.hp,
      atk: enemy.atk,
      def: enemy.def,
      element: enemy.element,
      fury: 0,
      skillCooldown: 0,
    },
    round: 0,
    log: [],
  };

  exploreBattles.set(player.discordId, battle);

  setTimeout(() => {
    const b = exploreBattles.get(player.discordId);
    if (b === battle) exploreBattles.delete(player.discordId);
  }, 180_000);

  const title = `⚔️ الطابق ${floor}${enemy.isBoss ? " 🏆 معركة الزعيم" : ""} — اختر حركتك!`;
  const embed = buildExploreBattleEmbed(battle, title);
  await interaction.editReply({
    embeds: [embed],
    components: [battleActionsRow(false, false, 0, playerFighter.skillName)],
  });
}

export async function actionExploreMove(interaction: ButtonInteraction, move: Move): Promise<void> {
  await interaction.deferUpdate();

  const battle = exploreBattles.get(interaction.user.id);
  if (!battle) {
    return void interaction.editReply({
      embeds: [errorEmbed("لا توجد معركة نشطة! ابدأ معركة جديدة بـ `/explore`.")],
      components: [exploreRow()],
    });
  }

  battle.round++;

  const enemyMove = pickEnemyMove(
    battle.enemy.fury,
    battle.enemy.skillCooldown,
    battle.enemy.hp / battle.enemy.maxHp,
    battle.player.hp / battle.player.maxHp,
  );

  const result = resolveRound(
    move, enemyMove,
    {
      name: battle.player.name,
      atk: battle.player.atk,
      def: battle.player.def,
      crit: battle.player.crit,
      critDmg: battle.player.critDmg,
      element: battle.player.element,
      fury: battle.player.fury,
      skillName: battle.player.skillName,
      skillElement: battle.player.skillElement,
      skillDamage: battle.player.skillDamage,
      skillCooldown: battle.player.skillCooldown,
    },
    {
      name: battle.enemy.name,
      atk: battle.enemy.atk,
      def: battle.enemy.def,
      crit: 0.07,
      critDmg: 1.5,
      element: battle.enemy.element,
      fury: battle.enemy.fury,
      skillName: "ضربة شرسة",
      skillElement: battle.enemy.element,
      skillDamage: 1.6,
      skillCooldown: battle.enemy.skillCooldown,
    },
  );

  battle.player.hp = Math.max(0, battle.player.hp + result.aHpDelta);
  battle.enemy.hp = Math.max(0, battle.enemy.hp + result.bHpDelta);

  if (move === "fury") {
    battle.player.fury = 0;
  } else {
    battle.player.fury = Math.max(0, Math.min(100, battle.player.fury + result.aFuryDelta));
  }
  if (enemyMove === "fury") {
    battle.enemy.fury = 0;
  } else {
    battle.enemy.fury = Math.max(0, Math.min(100, battle.enemy.fury + result.bFuryDelta));
  }

  battle.player.skillCooldown = result.aSkillCd;
  battle.enemy.skillCooldown = result.bSkillCd;

  const roundLog = `${result.logA}\n${result.logB}`;
  battle.log.push(roundLog);
  if (battle.log.length > 6) battle.log.shift();

  const playerDead = battle.player.hp <= 0;
  const enemyDead = battle.enemy.hp <= 0;

  if (playerDead || enemyDead) {
    exploreBattles.delete(interaction.user.id);

    const playerWon = !playerDead;
    const isBoss = battle.isBoss;
    const bossBonus = isBoss ? 3 : 1;
    const damageDealt = battle.enemy.maxHp - battle.enemy.hp;

    // ── Dungeon battle handling ──────────────────────────────────────────────
    if (battle.dungeonId && battle.dungeonRunId !== undefined) {
      const dungeon = DUNGEON_TEMPLATES.find(d => d.id === battle.dungeonId);
      const xpEarned = playerWon ? Math.floor(15 + Math.random() * 25) * bossBonus : 3;
      await addXP(battle.playerId, xpEarned);
      if (playerWon && dungeon) {
        return handleDungeonFloorWin(interaction, battle.dungeonRunId, battle.dungeonId, battle.floor + 1, dungeon);
      }
      const embed = new EmbedBuilder()
        .setColor(COLORS.danger)
        .setTitle(`💀 ${dungeon?.name ?? "الزنزانة"} — هزيمة في الطابق ${battle.floor}!`)
        .setDescription(`> حاول مرة أخرى أو قوي شخصياتك أولاً.\n> ${battle.log.slice(-1)[0] ?? ""}`)
        .addFields({ name: "⚔️ الجولات", value: `${battle.round}`, inline: true }, { name: "💥 الضرر", value: damageDealt.toLocaleString(), inline: true })
        .setTimestamp();
      return void interaction.editReply({
        embeds: [embed],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`dungeon:enter:${battle.dungeonId}`).setLabel("🔄 حاول مجدداً").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("dungeon:view").setLabel("🏰 الزنازين").setStyle(ButtonStyle.Secondary),
        )],
      });
    }

    // ── Normal explore battle ────────────────────────────────────────────────
    const [currentPlayer] = await db.select().from(playersTable).where(eq(playersTable.id, battle.playerId));
    if (!currentPlayer) return;

    const currentStreak = currentPlayer.exploreStreak ?? 0;
    const newStreak = playerWon ? currentStreak + 1 : 0;
    const streakInfo = getStreakBonus(newStreak);
    const milestoneGems = playerWon ? getStreakMilestoneGems(newStreak) : 0;

    let baseGold = playerWon ? Math.floor(50 + Math.random() * 100) * bossBonus : 0;
    const goldAfterStreak = playerWon ? Math.floor(baseGold * streakInfo.goldMult) : 0;
    const streakBonusGold = goldAfterStreak - baseGold;

    // Random event on win
    const randomEvent = playerWon ? rollRandomEvent() : null;
    let eventGold = 0, eventXp = 0, eventGems = 0, eventFragments = 0;
    if (randomEvent) {
      if (randomEvent.goldBonus > 1)     eventGold      = Math.floor(goldAfterStreak * (randomEvent.goldBonus - 1));
      if (randomEvent.xpBonus > 1)       eventXp        = Math.floor((20 + Math.random() * 30) * bossBonus * (randomEvent.xpBonus - 1));
      eventGems      = randomEvent.gemBonus;
      eventFragments = randomEvent.fragmentBonus;
    }

    const finalGold = goldAfterStreak + eventGold;
    const baseXp    = playerWon ? Math.floor(20 + Math.random() * 30) * bossBonus : 5;
    const finalXp   = baseXp + eventXp;

    const zone = getZoneForFloor(Math.max(1, battle.floor));

    if (playerWon) {
      const newFragments = (currentPlayer.summonFragments ?? 0) + eventFragments;
      const freePulls = Math.floor(newFragments / 10);
      const remainFragments = newFragments % 10;
      const bonusGems = milestoneGems + eventGems + freePulls * 10;

      await db.update(playersTable).set({
        currentFloor: battle.floor,
        gold: currentPlayer.gold + finalGold,
        gems: currentPlayer.gems + bonusGems,
        totalDamageDealt: currentPlayer.totalDamageDealt + damageDealt,
        exploreStreak: newStreak,
        summonFragments: remainFragments,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, battle.playerId));

      // Bounty progress
      progressBounty(interaction.user.id, "explore_wins", 1).catch(() => {});
      progressBounty(interaction.user.id, "explore_floors", 1).catch(() => {});
      if (isBoss) progressBounty(interaction.user.id, "boss_kill", 1).catch(() => {});
      if (newStreak >= 5) progressBounty(interaction.user.id, "streak", newStreak - currentStreak).catch(() => {});

      // Quest progress
      incrementQuestProgress(interaction.user.id, "daily_explore3").catch(() => {});
      incrementQuestProgress(interaction.user.id, "weekly_explore20").catch(() => {});
      if (isBoss) incrementQuestProgress(interaction.user.id, "weekly_boss1").catch(() => {});
    } else {
      await db.update(playersTable).set({ exploreStreak: 0, updatedAt: new Date() })
        .where(eq(playersTable.id, battle.playerId));
    }

    const xpResult = await addXP(battle.playerId, finalXp);

    const title = playerWon
      ? (isBoss ? `🏆 ${zone.emoji} الطابق ${battle.floor} — الزعيم مهزوم!` : `⚔️ ${zone.emoji} الطابق ${battle.floor} — انتصار!`)
      : (isBoss ? `💀 الطابق ${battle.floor} — هُزمت أمام الزعيم!` : `💀 الطابق ${battle.floor} — هزيمة!`);

    const embed = new EmbedBuilder()
      .setColor(playerWon ? (isBoss ? 0xffd700 : COLORS.success) : COLORS.danger)
      .setTitle(title)
      .setDescription([
        battle.log.join("\n"),
        randomEvent ? `\n${randomEvent.emoji} **${randomEvent.title}** — ${randomEvent.desc}` : "",
        !playerWon && currentStreak >= 5 ? `\n💔 تسلسل **${currentStreak}** انتصار انقطع!` : "",
      ].join(""))
      .addFields(
        { name: "⚔️ الجولات", value: `${battle.round}`, inline: true },
        { name: "💥 الضرر", value: damageDealt.toLocaleString(), inline: true },
        { name: "✨ الخبرة", value: `+${finalXp}${xpResult?.leveled ? ` 🎉 **المستوى ${xpResult.newLevel}!**` : ""}${isBoss ? " 🔥 3x" : ""}`, inline: true },
        { name: "💰 الذهب", value: playerWon ? `+${finalGold.toLocaleString()}${streakInfo.goldMult > 1 ? ` *(+${streakBonusGold} تسلسل)*` : ""}` : "0", inline: true },
        ...(playerWon && newStreak > 0 ? [{ name: "🔥 التسلسل", value: `${newStreak} انتصار متتالي${streakInfo.label ? `\n${streakInfo.label}` : ""}`, inline: true }] : []),
        ...(randomEvent && (eventFragments > 0 || eventGems > 0) ? [{ name: `${randomEvent.emoji} مكافأة خاصة`, value: `${eventFragments > 0 ? `🌟 +${eventFragments} شظية ` : ""}${eventGems > 0 ? `💎 +${eventGems}` : ""}`, inline: true }] : []),
        ...(playerWon ? [{ name: `${zone.emoji} المنطقة`, value: zone.name, inline: true }] : []),
      )
      .setTimestamp();

    return void interaction.editReply({ embeds: [embed], components: [exploreRow()] });
  }

  const title = `⚔️ الطابق ${battle.floor}${battle.isBoss ? " 🏆 زعيم" : ""} — الجولة ${battle.round + 1}`;
  const embed = buildExploreBattleEmbed(battle, title);
  await interaction.editReply({
    embeds: [embed],
    components: [battleActionsRow(
      battle.player.fury >= 100,
      battle.player.skillCooldown > 0,
      battle.player.skillCooldown,
      battle.player.skillName,
    )],
  });
}

// ── Characters ─────────────────────────────────────────────────────────────

export async function actionCharacters(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")], components: [] });

  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  if (chars.length === 0) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription("لا توجد شخصيات بعد! استخدم الأزرار أدناه للاستدعاء.")],
      components: [charactersRow()],
    });
  }

  const rarityOrder = ["SSS+", "SSS", "SS", "S", "A", "B", "C", "D"];
  chars.sort((a, b) => rarityOrder.indexOf(a.char.rarity) - rarityOrder.indexOf(b.char.rarity));

  const lines = chars.map(c => {
    const inParty = c.pc.isOnParty ? " 🎯" : "";
    const locked = c.pc.isLocked ? " 🔒" : "";
    const copies = c.pc.copies > 1 ? ` (x${c.pc.copies})` : "";
    return `${RARITY_EMOJI[c.char.rarity]} **${c.char.name}**${inParty}${locked}${copies} — ${ELEMENT_EMOJI[c.char.element1]}${c.char.element1} | المستوى ${c.pc.level}`;
  });

  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if ((current + "\n" + line).length > 900) { chunks.push(current); current = line; }
    else { current = current ? current + "\n" + line : line; }
  }
  if (current) chunks.push(current);

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`📦 شخصيات ${player.username} (${chars.length})`)
    .setDescription(chunks[0] ?? "لا يوجد")
    .setFooter({ text: "🎯 = في الفريق | 🔒 = مقفول | استخدم /party لإدارة فريقك" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [charactersRow()] });
}

// ── Party View ─────────────────────────────────────────────────────────────

export async function actionPartyView(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")], components: [] });

  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  const party = chars.filter(c => c.pc.isOnParty);

  if (!party.length) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.warning)
        .setTitle("🎯 فريقك")
        .setDescription("لا يوجد فريق!\nاستخدم `/party set <رقم>` لإضافة شخصيات من قائمة `/characters`.")],
      components: [partyRow()],
    });
  }

  const lines = party.map(c => {
    const skill1 = c.char.skill1 as { name: string };
    return `${RARITY_EMOJI[c.char.rarity]} **${c.char.name}** (${c.char.rarity}) — ${ELEMENT_EMOJI[c.char.element1]}${c.char.element1} | المستوى ${c.pc.level}\n> ❤️ ${(c.char.baseHp * c.pc.level).toLocaleString()} HP | ⚔️ ${c.char.baseAtk * c.pc.level} ATK | 🛡️ ${c.char.baseDef * c.pc.level} DEF | 🌀 ${skill1.name}`;
  }).join("\n\n");

  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle(`🎯 فريق ${player.username} (${party.length}/3)`).setDescription(lines)],
    components: [partyRow()],
  });
}

// ── Summon ─────────────────────────────────────────────────────────────────

export async function actionSummon(interaction: AnyInteraction, type: "single" | "ten" | "free"): Promise<void> {
  await prepare(interaction);
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")], components: [] });
  if (player.isBanned) return void interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")], components: [] });

  if (type === "free") {
    const cd = await checkCooldown(discordId, "free_summon");
    if (cd > 0) {
      return void interaction.editReply({
        embeds: [errorEmbed(`الاستدعاء المجاني في فترة الانتظار! حاول مجدداً بعد **${formatTime(cd)}**.`)],
        components: [summonRow()],
      });
    }
  } else {
    const cost = RARITY_GEM_COST[type];
    if (player.gems < cost) {
      return void interaction.editReply({
        embeds: [errorEmbed(`جواهر غير كافية! لديك **${player.gems}💎** وتحتاج **${cost}💎**.\nاستخدم \`/daily\` للحصول على +10 جواهر يومياً.`)],
        components: [summonRow()],
      });
    }
  }

  const allChars = await db.select().from(charactersTable).where(eq(charactersTable.isEnabled, true));
  if (!allChars.length) return void interaction.editReply({ embeds: [errorEmbed("لا توجد شخصيات متاحة بعد. اطلب من الأدمن إضافة بعض!")], components: [] });

  const count = type === "ten" ? 10 : 1;
  const pulls: typeof allChars[0][] = [];
  for (let i = 0; i < count; i++) {
    let rarity = rollRarity();
    if (type === "ten" && i === count - 1) {
      const goodRarities = ["S", "SS", "SSS", "SSS+"];
      if (!goodRarities.includes(rarity)) rarity = "S";
    }
    const pool = allChars.filter(c => c.rarity === rarity);
    pulls.push(pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : allChars[Math.floor(Math.random() * allChars.length)]);
  }

  if (type === "free") {
    await setCooldown(discordId, "free_summon", 86400);
  } else {
    const cost = RARITY_GEM_COST[type];
    await db.update(playersTable).set({ gems: player.gems - cost, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
  }

  for (const char of pulls) {
    const [playerOwns] = await db
      .select()
      .from(playerCharactersTable)
      .where(and(eq(playerCharactersTable.playerId, player.id), eq(playerCharactersTable.characterId, char.id)));

    if (playerOwns) {
      await db.update(playerCharactersTable)
        .set({ copies: playerOwns.copies + 1 })
        .where(eq(playerCharactersTable.id, playerOwns.id));
    } else {
      await db.insert(playerCharactersTable).values({
        playerId: player.id, characterId: char.id,
        level: 1, ascension: 0, copies: 1, isLocked: false, isOnParty: false,
        currentEnergy: 0, skill1Cooldown: 0, skill2Cooldown: 0, skill3Cooldown: 0, totalDamageDealt: 0,
      });
    }
  }

  // Quest hooks (non-blocking)
  incrementQuestProgress(interaction.user.id, "daily_summon1").catch(() => {});
  incrementQuestProgress(interaction.user.id, "weekly_summon3").catch(() => {});

  const gemsLeft = type === "free" ? player.gems : player.gems - RARITY_GEM_COST[type];

  if (type !== "ten") {
    const char = pulls[0];
    const embed = new EmbedBuilder()
      .setColor(RARITY_COLORS[char.rarity] ?? COLORS.primary)
      .setTitle(`${RARITY_EMOJI[char.rarity]} نتيجة الاستدعاء${type === "free" ? " المجاني" : ""}!`)
      .setDescription(`استدعيت **${char.name}**!`)
      .addFields(
        { name: "✨ الندرة", value: `${RARITY_EMOJI[char.rarity]} **${char.rarity}**`, inline: true },
        { name: "📺 المصدر", value: char.animeSource, inline: true },
        { name: "🌀 العنصر", value: `${ELEMENT_EMOJI[char.element1]}${char.element1}${char.element2 ? ` / ${ELEMENT_EMOJI[char.element2]}${char.element2}` : ""}`, inline: true },
        { name: "📊 الإحصائيات الأساسية", value: `❤️ ${char.baseHp.toLocaleString()} HP | ⚔️ ${char.baseAtk} ATK | 🛡️ ${char.baseDef} DEF | 💨 ${char.baseSpd} SPD` },
        { name: "💎 الجواهر المتبقية", value: `${gemsLeft}`, inline: true },
      )
      .setTimestamp();
    if (char.imageUrl) embed.setThumbnail(char.imageUrl);
    return void interaction.editReply({ embeds: [embed], components: [summonRow()] });
  }

  const order = ["D", "C", "B", "A", "S", "SS", "SSS", "SSS+"];
  const best = pulls.reduce((a, b) => order.indexOf(b.rarity) > order.indexOf(a.rarity) ? b : a);
  const lines = pulls.map((c, i) =>
    `${i + 1}. ${RARITY_EMOJI[c.rarity]} **${c.name}** (${c.rarity}) — ${ELEMENT_EMOJI[c.element1]}${c.element1}`
  ).join("\n");

  const embed = new EmbedBuilder()
    .setColor(RARITY_COLORS[best.rarity] ?? COLORS.primary)
    .setTitle("🎰 نتائج الاستدعاء ×10!")
    .setDescription(lines)
    .addFields({ name: "💎 الجواهر المتبقية", value: `${gemsLeft}`, inline: true })
    .setFooter({ text: "✨ ضمان ندرة S في السحبة العاشرة!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [summonRow()] });
}

// ── Leaderboard ─────────────────────────────────────────────────────────────

const MEDALS = ["🥇", "🥈", "🥉"];

const LB_TITLES: Record<string, string> = {
  pvp:    "🏆 لوح صدارة PvP",
  level:  "📊 لوح صدارة المستوى",
  gold:   "💰 أغنى اللاعبين",
  damage: "💥 أعلى الضررات",
  wins:   "⚔️ أكثر الانتصارات",
};

export async function actionLeaderboard(interaction: AnyInteraction, type: LeaderboardType): Promise<void> {
  await prepare(interaction);

  const orderCol = {
    pvp:    desc(playersTable.pvpRating),
    level:  desc(playersTable.level),
    gold:   desc(playersTable.gold),
    damage: desc(playersTable.totalDamageDealt),
    wins:   desc(playersTable.wins),
  }[type];

  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.isBanned, false))
    .orderBy(orderCol)
    .limit(10);

  if (!players.length) {
    await interaction.editReply({ embeds: [errorEmbed("لا يوجد لاعبون بعد.")] });
    return;
  }

  const getValue = (p: typeof players[0]): string => {
    if (type === "pvp")    return `${p.pvpRating} تقييم`;
    if (type === "level")  return `المستوى ${p.level} (${p.xp.toLocaleString()} خبرة)`;
    if (type === "gold")   return `${p.gold.toLocaleString()} 🪙`;
    if (type === "damage") return `${p.totalDamageDealt.toLocaleString()} ضرر`;
    if (type === "wins")   return `${p.wins} انتصار (${p.losses} هزيمة)`;
    return "";
  };

  const callerId = interaction.user.id;
  const callerIndex = players.findIndex((p) => p.discordId === callerId);

  const lines = players.map((p, i) => {
    const medal = MEDALS[i] ?? `**${i + 1}.**`;
    const isYou = p.discordId === callerId ? " ← **أنت**" : "";
    return `${medal} **${p.username}**${isYou}\n> ${getValue(p)}`;
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(LB_TITLES[type])
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: callerIndex === -1 ? "لست ضمن أفضل 10 بعد!" : `ترتيبك: #${callerIndex + 1}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [leaderboardRow(type)] });
}

// ── Guild Info ───────────────────────────────────────────────────────────────

export async function actionGuildInfo(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);
  const discordId = interaction.user.id;

  const [gm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
  if (!gm) {
    await interaction.editReply({ embeds: [errorEmbed("أنت لست في نقابة. انضم لواحدة بـ `/guild join <اسم>`.") ] });
    return;
  }

  const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, gm.guildId));
  if (!guild) {
    await interaction.editReply({ embeds: [errorEmbed("النقابة غير موجودة.")] });
    return;
  }

  const members = await db.select().from(guildMembersTable).where(eq(guildMembersTable.guildId, guild.id));

  const roleNames: Record<string, string> = { leader: "قائد", officer: "ضابط", member: "عضو", recruit: "مجنّد" };

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${guild.emblem} ${guild.name} [${guild.tag}]`)
    .setDescription(guild.description ?? "*لا يوجد وصف*")
    .addFields(
      { name: "🏯 المستوى",       value: String(guild.level),                  inline: true },
      { name: "👥 الأعضاء",       value: `${members.length}/${guild.maxMembers}`, inline: true },
      { name: "🚪 مفتوحة",        value: guild.isOpen ? "نعم" : "لا",          inline: true },
      { name: "💰 الخزينة",       value: `${guild.treasury.toLocaleString()} 🪙`, inline: true },
      { name: "🏆 الانتصارات",    value: guild.totalWins.toLocaleString(),      inline: true },
      { name: "💀 قتل الزعماء",   value: guild.totalBossKills.toLocaleString(), inline: true },
      { name: "👑 رتبتك",         value: roleNames[gm.role] ?? gm.role,         inline: true },
      { name: "🤝 المساهمة",      value: `${gm.contribution.toLocaleString()} 🪙`, inline: true },
    )
    .setTimestamp(guild.createdAt);

  await interaction.editReply({ embeds: [embed], components: [guildNavRow()] });
}

// ── Guild Members ────────────────────────────────────────────────────────────

export async function actionGuildMembers(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);
  const discordId = interaction.user.id;

  const [gm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
  if (!gm) {
    await interaction.editReply({ embeds: [errorEmbed("أنت لست في نقابة. انضم لواحدة بـ `/guild join <اسم>`.")] });
    return;
  }

  const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, gm.guildId));
  if (!guild) {
    await interaction.editReply({ embeds: [errorEmbed("النقابة غير موجودة.")] });
    return;
  }

  const members = await db.select().from(guildMembersTable).where(eq(guildMembersTable.guildId, guild.id));
  const roleOrder: Record<string, number> = { leader: 0, officer: 1, member: 2, recruit: 3 };
  members.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));
  const roleEmoji: Record<string, string> = { leader: "👑", officer: "⭐", member: "⚔️", recruit: "🔰" };
  const roleNames: Record<string, string> = { leader: "قائد", officer: "ضابط", member: "عضو", recruit: "مجنّد" };

  const lines = members.map((m) =>
    `${roleEmoji[m.role] ?? "❓"} **${m.username}**${m.discordId === discordId ? " *(أنت)*" : ""} — ${roleNames[m.role] ?? m.role} | ${m.contribution.toLocaleString()} 🪙`
  );

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${guild.emblem} ${guild.name} — الأعضاء (${members.length}/${guild.maxMembers})`)
    .setDescription(lines.join("\n") || "لا يوجد أعضاء.")
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [guildNavRow()] });
}

// ── Party Manage (button → select menu) ─────────────────────────────────────

export async function actionPartyManage(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;
  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) {
    return void interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });
  }

  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  if (!chars.length) {
    return void interaction.editReply({ embeds: [errorEmbed("لا توجد شخصيات بعد! استدعِ بعضاً أولاً.")] });
  }

  const rarityOrder = ["SSS+", "SSS", "SS", "S", "A", "B", "C", "D"];
  chars.sort((a, b) => rarityOrder.indexOf(a.char.rarity) - rarityOrder.indexOf(b.char.rarity));

  const top25 = chars.slice(0, 25);

  const options = top25.map(c => ({
    label: `${c.char.name} (${c.char.rarity})`,
    description: `${ELEMENT_EMOJI[c.char.element1]}${c.char.element1} | المستوى ${c.pc.level} | هجوم ${c.char.baseAtk * c.pc.level}`,
    value: String(c.pc.id),
    emoji: RARITY_EMOJI[c.char.rarity] ?? "⬛",
    default: c.pc.isOnParty,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId("party:select")
    .setPlaceholder("اختر حتى 3 شخصيات لفريقك…")
    .setMinValues(0)
    .setMaxValues(Math.min(3, top25.length))
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const partyList = chars.filter(c => c.pc.isOnParty)
    .map(c => `${RARITY_EMOJI[c.char.rarity]} **${c.char.name}** (${c.char.rarity})`)
    .join("\n") || "*فارغ*";

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("🎯 إدارة فريقك")
    .setDescription("اختر حتى **3 شخصيات** لفريق المعارك الخاص بك.\nاختيارك الجديد سـ**يستبدل** الفريق الحالي.")
    .addFields({ name: "🎯 الفريق الحالي", value: partyList })
    .setFooter({ text: chars.length > 25 ? `يعرض أفضل 25 من ${chars.length} شخصية (مرتّبة حسب الندرة)` : `${chars.length} شخصية متاحة` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function actionPartySelectSubmit(interaction: StringSelectMenuInteraction): Promise<void> {
  await interaction.deferUpdate();

  const discordId = interaction.user.id;
  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return;

  const selectedIds = interaction.values.map(v => parseInt(v, 10));

  await db.update(playerCharactersTable)
    .set({ isOnParty: false })
    .where(eq(playerCharactersTable.playerId, player.id));

  if (selectedIds.length > 0) {
    await db.update(playerCharactersTable)
      .set({ isOnParty: true })
      .where(inArray(playerCharactersTable.id, selectedIds));
  }

  const newParty = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id))
    .then(rows => rows.filter(r => r.pc.isOnParty));

  const lines = newParty.length
    ? newParty.map(c => `${RARITY_EMOJI[c.char.rarity]} **${c.char.name}** (${c.char.rarity}) — المستوى ${c.pc.level}`).join("\n")
    : "*تم تفريغ الفريق*";

  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle("🎯 تم تحديث الفريق!")
    .setDescription(`تم تعيين فريقك إلى:\n\n${lines}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [] });
}
