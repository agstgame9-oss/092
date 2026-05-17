import { db as _db } from "@workspace/db";

export const db = _db;

export {
  playersTable,
  charactersTable,
  rarityEnum,
  elementEnum,
  playerCharactersTable,
  battlesTable,
  guildsTable,
  guildMembersTable,
  guildApplicationsTable,
  cooldownsTable,
  adminLogsTable,
  itemsTable,
  inventoryTable,
  marketListingsTable,
  tradeOffersTable,
  auctionBidsTable,
  serverConfigTable,
  bossesTable,
  tournamentsTable,
  tournamentParticipantsTable,
  serverEventsTable,
  eventParticipantsTable,
  playerQuestsTable,
  expeditionsTable,
  dungeonRunsTable,
  playerBountiesTable,
} from "@workspace/db";

export type {
  Player,
  Character,
  PlayerCharacter,
  Battle,
  CombatantState,
  Guild,
  GuildMember,
  Cooldown,
  ServerConfig,
  Tournament,
  TournamentParticipant,
  ServerEvent,
  EventParticipant,
  PlayerQuest,
} from "@workspace/db";
