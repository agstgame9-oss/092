import {
  Interaction, Events, Collection, EmbedBuilder,
  ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction,
} from "discord.js";
import { COLORS } from "../lib/embeds.js";
import {
  actionProfile,
  actionDaily,
  actionExplore,
  actionExploreMove,
  actionCharacters,
  actionPartyView,
  actionSummon,
  actionLeaderboard,
  actionGuildInfo,
  actionGuildMembers,
  actionPartyManage,
  actionPartySelectSubmit,
} from "../lib/actions.js";
import {
  handlePvpAccept,
  handlePvpDecline,
  handlePvpMove,
} from "../commands/game/challenge.js";
import {
  actionAdminDashboard,
  actionAdminStats,
  actionAdminConfig,
  actionAdminLogs,
  openGiveGemsModal,
  openGiveGoldModal,
  openGiveXpModal,
  openBanModal,
  openUnbanModal,
  openResetModal,
  openAnnounceModal,
  handleAdminModalSubmit,
  showBossSpawnMenu,
  spawnBossRaid,
  handleRaidAttack,
} from "../lib/adminActions.js";
import {
  actionTournamentView,
  actionTournamentJoin,
  actionTournamentBracket,
  actionTournamentFight,
  actionTournamentBets,
  actionTournamentBetOn,
  handleTournamentBetModalSubmit,
  actionTournamentSeasonStats,
  openCreateTournamentModal,
  actionAdminStartTournament,
  actionAdminCancelTournament,
  actionAdminNextRound,
  handleTournamentModalSubmit,
} from "../lib/tournamentActions.js";
import {
  actionEventView,
  actionEventJoin,
  actionEventClaim,
  actionEventScores,
  openCreateEventModal,
  actionAdminStartEvent,
  actionAdminEndEvent,
  handleEventModalSubmit,
  actionEventTemplatePicker,
  actionEventTemplateSelect,
} from "../lib/eventActions.js";
import {
  actionQuestView,
  actionQuestClaimAll,
} from "../lib/questActions.js";
import {
  actionDungeonView,
  actionDungeonEnter,
  actionDungeonClaimAll,
} from "../lib/dungeonActions.js";
import {
  actionExpeditionView,
  actionExpeditionStartMenu,
  actionExpeditionClaimAll,
  actionExpeditionSelectMission,
  actionExpeditionSelectDiff,
} from "../lib/expeditionActions.js";
import {
  actionBountyView,
  actionBountyClaimAll,
} from "../lib/bountyActions.js";
import type { Move } from "../lib/gameEngine.js";
import { handleTradeAcceptButton, handleTradeDeclineButton } from "../commands/game/trade.js";
import { handleInventoryUse } from "../lib/inventoryActions.js";

export const name = Events.InteractionCreate;
export const once = false;

const staticButtonHandlers: Record<string, (i: ButtonInteraction) => Promise<void>> = {
  // ── Core game actions ──────────────────────────────────────────────────────
  "act:profile":       (i) => actionProfile(i),
  "act:daily":         (i) => actionDaily(i),
  "act:explore":       (i) => actionExplore(i),
  "act:characters":    (i) => actionCharacters(i),
  "act:party_view":    (i) => actionPartyView(i),
  "act:summon_single": (i) => actionSummon(i, "single"),
  "act:summon_ten":    (i) => actionSummon(i, "ten"),
  "act:summon_free":   (i) => actionSummon(i, "free"),
  // ── Leaderboard type switches ──────────────────────────────────────────────
  "act:lb_pvp":    (i) => actionLeaderboard(i, "pvp"),
  "act:lb_level":  (i) => actionLeaderboard(i, "level"),
  "act:lb_gold":   (i) => actionLeaderboard(i, "gold"),
  "act:lb_damage": (i) => actionLeaderboard(i, "damage"),
  "act:lb_wins":   (i) => actionLeaderboard(i, "wins"),
  // ── Guild navigation ───────────────────────────────────────────────────────
  "act:guild_info":    (i) => actionGuildInfo(i),
  "act:guild_members": (i) => actionGuildMembers(i),
  // ── Explore battle moves ───────────────────────────────────────────────────
  "explore_move:attack": (i) => actionExploreMove(i, "attack"),
  "explore_move:skill":  (i) => actionExploreMove(i, "skill"),
  "explore_move:defend": (i) => actionExploreMove(i, "defend"),
  "explore_move:fury":   (i) => actionExploreMove(i, "fury"),
  // ── Party management ───────────────────────────────────────────────────────
  "act:party_manage": (i) => actionPartyManage(i),
  // ── Admin dashboard (views) ────────────────────────────────────────────────
  "admin:stats":   (i) => actionAdminStats(i),
  "admin:config":  (i) => actionAdminConfig(i),
  "admin:logs":    (i) => actionAdminLogs(i),
  "admin:refresh": (i) => actionAdminDashboard(i) as unknown as Promise<void>,
  // ── Admin dashboard (modals) ───────────────────────────────────────────────
  "admin:announce":        (i) => openAnnounceModal(i),
  "admin:give_gems":       (i) => openGiveGemsModal(i),
  "admin:give_gold":       (i) => openGiveGoldModal(i),
  "admin:give_xp":         (i) => openGiveXpModal(i),
  "admin:ban":             (i) => openBanModal(i),
  "admin:unban":           (i) => openUnbanModal(i),
  "admin:reset":           (i) => openResetModal(i),
  "admin:spawn_boss_menu": (i) => showBossSpawnMenu(i),
  // ── Tournament ─────────────────────────────────────────────────────────────
  "tournament:view":         (i) => actionTournamentView(i),
  "tournament:bracket":      (i) => actionTournamentBracket(i),
  "tournament:fight":        (i) => actionTournamentFight(i),
  "tournament:bets":         (i) => actionTournamentBets(i),
  "tournament:season":       (i) => actionTournamentSeasonStats(i),
  "tournament:admin:create": (i) => openCreateTournamentModal(i),
  "tournament:admin:start":  (i) => actionAdminStartTournament(i),
  "tournament:admin:next":   (i) => actionAdminNextRound(i),
  "tournament:admin:cancel": (i) => actionAdminCancelTournament(i),
  // ── Events ─────────────────────────────────────────────────────────────────
  "event:view":              (i) => actionEventView(i),
  "event:scores":            (i) => actionEventScores(i),
  "event:admin:template":    (i) => actionEventTemplatePicker(i),
  "event:admin:create":      (i) => openCreateEventModal(i),
  "event:admin:start":       (i) => actionAdminStartEvent(i),
  "event:admin:end":         (i) => actionAdminEndEvent(i),
  // ── Quests ─────────────────────────────────────────────────────────────────
  "quests:view":      (i) => actionQuestView(i),
  "quests:claim_all": (i) => actionQuestClaimAll(i),
  // ── Dungeons ───────────────────────────────────────────────────────────────
  "dungeon:view":      (i) => actionDungeonView(i),
  "dungeon:claim_all": (i) => actionDungeonClaimAll(i),
  "explore:start":     (i) => actionExplore(i),
  // ── Expeditions ────────────────────────────────────────────────────────────
  "expedition:view":       (i) => actionExpeditionView(i),
  "expedition:start_menu": (i) => actionExpeditionStartMenu(i),
  "expedition:claim_all":  (i) => actionExpeditionClaimAll(i),
  // ── Bounties ───────────────────────────────────────────────────────────────
  "bounty:view":      (i) => actionBountyView(i),
  "bounty:claim_all": (i) => actionBountyClaimAll(i),
};

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const id = interaction.customId;

  // Static handlers (exact match)
  const staticHandler = staticButtonHandlers[id];
  if (staticHandler) {
    await staticHandler(interaction);
    return;
  }

  // Tournament join: tournament:join:ID
  if (id.startsWith("tournament:join:")) {
    const tournamentId = parseInt(id.slice("tournament:join:".length), 10);
    await actionTournamentJoin(interaction, isNaN(tournamentId) ? undefined : tournamentId);
    return;
  }

  // Dungeon enter: dungeon:enter:DUNGEON_ID
  if (id.startsWith("dungeon:enter:")) {
    const dungeonId = id.slice("dungeon:enter:".length);
    await actionDungeonEnter(interaction, dungeonId);
    return;
  }

  // Tournament bet on player: tournament:betOn:MATCHID:PLAYERID
  if (id.startsWith("tournament:betOn:")) {
    const parts = id.split(":");
    const matchId = parts[2];
    const betOnId = parts[3];
    if (matchId && betOnId) await actionTournamentBetOn(interaction, matchId, betOnId);
    return;
  }

  // Event join: event:join:ID
  if (id.startsWith("event:join:")) {
    const eventId = parseInt(id.slice("event:join:".length), 10);
    await actionEventJoin(interaction, isNaN(eventId) ? undefined : eventId);
    return;
  }

  // Event claim: event:claim:ID
  if (id.startsWith("event:claim:")) {
    const eventId = parseInt(id.slice("event:claim:".length), 10);
    await actionEventClaim(interaction, isNaN(eventId) ? undefined : eventId);
    return;
  }

  // PvP accept: pvp_accept:BATTLEID
  if (id.startsWith("pvp_accept:")) {
    await handlePvpAccept(interaction, id.slice("pvp_accept:".length));
    return;
  }

  // PvP decline: pvp_decline:BATTLEID
  if (id.startsWith("pvp_decline:")) {
    await handlePvpDecline(interaction, id.slice("pvp_decline:".length));
    return;
  }

  // PvP move: pvp_move:BATTLEID:MOVE
  if (id.startsWith("pvp_move:")) {
    const parts = id.split(":");
    const move = parts[parts.length - 1] as Move;
    const battleId = parts.slice(1, parts.length - 1).join(":");
    await handlePvpMove(interaction, battleId, move);
    return;
  }

  // Raid attack: raid:attack:RAIDID
  if (id.startsWith("raid:attack:")) {
    await handleRaidAttack(interaction, id.slice("raid:attack:".length));
    return;
  }

  // Trade accept: trade:accept:ID
  if (id.startsWith("trade:accept:")) {
    const tradeId = parseInt(id.slice("trade:accept:".length), 10);
    if (!isNaN(tradeId)) await handleTradeAcceptButton(interaction, tradeId);
    return;
  }

  // Trade decline: trade:decline:ID
  if (id.startsWith("trade:decline:")) {
    const tradeId = parseInt(id.slice("trade:decline:".length), 10);
    if (!isNaN(tradeId)) await handleTradeDeclineButton(interaction, tradeId);
    return;
  }

  // Inventory use item: inventory:use:ITEM_ID
  if (id.startsWith("inventory:use:")) {
    const itemId = parseInt(id.slice("inventory:use:".length), 10);
    if (!isNaN(itemId)) await handleInventoryUse(interaction, itemId);
    return;
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.customId;

  if (id.startsWith("admin:modal:")) {
    await handleAdminModalSubmit(interaction);
    return;
  }

  if (id === "tournament:modal:create") {
    await handleTournamentModalSubmit(interaction);
    return;
  }

  if (id.startsWith("tournament:betmodal:")) {
    const parts = id.split(":");
    const matchId = parts[2];
    const betOnId = parts[3];
    if (matchId && betOnId) await handleTournamentBetModalSubmit(interaction, matchId, betOnId);
    return;
  }

  if (id === "event:modal:create") {
    await handleEventModalSubmit(interaction);
    return;
  }
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const id = interaction.customId;

  if (id === "party:select") {
    await actionPartySelectSubmit(interaction);
    return;
  }

  if (id === "admin:spawn_boss_select") {
    const bossId = parseInt(interaction.values[0], 10);
    if (!isNaN(bossId)) await spawnBossRaid(interaction, bossId);
    return;
  }

  if (id === "event:template:select") {
    await actionEventTemplateSelect(interaction);
    return;
  }

  if (id === "expedition:select_mission") {
    await actionExpeditionSelectMission(interaction);
    return;
  }

  if (id.startsWith("expedition:select_diff:")) {
    const missionId = id.slice("expedition:select_diff:".length);
    await actionExpeditionSelectDiff(interaction, missionId);
    return;
  }
}

export async function execute(interaction: Interaction) {
  // ── Buttons ─────────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    try {
      await handleButton(interaction);
    } catch (err) {
      console.error(`[Bot] Error in button ${interaction.customId}:`, err);
      const errEmbed = new EmbedBuilder().setColor(COLORS.danger).setTitle("⚠️ حدث خطأ").setDescription("حدث خطأ ما. يرجى المحاولة مرة أخرى.");
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    }
    return;
  }

  // ── Modal Submits ────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    try {
      await handleModalSubmit(interaction);
    } catch (err) {
      console.error(`[Bot] Error in modal ${interaction.customId}:`, err);
      const errEmbed = new EmbedBuilder().setColor(COLORS.danger).setDescription("❌ حدث خطأ أثناء معالجة النموذج. يرجى المحاولة مرة أخرى.");
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    }
    return;
  }

  // ── Select Menus ─────────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu()) {
    try {
      await handleSelectMenu(interaction);
    } catch (err) {
      console.error(`[Bot] Error in select menu ${interaction.customId}:`, err);
      const errEmbed = new EmbedBuilder().setColor(COLORS.danger).setDescription("❌ حدث خطأ ما. يرجى المحاولة مرة أخرى.");
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    }
    return;
  }

  // ── Slash Commands ────────────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  const client = interaction.client as typeof interaction.client & {
    commands: Collection<string, { execute: (i: typeof interaction) => Promise<unknown> }>;
  };

  const command = client.commands?.get(interaction.commandName);
  if (!command) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.danger).setDescription(`❌ Unknown command: \`/${interaction.commandName}\``)],
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[Bot] Error in /${interaction.commandName}:`, err);
    const errEmbed = new EmbedBuilder().setColor(COLORS.danger).setTitle("⚠️ حدث خطأ").setDescription("حدث خطأ أثناء تنفيذ الأمر. يرجى المحاولة مرة أخرى.");
    if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
    else await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
  }
}
