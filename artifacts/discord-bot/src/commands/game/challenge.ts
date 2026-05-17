import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, ButtonInteraction,
} from "discord.js";
import { resolveTournamentMatch } from "../../lib/tournamentEngine.js";
import { announceMatchResult } from "../../lib/tournamentAnnouncer.js";
import { db, playersTable, playerCharactersTable, charactersTable, battlesTable, tournamentsTable, tournamentParticipantsTable } from "../../lib/db.js";
import { eq } from "drizzle-orm";
import { resolveRound, addXP, getElementMultiplier } from "../../lib/gameEngine.js";
import { COLORS, RARITY_EMOJI, ELEMENT_EMOJI, errorEmbed } from "../../lib/embeds.js";
import { checkCooldown, setCooldown, formatTime } from "../../lib/cooldown.js";
import { pvpBattles, type FighterState, type PvpBattle } from "../../lib/battleState.js";
import { pvpChallengeRow, pvpMoveRow } from "../../lib/buttons.js";
import type { Move } from "../../lib/gameEngine.js";
import { incrementQuestProgress } from "../../lib/questActions.js";
import { progressBounty } from "../../lib/bountyActions.js";

const PVP_COOLDOWN = 300;
const PVP_RATING_WIN = 25;
const PVP_RATING_LOSS = 20;
const MAX_ROUNDS = 8;

function buildHpBar(hp: number, maxHp: number): string {
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const filled = Math.round(pct * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function buildFuryBar(fury: number): string {
  const filled = Math.round((fury / 100) * 8);
  return "▓".repeat(filled) + "░".repeat(8 - filled);
}

function buildPvpEmbed(battle: PvpBattle, title: string): EmbedBuilder {
  const a = battle.attacker;
  const d = battle.defender;
  const aAdv = getElementMultiplier(a.element, d.element) > 1;
  const dAdv = getElementMultiplier(d.element, a.element) > 1;

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(title)
    .addFields(
      {
        name: `${ELEMENT_EMOJI[a.element] ?? ""}${a.displayName} — ${a.name} *(${a.element})*${aAdv ? " ⚡ أفضلية!" : ""}`,
        value: [
          `❤️ ${buildHpBar(a.hp, a.maxHp)} **${a.hp.toLocaleString()}/${a.maxHp.toLocaleString()}**`,
          `💥 الغضب: ${buildFuryBar(a.fury)} **${a.fury}%** | المهارة: ${a.skillCooldown > 0 ? `انتظار ${a.skillCooldown}` : "**جاهزة**"}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: `${ELEMENT_EMOJI[d.element] ?? ""}${d.displayName} — ${d.name} *(${d.element})*${dAdv ? " ⚡ أفضلية!" : ""}`,
        value: [
          `❤️ ${buildHpBar(d.hp, d.maxHp)} **${d.hp.toLocaleString()}/${d.maxHp.toLocaleString()}**`,
          `💥 الغضب: ${buildFuryBar(d.fury)} **${d.fury}%** | المهارة: ${d.skillCooldown > 0 ? `انتظار ${d.skillCooldown}` : "**جاهزة**"}`,
        ].join("\n"),
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

  return embed;
}

async function resolvePvpRound(interaction: ButtonInteraction, battle: PvpBattle): Promise<void> {
  const aMove = battle.attackerMove!;
  const dMove = battle.defenderMove!;

  const result = resolveRound(
    aMove, dMove,
    {
      name: battle.attacker.name,
      atk: battle.attacker.atk,
      def: battle.attacker.def,
      crit: battle.attacker.crit,
      critDmg: battle.attacker.critDmg,
      element: battle.attacker.element,
      fury: battle.attacker.fury,
      skillName: battle.attacker.skillName,
      skillElement: battle.attacker.skillElement,
      skillDamage: battle.attacker.skillDamage,
      skillCooldown: battle.attacker.skillCooldown,
    },
    {
      name: battle.defender.name,
      atk: battle.defender.atk,
      def: battle.defender.def,
      crit: battle.defender.crit,
      critDmg: battle.defender.critDmg,
      element: battle.defender.element,
      fury: battle.defender.fury,
      skillName: battle.defender.skillName,
      skillElement: battle.defender.skillElement,
      skillDamage: battle.defender.skillDamage,
      skillCooldown: battle.defender.skillCooldown,
    },
  );

  battle.attacker.hp = Math.max(0, battle.attacker.hp + result.aHpDelta);
  battle.defender.hp = Math.max(0, battle.defender.hp + result.bHpDelta);

  if (aMove === "fury") battle.attacker.fury = 0;
  else battle.attacker.fury = Math.max(0, Math.min(100, battle.attacker.fury + result.aFuryDelta));
  if (dMove === "fury") battle.defender.fury = 0;
  else battle.defender.fury = Math.max(0, Math.min(100, battle.defender.fury + result.bFuryDelta));

  battle.attacker.skillCooldown = result.aSkillCd;
  battle.defender.skillCooldown = result.bSkillCd;

  const roundLog = `${result.logA}\n${result.logB}`;
  battle.log.push(roundLog);
  if (battle.log.length > 6) battle.log.shift();

  const attackerDead = battle.attacker.hp <= 0;
  const defenderDead = battle.defender.hp <= 0;
  const roundsUp = battle.round >= MAX_ROUNDS;
  const battleOver = attackerDead || defenderDead || roundsUp;

  if (battleOver) {
    battle.status = "finished";
    pvpBattles.delete(battle.battleId);

    let attackerWon: boolean;
    if (attackerDead && defenderDead) {
      attackerWon = battle.attacker.hp >= battle.defender.hp;
    } else if (roundsUp && !attackerDead && !defenderDead) {
      const aHpPct = battle.attacker.hp / battle.attacker.maxHp;
      const dHpPct = battle.defender.hp / battle.defender.maxHp;
      attackerWon = aHpPct >= dHpPct;
    } else {
      attackerWon = !attackerDead;
    }

    const aRatingChange = attackerWon ? PVP_RATING_WIN : -PVP_RATING_LOSS;
    const dRatingChange = attackerWon ? -PVP_RATING_LOSS : PVP_RATING_WIN;
    const aNewRating = Math.max(0, battle.attackerRating + aRatingChange);
    const dNewRating = Math.max(0, battle.defenderRating + dRatingChange);

    const xpWin = 40;
    const xpLoss = 10;

    const [[aPlayer], [dPlayer]] = await Promise.all([
      db.select({ wins: playersTable.wins, losses: playersTable.losses }).from(playersTable).where(eq(playersTable.id, battle.attackerDbId)),
      db.select({ wins: playersTable.wins, losses: playersTable.losses }).from(playersTable).where(eq(playersTable.id, battle.defenderDbId)),
    ]);

    await Promise.all([
      db.update(playersTable).set({
        wins: attackerWon ? (aPlayer?.wins ?? 0) + 1 : (aPlayer?.wins ?? 0),
        losses: attackerWon ? (aPlayer?.losses ?? 0) : (aPlayer?.losses ?? 0) + 1,
        pvpRating: aNewRating,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, battle.attackerDbId)),
      db.update(playersTable).set({
        wins: attackerWon ? (dPlayer?.wins ?? 0) : (dPlayer?.wins ?? 0) + 1,
        losses: attackerWon ? (dPlayer?.losses ?? 0) + 1 : (dPlayer?.losses ?? 0),
        pvpRating: dNewRating,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, battle.defenderDbId)),
      addXP(battle.attackerDbId, attackerWon ? xpWin : xpLoss),
      addXP(battle.defenderDbId, attackerWon ? xpLoss : xpWin),
    ]);

    // Quest + Bounty progress for PvP winner (non-blocking)
    const winnerDiscordId = attackerWon ? battle.attacker.discordId : battle.defender.discordId;
    incrementQuestProgress(winnerDiscordId, "daily_pvpwin1").catch(() => {});
    incrementQuestProgress(winnerDiscordId, "weekly_pvp5").catch(() => {});
    progressBounty(winnerDiscordId, "pvp_wins", 1).catch(() => {});

    const winner = attackerWon ? battle.attacker : battle.defender;
    const loser = attackerWon ? battle.defender : battle.attacker;
    const winnerChange = attackerWon ? aRatingChange : dRatingChange;
    const loserChange = attackerWon ? dRatingChange : aRatingChange;
    const winnerOldRating = attackerWon ? battle.attackerRating : battle.defenderRating;
    const loserOldRating = attackerWon ? battle.defenderRating : battle.attackerRating;

    const resultEmbed = new EmbedBuilder()
      .setColor(attackerWon ? COLORS.success : COLORS.danger)
      .setTitle(`⚔️ انتهت معركة PvP! — ${roundsUp && !attackerDead && !defenderDead ? "انتهى الوقت!" : "ضربة قاضية!"}`)
      .setDescription(battle.log.join("\n"))
      .addFields(
        { name: "🏆 الفائز", value: `**${winner.displayName}** بـ **${winner.name}**`, inline: false },
        {
          name: `📊 ${winner.displayName}`,
          value: `${winnerOldRating} ← **${winnerOldRating + winnerChange}** (+${winnerChange}) | +${xpWin} خبرة`,
          inline: true,
        },
        {
          name: `📊 ${loser.displayName}`,
          value: `${loserOldRating} ← **${Math.max(0, loserOldRating + loserChange)}** (${loserChange}) | +${xpLoss} خبرة`,
          inline: true,
        },
        { name: "⚔️ إجمالي الجولات", value: `${battle.round}`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed], components: [] });
    if (battle.tournamentId !== undefined && battle.tournamentMatchId) {
      const winnerId = attackerWon ? battle.attacker.discordId : battle.defender.discordId;
      const loserId = attackerWon ? battle.defender.discordId : battle.attacker.discordId;
      const winnerName = attackerWon ? battle.attacker.displayName : battle.defender.displayName;
      const loserName = attackerWon ? battle.defender.displayName : battle.attacker.displayName;
      resolveTournamentMatch(battle.tournamentId, battle.tournamentMatchId, winnerId).catch(console.error);
      // Announce match result to tournament channel
      (async () => {
        const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, battle.tournamentId!));
        if (!t) return;
        const isFinal = t.currentRound === t.totalRounds;
        announceMatchResult(
          interaction.client,
          t.channelId,
          t.name,
          t.currentRound,
          t.totalRounds,
          winnerName,
          winnerId,
          loserName,
          isFinal,
        ).catch(console.error);
      })().catch(console.error);
    }
    return;
  }

  battle.round++;
  battle.attackerMove = null;
  battle.defenderMove = null;

  const embed = buildPvpEmbed(battle, `⚔️ PvP الجولة ${battle.round}/${MAX_ROUNDS} — اختر حركتك!`);

  const furyReady = battle.attacker.fury >= 100 || battle.defender.fury >= 100;
  const skillCd = Math.max(battle.attacker.skillCooldown, battle.defender.skillCooldown) > 0;

  await interaction.editReply({
    embeds: [embed],
    components: [pvpMoveRow(battle.battleId, furyReady, skillCd, "مهارة")],
  });
}

// ── Exported handlers (called from interactionCreate) ────────────────────

export async function handlePvpAccept(interaction: ButtonInteraction, battleId: string): Promise<void> {
  const battle = pvpBattles.get(battleId);
  if (!battle || battle.status !== "pending") {
    return void interaction.reply({ embeds: [errorEmbed("انتهت صلاحية هذا التحدي أو بدأ بالفعل.")], ephemeral: true });
  }
  if (interaction.user.id !== battle.defender.discordId) {
    return void interaction.reply({ embeds: [errorEmbed("هذا التحدي ليس لك!")], ephemeral: true });
  }

  battle.status = "active";
  battle.messageId = interaction.message.id;
  battle.round = 1;

  await interaction.deferUpdate();

  const embed = buildPvpEmbed(battle, `⚔️ معركة PvP — الجولة 1/${MAX_ROUNDS} — اختر حركتك!`);
  const furyReady = false;
  const skillCd = false;

  await interaction.editReply({
    embeds: [embed],
    components: [pvpMoveRow(battleId, furyReady, skillCd, "مهارة")],
  });
}

export async function handlePvpDecline(interaction: ButtonInteraction, battleId: string): Promise<void> {
  const battle = pvpBattles.get(battleId);
  if (!battle || battle.status !== "pending") {
    return void interaction.reply({ embeds: [errorEmbed("انتهت صلاحية هذا التحدي بالفعل.")], ephemeral: true });
  }
  if (interaction.user.id !== battle.defender.discordId) {
    return void interaction.reply({ embeds: [errorEmbed("فقط اللاعب المتحدَّى يمكنه الرفض.")], ephemeral: true });
  }

  pvpBattles.delete(battleId);
  await interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.danger)
      .setTitle("❌ تم رفض التحدي")
      .setDescription(`**${battle.defender.displayName}** رفض تحدي **${battle.attacker.displayName}**.`)],
    components: [],
  });
}

export async function handlePvpMove(interaction: ButtonInteraction, battleId: string, move: Move): Promise<void> {
  const battle = pvpBattles.get(battleId);
  if (!battle || battle.status !== "active") {
    return void interaction.reply({ embeds: [errorEmbed("لا توجد معركة نشطة.")], ephemeral: true });
  }

  const isAttacker = interaction.user.id === battle.attacker.discordId;
  const isDefender = interaction.user.id === battle.defender.discordId;

  if (!isAttacker && !isDefender) {
    return void interaction.reply({ embeds: [errorEmbed("أنت لست جزءاً من هذه المعركة!")], ephemeral: true });
  }

  const fighter = isAttacker ? battle.attacker : battle.defender;
  if (move === "fury" && fighter.fury < 100) {
    return void interaction.reply({ embeds: [errorEmbed("مقياس الغضب لم يكتمل بعد!")], ephemeral: true });
  }
  if (move === "skill" && fighter.skillCooldown > 0) {
    return void interaction.reply({ embeds: [errorEmbed(`مهارتك في فترة انتظار لـ **${fighter.skillCooldown}** جولات أخرى!`)], ephemeral: true });
  }

  if (isAttacker) {
    if (battle.attackerMove !== null) {
      return void interaction.reply({ embeds: [errorEmbed("لقد اخترت حركتك بالفعل!")], ephemeral: true });
    }
    battle.attackerMove = move;
  } else {
    if (battle.defenderMove !== null) {
      return void interaction.reply({ embeds: [errorEmbed("لقد اخترت حركتك بالفعل!")], ephemeral: true });
    }
    battle.defenderMove = move;
  }

  await interaction.deferUpdate();

  if (battle.attackerMove !== null && battle.defenderMove !== null) {
    await resolvePvpRound(interaction, battle);
    return;
  }

  const waitingFor = battle.attackerMove === null ? battle.attacker.displayName : battle.defender.displayName;
  const chosenBy = battle.attackerMove !== null ? battle.attacker.displayName : battle.defender.displayName;
  const chosenMove = battle.attackerMove ?? battle.defenderMove;
  const moveLabels: Record<Move, string> = {
    attack: "⚔️ هجوم",
    skill: "🌀 مهارة",
    defend: "🛡️ دفاع",
    fury: "💥 الغضب!",
  };

  const embed = buildPvpEmbed(battle, `⚔️ PvP الجولة ${battle.round}/${MAX_ROUNDS} — في انتظار ${waitingFor}…`);
  embed.addFields({
    name: "✅ تم تأكيد الحركة",
    value: `**${chosenBy}** اختار **${moveLabels[chosenMove!]}** — في انتظار **${waitingFor}**…`,
    inline: false,
  });

  await interaction.editReply({
    embeds: [embed],
    components: [pvpMoveRow(battleId, fighter.fury >= 100, fighter.skillCooldown > 0, fighter.skillName)],
  });
}

// ── Slash Command ────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("challenge")
  .setDescription("تحدَّ لاعباً آخر في معركة PvP استراتيجية!")
  .addUserOption(opt => opt.setName("opponent").setDescription("اللاعب الذي تريد تحديه").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const opponent = interaction.options.getUser("opponent", true);

  if (opponent.id === interaction.user.id) {
    return interaction.editReply({ embeds: [errorEmbed("لا يمكنك تحدّي نفسك!")] });
  }
  if (opponent.bot) {
    return interaction.editReply({ embeds: [errorEmbed("لا يمكنك تحدّي بوت!")] });
  }

  const cd = await checkCooldown(interaction.user.id, "challenge");
  if (cd > 0) {
    return interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription(`⏰ فترة انتظار PvP: **${formatTime(cd)}**`)],
    });
  }

  const [attacker] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  const [defender] = await db.select().from(playersTable).where(eq(playersTable.discordId, opponent.id));

  if (!attacker) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });
  if (!defender) return interaction.editReply({ embeds: [errorEmbed("هذا اللاعب لم يبدأ بعد!")] });
  if (attacker.isBanned || defender.isBanned) return interaction.editReply({ embeds: [errorEmbed("اللاعبون المحظورون لا يمكنهم القتال.")] });

  const getLeadChar = async (playerId: number) => {
    const chars = await db
      .select({ pc: playerCharactersTable, char: charactersTable })
      .from(playerCharactersTable)
      .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
      .where(eq(playerCharactersTable.playerId, playerId));
    return chars.find(c => c.pc.isOnParty) ?? chars[0] ?? null;
  };

  const [aLead, dLead] = await Promise.all([
    getLeadChar(attacker.id),
    getLeadChar(defender.id),
  ]);

  if (!aLead) return interaction.editReply({ embeds: [errorEmbed("ليس لديك شخصيات! استخدم `/summon` أولاً.")] });
  if (!dLead) return interaction.editReply({ embeds: [errorEmbed("منافسك لا يملك شخصيات!")] });

  await setCooldown(interaction.user.id, "challenge", PVP_COOLDOWN);

  const aSkill1 = aLead.char.skill1 as { name: string; element?: string; damage: number };
  const dSkill1 = dLead.char.skill1 as { name: string; element?: string; damage: number };

  const attackerFighter: FighterState = {
    name: aLead.char.name,
    displayName: interaction.user.username,
    discordId: interaction.user.id,
    hp: aLead.char.baseHp * aLead.pc.level,
    maxHp: aLead.char.baseHp * aLead.pc.level,
    atk: aLead.char.baseAtk * aLead.pc.level,
    def: aLead.char.baseDef * aLead.pc.level,
    crit: aLead.char.baseCrit,
    critDmg: aLead.char.baseCritDmg,
    element: aLead.char.element1,
    fury: 0,
    skillName: aSkill1.name,
    skillElement: aSkill1.element ?? aLead.char.element1,
    skillDamage: aSkill1.damage,
    skillCooldown: 0,
  };

  const defenderFighter: FighterState = {
    name: dLead.char.name,
    displayName: opponent.username,
    discordId: opponent.id,
    hp: dLead.char.baseHp * dLead.pc.level,
    maxHp: dLead.char.baseHp * dLead.pc.level,
    atk: dLead.char.baseAtk * dLead.pc.level,
    def: dLead.char.baseDef * dLead.pc.level,
    crit: dLead.char.baseCrit,
    critDmg: dLead.char.baseCritDmg,
    element: dLead.char.element1,
    fury: 0,
    skillName: dSkill1.name,
    skillElement: dSkill1.element ?? dLead.char.element1,
    skillDamage: dSkill1.damage,
    skillCooldown: 0,
  };

  const battleId = `${interaction.user.id}_${opponent.id}_${Date.now()}`;

  const battle: PvpBattle = {
    battleId,
    channelId: interaction.channelId,
    messageId: "",
    attacker: attackerFighter,
    defender: defenderFighter,
    attackerDbId: attacker.id,
    defenderDbId: defender.id,
    attackerRating: attacker.pvpRating,
    defenderRating: defender.pvpRating,
    round: 0,
    log: [],
    status: "pending",
    attackerMove: null,
    defenderMove: null,
  };

  pvpBattles.set(battleId, battle);

  setTimeout(() => {
    const b = pvpBattles.get(battleId);
    if (b && b.status === "pending") pvpBattles.delete(battleId);
  }, 120_000);

  const aAdv = getElementMultiplier(aLead.char.element1, dLead.char.element1) > 1;
  const dAdv = getElementMultiplier(dLead.char.element1, aLead.char.element1) > 1;

  const embed = new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(`⚔️ تحدي PvP!`)
    .setDescription(`**${interaction.user.username}** تحدّى **${opponent.username}** في معركة استراتيجية!\n\n${opponent.username}، هل تقبل؟`)
    .addFields(
      {
        name: `${ELEMENT_EMOJI[aLead.char.element1] ?? ""}${interaction.user.username} — ${aLead.char.name}`,
        value: `${RARITY_EMOJI[aLead.char.rarity]} ${aLead.char.rarity} | ${aLead.char.element1}${aAdv ? " ⚡ **أفضلية عنصرية!**" : ""}\n❤️ ${attackerFighter.maxHp.toLocaleString()} HP | ⚔️ ${attackerFighter.atk} ATK | 🌀 ${aSkill1.name}`,
        inline: true,
      },
      {
        name: `${ELEMENT_EMOJI[dLead.char.element1] ?? ""}${opponent.username} — ${dLead.char.name}`,
        value: `${RARITY_EMOJI[dLead.char.rarity]} ${dLead.char.rarity} | ${dLead.char.element1}${dAdv ? " ⚡ **أفضلية عنصرية!**" : ""}\n❤️ ${defenderFighter.maxHp.toLocaleString()} HP | ⚔️ ${defenderFighter.atk} ATK | 🌀 ${dSkill1.name}`,
        inline: true,
      },
    )
    .setFooter({ text: "⚔️ هجوم | 🌀 مهارة (قوة العنصر) | 🛡️ دفاع (يقلل الضرر) | 💥 الغضب (2.5x عند 100%) — الاستراتيجية تهم!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [pvpChallengeRow(battleId)] });
}
